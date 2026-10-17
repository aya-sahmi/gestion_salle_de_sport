const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const Database = require('better-sqlite3')
const {
  initializeDatabase,
  getDatabase,
  getDatabasePath,
  closeDatabase,
} = require('./database.cjs')
const paymentService = require('./services/payment.service.cjs')
const registrationService = require('./services/registration.service.cjs')

let mainWindow
app.setName('Salle Sport')

function assertText(value, label, maxLength = 200) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`${label} est obligatoire et ne peut pas dépasser ${maxLength} caractères.`)
  }
  return value.trim()
}

function optionalText(value, label, maxLength = 200) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`${label} ne peut pas dépasser ${maxLength} caractères.`)
  }
  return value.trim() || null
}

function assertId(value, label = 'Identifiant') {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} invalide.`)
  return value
}

function assertYearMonth(year, month) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Année invalide.')
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Mois invalide.')
}

function assertDate(value, label) {
  const date = assertText(value, label, 10)
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${label} invalide.`)
  }
  return date
}

function monthBounds(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const next = new Date(Date.UTC(year, month, 1))
  const end = new Date(next.getTime() - 86400000).toISOString().slice(0, 10)
  return { start, end }
}

function athleteList(filters = {}) {
  filters = filters || {}
  const db = getDatabase()
  const search = typeof filters.search === 'string' ? filters.search.trim() : ''
  const sportId = filters.sportId ? assertId(filters.sportId, 'Discipline') : null
  const active = filters.active === true || filters.active === false ? Number(filters.active) : null
  return db
    .prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM registrations r WHERE r.athlete_id = a.id AND r.status = 'active') AS active_registrations,
        GROUP_CONCAT(DISTINCT CASE WHEN r.status = 'active' THEN s.name END) AS sports
      FROM athletes a
      LEFT JOIN registrations r ON r.athlete_id = a.id
      LEFT JOIN sports s ON s.id = r.sport_id
      WHERE (? = '' OR a.surname LIKE '%' || ? || '%' OR a.given_name LIKE '%' || ? || '%' OR COALESCE(a.phone, '') LIKE '%' || ? || '%')
        AND (? IS NULL OR a.active = ?)
        AND (? IS NULL OR EXISTS (
          SELECT 1 FROM registrations rf WHERE rf.athlete_id = a.id AND rf.sport_id = ? AND rf.status = 'active'
        ))
      GROUP BY a.id
      ORDER BY a.surname COLLATE NOCASE, a.given_name COLLATE NOCASE
    `)
    .all(search, search, search, search, active, active, sportId, sportId)
}

function registrationList(filters = {}) {
  filters = filters || {}
  const sportId = filters.sportId ? assertId(filters.sportId, 'Discipline') : null
  const athleteId = filters.athleteId ? assertId(filters.athleteId, 'Athlète') : null
  const status = ['active', 'ended'].includes(filters.status) ? filters.status : null
  return getDatabase()
    .prepare(`
      SELECT r.*, a.surname, a.given_name, a.active AS athlete_active, s.name AS sport_name
      FROM registrations r
      JOIN athletes a ON a.id = r.athlete_id
      JOIN sports s ON s.id = r.sport_id
      WHERE (? IS NULL OR r.sport_id = ?)
        AND (? IS NULL OR r.athlete_id = ?)
        AND (? IS NULL OR r.status = ?)
      ORDER BY r.status, r.starts_on DESC, a.surname COLLATE NOCASE
    `)
    .all(sportId, sportId, athleteId, athleteId, status, status)
}

function paymentList(filters = {}) {
  filters = filters || {}
  const db = getDatabase()
  const search = optionalText(filters.search, 'Recherche', 80)
  const sportId = filters.sportId ? assertId(filters.sportId, 'Discipline') : null
  const fromValue = optionalText(filters.from, 'Date de début', 10)
  const toValue = optionalText(filters.to, 'Date de fin', 10)
  const from = fromValue ? assertDate(fromValue, 'Date de début') : null
  const to = toValue ? assertDate(toValue, 'Date de fin') : null
  if (from && to && from > to) throw new Error('La date de début doit précéder la date de fin.')
  return db
    .prepare(`
      SELECT p.*, a.surname, a.given_name, s.name AS sport_name,
        GROUP_CONCAT(pm.month || '/' || pm.year, ', ') AS months
      FROM payments p
      JOIN athletes a ON a.id = p.athlete_id
      JOIN registrations r ON r.id = p.registration_id
      JOIN sports s ON s.id = r.sport_id
      LEFT JOIN payment_months pm ON pm.payment_id = p.id
      WHERE (? IS NULL OR p.receipt_no LIKE '%' || ? || '%' OR a.surname LIKE '%' || ? || '%' OR a.given_name LIKE '%' || ? || '%')
        AND (? IS NULL OR r.sport_id = ?)
        AND (? IS NULL OR date(p.paid_at) >= date(?))
        AND (? IS NULL OR date(p.paid_at) <= date(?))
      GROUP BY p.id
      ORDER BY p.id DESC
      LIMIT 500
    `)
    .all(search, search, search, search, sportId, sportId, from, from, to, to)
}

function dashboardSummary(year, month) {
  assertYearMonth(year, month)
  const db = getDatabase()
  const bounds = monthBounds(year, month)
  const totals = db
    .prepare(`
      SELECT COUNT(*) AS athletes_total,
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS athletes_active
      FROM athletes
    `)
    .get()
  const disciplineCounts = db
    .prepare(`
      SELECT s.id, s.name, COUNT(DISTINCT CASE WHEN r.status = 'active' AND a.active = 1 THEN a.id END) AS athletes
      FROM sports s
      LEFT JOIN registrations r ON r.sport_id = s.id
      LEFT JOIN athletes a ON a.id = r.athlete_id
      GROUP BY s.id ORDER BY s.id
    `)
    .all()
  const revenue = db
    .prepare(`
      SELECT COALESCE(SUM(amount_minor), 0) AS amount,
        COUNT(*) AS count
      FROM payments
      WHERE status = 'validated' AND date(paid_at) BETWEEN date(?) AND date(?)
    `)
    .get(`${year}-${String(month).padStart(2, '0')}-01`, bounds.end)
  const bySport = db
    .prepare(`
      SELECT s.name, COALESCE(SUM(p.amount_minor), 0) AS amount
      FROM sports s
      LEFT JOIN registrations r ON r.sport_id = s.id
      LEFT JOIN payments p ON p.registration_id = r.id
        AND p.status = 'validated' AND date(p.paid_at) BETWEEN date(?) AND date(?)
      GROUP BY s.id ORDER BY s.id
    `)
    .all(`${year}-${String(month).padStart(2, '0')}-01`, bounds.end)

  const due = db
    .prepare(`
      SELECT r.id, r.starts_on, r.ends_on, r.athlete_id, r.monthly_fee_minor
      FROM registrations r JOIN athletes a ON a.id = r.athlete_id
      WHERE r.status = 'active' AND a.active = 1
    `)
    .all()
  let overdue = 0
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  for (const registration of due) {
    const paid = new Set(
      db.prepare(`
        SELECT year || '-' || month AS ym FROM payment_months
        WHERE registration_id = ? AND is_void = 0
      `).pluck().all(registration.id),
    )
    const startYear = Number(registration.starts_on.slice(0, 4))
    const startMonth = Number(registration.starts_on.slice(5, 7))
    for (let y = startYear, m = startMonth; y < currentYear || (y === currentYear && m < currentMonth);) {
      const lastDay = monthBounds(y, m).end
      const applicable = lastDay >= registration.starts_on &&
        (!registration.ends_on || `${y}-${String(m).padStart(2, '0')}-01` <= registration.ends_on)
      if (applicable && !paid.has(`${y}-${m}`)) overdue++
      if (m === 12) { y++; m = 1 } else m++
    }
  }

  return {
    ...totals,
    athletes_total: totals.athletes_total || 0,
    athletes_active: totals.athletes_active || 0,
    disciplineCounts,
    revenue: revenue.amount,
    paymentCount: revenue.count,
    overdue,
    bySport,
    recentPayments: paymentList({}).slice(0, 6),
  }
}

function overdueReport() {
  const db = getDatabase()
  const now = new Date()
  let throughYear = now.getFullYear()
  let throughMonth = now.getMonth()
  if (throughMonth === 0) { throughYear--; throughMonth = 12 }
  const registrations = db.prepare(`
    SELECT r.*, a.surname, a.given_name, s.name AS sport_name
    FROM registrations r
    JOIN athletes a ON a.id = r.athlete_id
    JOIN sports s ON s.id = r.sport_id
    WHERE a.active = 1
  `).all()
  const report = []
  for (const registration of registrations) {
    const paid = new Set(db.prepare(`
      SELECT year || '-' || month AS ym FROM payment_months
      WHERE registration_id = ? AND is_void = 0
    `).pluck().all(registration.id))
    const startYear = Number(registration.starts_on.slice(0, 4))
    const startMonth = Number(registration.starts_on.slice(5, 7))
    const monthsDue = []
    for (let year = startYear, month = startMonth;
      year < throughYear || (year === throughYear && month <= throughMonth);) {
      const { start, end } = monthBounds(year, month)
      const applicable = end >= registration.starts_on &&
        (!registration.ends_on || start <= registration.ends_on)
      if (applicable && !paid.has(`${year}-${month}`)) monthsDue.push({ year, month })
      if (month === 12) { year++; month = 1 } else month++
    }
    if (monthsDue.length) {
      report.push({
        athlete_id: registration.athlete_id,
        surname: registration.surname,
        given_name: registration.given_name,
        registration_id: registration.id,
        sport_name: registration.sport_name,
        monthly_fee_minor: registration.monthly_fee_minor,
        months_due: monthsDue,
        outstanding_minor: monthsDue.length * registration.monthly_fee_minor,
      })
    }
  }
  return report
}

const handlers = {
  'athletes.list': (_event, filters) => athleteList(filters),
  'athletes.get': (_event, id) => {
    assertId(id)
    const athlete = getDatabase().prepare('SELECT * FROM athletes WHERE id = ?').get(id)
    if (!athlete) throw new Error('Athlète introuvable.')
    const payments = getDatabase().prepare(`
      SELECT p.*, a.surname, a.given_name, s.name AS sport_name,
        GROUP_CONCAT(pm.month || '/' || pm.year, ', ') AS months
      FROM payments p
      JOIN athletes a ON a.id = p.athlete_id
      JOIN registrations r ON r.id = p.registration_id
      JOIN sports s ON s.id = r.sport_id
      LEFT JOIN payment_months pm ON pm.payment_id = p.id
      WHERE p.athlete_id = ?
      GROUP BY p.id ORDER BY p.id DESC LIMIT 50
    `).all(id)
    return {
      ...athlete,
      registrations: registrationList({ athleteId: id }),
      payments,
    }
  },
  'athletes.create': (_event, input) => {
    const surname = assertText(input?.surname, 'Nom', 80)
    const givenName = assertText(input?.givenName, 'Prénom', 80)
    const birthDate = input?.birthDate ? assertDate(input.birthDate, 'Date de naissance') : null
    const phone = optionalText(input?.phone, 'Téléphone', 40)
    const db = getDatabase()
    const create = db.transaction(() => {
      const result = db.prepare(`
      INSERT INTO athletes (surname, given_name, birth_date, sex, address, phone, school_level,
        guardian_name, guardian_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        surname, givenName, birthDate,
        optionalText(input.sex, 'Sexe', 30), optionalText(input.address, 'Adresse', 300),
        phone, optionalText(input.schoolLevel, 'Niveau scolaire', 80),
        optionalText(input.guardianName, 'Nom du tuteur', 120),
        optionalText(input.guardianPhone, 'Téléphone du tuteur', 40),
      )
      const id = Number(result.lastInsertRowid)
      if (input?.sportId != null && input.sportId !== '') {
        registrationService.insertRegistrationInTransaction(db, {
          sportId: input.sportId,
          startsOn: input.startsOn,
          judoCategory: input.judoCategory,
        }, id)
      } else if (input?.judoCategory != null && input.judoCategory !== '') {
        throw new Error('Choisissez une discipline avant de sélectionner une catégorie.')
      }
      return { id }
    })
    return create()
  },
  'athletes.update': (_event, input) => {
    const id = assertId(input?.id)
    const result = getDatabase().prepare(`
      UPDATE athletes SET surname = ?, given_name = ?, birth_date = ?, sex = ?, address = ?,
        phone = ?, school_level = ?, guardian_name = ?, guardian_phone = ?, active = ?
      WHERE id = ?
    `).run(
      assertText(input.surname, 'Nom', 80), assertText(input.givenName, 'Prénom', 80),
      input.birthDate ? assertDate(input.birthDate, 'Date de naissance') : null,
      optionalText(input.sex, 'Sexe', 30), optionalText(input.address, 'Adresse', 300),
      optionalText(input.phone, 'Téléphone', 40), optionalText(input.schoolLevel, 'Niveau scolaire', 80),
      optionalText(input.guardianName, 'Nom du tuteur', 120),
      optionalText(input.guardianPhone, 'Téléphone du tuteur', 40),
      input.active === false ? 0 : 1, id,
    )
    if (!result.changes) throw new Error('Athlète introuvable.')
    return { id }
  },
  'sports.list': () => getDatabase().prepare('SELECT * FROM sports ORDER BY id').all(),
  'sports.updateFee': (_event, input) => {
    const id = assertId(input?.id, 'Discipline')
    if (!Number.isSafeInteger(input.monthlyFeeMinor) || input.monthlyFeeMinor < 0) {
      throw new Error('Le tarif doit être un montant positif ou nul.')
    }
    const result = getDatabase().prepare('UPDATE sports SET monthly_fee_minor = ? WHERE id = ?')
      .run(input.monthlyFeeMinor, id)
    if (!result.changes) throw new Error('Discipline introuvable.')
    return { id }
  },
  'sports.updateFees': (_event, inputs) => {
    if (!Array.isArray(inputs) || inputs.length !== 4) throw new Error('Les quatre tarifs doivent être fournis.')
    const ids = inputs.map((input) => assertId(input?.id, 'Discipline')).sort((a, b) => a - b)
    if (new Set(ids).size !== 4 || ids.some((id, index) => id !== index + 1)) {
      throw new Error('Une fois chacun des quatre tarifs doit être fourni.')
    }
    const update = getDatabase().prepare('UPDATE sports SET monthly_fee_minor = ? WHERE id = ?')
    const save = getDatabase().transaction(() => {
      for (const input of inputs) {
        const id = assertId(input?.id, 'Discipline')
        if (!Number.isSafeInteger(input.monthlyFeeMinor) || input.monthlyFeeMinor < 0) {
          throw new Error('Le tarif doit être un montant positif ou nul.')
        }
        const result = update.run(input.monthlyFeeMinor, id)
        if (!result.changes) throw new Error('Une discipline est introuvable.')
      }
    })
    save()
    return getDatabase().prepare('SELECT * FROM sports ORDER BY id').all()
  },
  'registrations.list': (_event, filters) => registrationList(filters),
  'registrations.create': (_event, input) => registrationService.createRegistration(input),
  'registrations.end': (_event, input) => {
    const id = assertId(input?.id, 'Inscription')
    const endsOn = assertDate(input?.endsOn, 'Date de fin')
    const result = getDatabase().prepare(`
      UPDATE registrations SET status = 'ended', ends_on = ?
      WHERE id = ? AND status = 'active' AND starts_on <= ?
    `).run(endsOn, id, endsOn)
    if (!result.changes) throw new Error('Inscription introuvable ou date de fin antérieure au début.')
    return { id }
  },
  'payments.monthStatus': (_event, input) => paymentService.getMonthStatus(input),
  'payments.create': (_event, input) => paymentService.createPayment(input),
  'payments.list': (_event, filters) => paymentList(filters),
  'payments.get': (_event, id) => paymentService.getPayment(assertId(id, 'Paiement')),
  'payments.cancel': (_event, input) => paymentService.cancelPayment(input),
  'dashboard.summary': (_event, input) => dashboardSummary(input?.year, input?.month),
  'reports.revenue': (_event, filters) => {
    const from = assertDate(filters?.from, 'Date de début')
    const to = assertDate(filters?.to, 'Date de fin')
    if (from > to) throw new Error('La date de début doit précéder la date de fin.')
    const sportId = filters?.sportId ? assertId(filters.sportId, 'Discipline') : null
    return getDatabase().prepare(`
      SELECT date(p.paid_at) AS date, s.name AS sport, COUNT(DISTINCT p.id) AS payments,
        COALESCE(SUM(p.amount_minor), 0) AS amount
      FROM payments p
      JOIN registrations r ON r.id = p.registration_id
      JOIN sports s ON s.id = r.sport_id
      WHERE p.status = 'validated' AND date(p.paid_at) BETWEEN date(?) AND date(?)
        AND (? IS NULL OR s.id = ?)
      GROUP BY date(p.paid_at), s.id
      ORDER BY date(p.paid_at) DESC, s.name
    `).all(from, to, sportId, sportId)
  },
  'reports.byPaidMonth': (_event, filters) => {
    const year = filters?.year
    assertYearMonth(year, 1)
    const sportId = filters?.sportId ? assertId(filters.sportId, 'Discipline') : null
    return getDatabase().prepare(`
      SELECT pm.year, pm.month, s.name AS sport, COUNT(DISTINCT p.id) AS payments,
        SUM(pm.amount_minor) AS amount
      FROM payment_months pm
      JOIN payments p ON p.id = pm.payment_id
      JOIN registrations r ON r.id = pm.registration_id
      JOIN sports s ON s.id = r.sport_id
      WHERE pm.year = ? AND pm.is_void = 0 AND p.status = 'validated'
        AND (? IS NULL OR s.id = ?)
      GROUP BY pm.year, pm.month, s.id
      ORDER BY pm.month, s.name
    `).all(year, sportId, sportId)
  },
  'reports.overdue': () => overdueReport(),
  'settings.get': () => {
    const values = Object.fromEntries(
      getDatabase().prepare('SELECT key, value FROM settings').all().map(({ key, value }) => [key, value]),
    )
    return {
      gymName: values.gymName || 'Salle Sport',
      address: values.address || '',
      phone: values.phone || '',
      email: values.email || '',
      currency: values.currency || 'MAD',
    }
  },
  'settings.update': (_event, input) => {
    const db = getDatabase()
    const update = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    const set = db.transaction(() => {
      for (const key of ['gymName', 'address', 'phone', 'email']) {
        const max = key === 'address' ? 300 : 120
        const value = key === 'gymName'
          ? assertText(input?.[key], 'Nom de la salle', max)
          : optionalText(input?.[key], key, max) || ''
        update.run(key, value)
      }
    })
    set()
    return handlers['settings.get']()
  },
  'receipts.print': () => {
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Fenêtre d’impression indisponible.')
    return new Promise((resolve, reject) => {
      mainWindow.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        if (success) resolve({ success: true })
        else reject(new Error(failureReason || 'L’impression a échoué. Le paiement reste enregistré.'))
      })
    })
  },
  'backups.create': async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer une sauvegarde',
      defaultPath: 'salle-sport-sauvegarde.sqlite',
      filters: [{ name: 'Base SQLite', extensions: ['sqlite', 'db'] }],
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    await getDatabase().backup(result.filePath)
    return { canceled: false, path: result.filePath }
  },
  'backups.restore': async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choisir une sauvegarde à restaurer',
      properties: ['openFile'],
      filters: [{ name: 'Base SQLite', extensions: ['sqlite', 'db'] }],
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }
    const source = result.filePaths[0]
    if (path.resolve(source) === path.resolve(getDatabasePath())) {
      throw new Error('Sélectionnez une sauvegarde externe, pas la base actuellement utilisée.')
    }
    let testDb
    try {
      testDb = new Database(source, { readonly: true, fileMustExist: true })
      const integrity = testDb.pragma('integrity_check', { simple: true })
      const tables = testDb.prepare(`
        SELECT name FROM sqlite_master WHERE type = 'table'
          AND name IN ('athletes', 'sports', 'registrations', 'payments', 'payment_months', 'settings')
      `).pluck().all()
      if (integrity !== 'ok' || tables.length !== 6) throw new Error('La sauvegarde est invalide ou incomplète.')
    } finally {
      if (testDb?.open) testDb.close()
    }
    const confirm = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Annuler', 'Restaurer'],
      defaultId: 0,
      cancelId: 0,
      title: 'Confirmer la restauration',
      message: 'La base actuelle sera remplacée. Une sauvegarde de sécurité sera conservée.',
    })
    if (confirm.response !== 1) return { canceled: true }

    const livePath = getDatabasePath()
    const safetyPath = `${livePath}.before-restore-${Date.now()}.sqlite`
    await getDatabase().backup(safetyPath)
    closeDatabase()
    try {
      fs.copyFileSync(source, livePath)
      initializeDatabase(app.getPath('userData'))
    } catch (error) {
      if (fs.existsSync(safetyPath)) fs.copyFileSync(safetyPath, livePath)
      initializeDatabase(app.getPath('userData'))
      throw error
    }
    return { canceled: false }
  },
}

function registerHandlers() {
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, payload) => {
      if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame) {
        throw new Error('Requête IPC non autorisée.')
      }
      return handler(event, payload)
    })
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f7f8fa',
    title: 'Salle Sport',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const packagedEntry = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href
    let allowed = url === packagedEntry
    if (!app.isPackaged) {
      try { allowed = new URL(url).origin === 'http://127.0.0.1:5173' } catch { allowed = false }
    }
    if (!allowed) event.preventDefault()
  })

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  } else {
    mainWindow.loadURL('http://127.0.0.1:5173')
  }
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  initializeDatabase(app.getPath('userData'))
  registerHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', closeDatabase)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
