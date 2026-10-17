const { getDatabase } = require('../database.cjs')

function assertId(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} invalide.`)
  return value
}

function assertYear(value) {
  if (!Number.isInteger(value) || value < 2000 || value > 2100) throw new Error('Année invalide.')
  return value
}

function assertMonth(value) {
  if (!Number.isInteger(value) || value < 1 || value > 12) throw new Error('Mois invalide.')
  return value
}

function monthBounds(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = new Date(Date.UTC(year, month, 1))
  return { start, end: new Date(nextMonth.getTime() - 86400000).toISOString().slice(0, 10) }
}

function getRegistration(id) {
  const registration = getDatabase().prepare(`
    SELECT r.*, a.active AS athlete_active, s.name AS sport_name, a.surname, a.given_name
    FROM registrations r
    JOIN athletes a ON a.id = r.athlete_id
    JOIN sports s ON s.id = r.sport_id
    WHERE r.id = ?
  `).get(id)
  if (!registration) throw new Error('Inscription introuvable.')
  return registration
}

function getPayment(id) {
  const db = getDatabase()
  const payment = db.prepare(`
    SELECT p.*, a.surname, a.given_name, a.phone, s.name AS sport_name,
           r.monthly_fee_minor AS registration_fee
    FROM payments p
    JOIN athletes a ON a.id = p.athlete_id
    JOIN registrations r ON r.id = p.registration_id
    JOIN sports s ON s.id = r.sport_id
    WHERE p.id = ?
  `).get(id)
  if (!payment) throw new Error('Paiement introuvable.')
  payment.months = db.prepare(`
    SELECT year, month, amount_minor, is_void FROM payment_months
    WHERE payment_id = ? ORDER BY year, month
  `).all(id)
  return payment
}

function getMonthStatus(input) {
  const registrationId = assertId(input?.registrationId, 'Inscription')
  const year = assertYear(input?.year)
  const registration = getRegistration(registrationId)
  const paid = new Set(getDatabase().prepare(`
    SELECT month FROM payment_months WHERE registration_id = ? AND year = ? AND is_void = 0
  `).pluck().all(registrationId, year))
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const { start, end } = monthBounds(year, month)
    const applicable = end >= registration.starts_on &&
      (!registration.ends_on || start <= registration.ends_on)
    return {
      month,
      year,
      status: !applicable ? 'not-applicable' : paid.has(month) ? 'paid' : 'unpaid',
      amountMinor: registration.monthly_fee_minor,
    }
  })
}

function createPayment(input) {
  const registrationId = assertId(input?.registrationId, 'Inscription')
  const year = assertYear(input?.year)
  if (!Array.isArray(input.months) || input.months.length < 1 || input.months.length > 12) {
    throw new Error('Sélectionnez au moins un mois impayé.')
  }
  const months = input.months.map(assertMonth)
  if (new Set(months).size !== months.length) throw new Error('Un mois a été sélectionné plusieurs fois.')
  const paymentMethod = input.paymentMethod
  if (!['Espèces', 'Carte', 'Virement', 'Chèque'].includes(paymentMethod)) {
    throw new Error('Mode de paiement invalide.')
  }

  const registration = getRegistration(registrationId)
  if (registration.status !== 'active' || !registration.athlete_active) {
    throw new Error('Seules les inscriptions actives d’un athlète actif peuvent être réglées.')
  }
  if (registration.monthly_fee_minor <= 0) {
    throw new Error('Configurez d’abord un tarif mensuel supérieur à zéro pour cette inscription.')
  }
  const placeholders = months.map(() => '?').join(',')
  const existing = getDatabase().prepare(`
    SELECT year, month FROM payment_months
    WHERE registration_id = ? AND year = ? AND month IN (${placeholders}) AND is_void = 0
  `).get(registrationId, year, ...months)
  if (existing) throw new Error(`Le mois ${existing.month}/${existing.year} est déjà payé.`)

  for (const month of months) {
    const { start, end } = monthBounds(year, month)
    if (end < registration.starts_on || (registration.ends_on && start > registration.ends_on)) {
      throw new Error(`Le mois ${month}/${year} n’est pas applicable à cette inscription.`)
    }
  }
  const total = registration.monthly_fee_minor * months.length
  if (!Number.isSafeInteger(total)) throw new Error('Le montant total dépasse la limite autorisée.')

  const db = getDatabase()
  const savePayment = db.transaction(() => {
    const paidAt = new Date().toISOString()
    const inserted = db.prepare(`
      INSERT INTO payments (athlete_id, registration_id, paid_at, amount_minor, payment_method)
      VALUES (?, ?, ?, ?, ?)
    `).run(registration.athlete_id, registrationId, paidAt, total, paymentMethod)
    const id = Number(inserted.lastInsertRowid)
    const receiptNo = `SS-${new Date(paidAt).getFullYear()}-${String(id).padStart(7, '0')}`
    db.prepare('UPDATE payments SET receipt_no = ? WHERE id = ?').run(receiptNo, id)
    const insertMonth = db.prepare(`
      INSERT INTO payment_months (payment_id, registration_id, year, month, amount_minor)
      VALUES (?, ?, ?, ?, ?)
    `)
    for (const month of months) {
      insertMonth.run(id, registrationId, year, month, registration.monthly_fee_minor)
    }
    return id
  })

  try {
    return getPayment(savePayment())
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('Un mois sélectionné vient d’être réglé. Actualisez la page avant de recommencer.')
    }
    throw error
  }
}

function cancelPayment(input) {
  const id = assertId(input?.id, 'Paiement')
  if (typeof input?.reason !== 'string' || !input.reason.trim() || input.reason.length > 500) {
    throw new Error('Un motif d’annulation est obligatoire (500 caractères maximum).')
  }
  const db = getDatabase()
  const cancel = db.transaction(() => {
    const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(id)
    if (!payment) throw new Error('Paiement introuvable.')
    if (payment.status !== 'validated') throw new Error('Ce paiement est déjà annulé.')
    db.prepare(`
      UPDATE payments SET status = 'cancelled', cancellation_reason = ?, cancelled_at = ?
      WHERE id = ?
    `).run(input.reason.trim(), new Date().toISOString(), id)
    db.prepare('UPDATE payment_months SET is_void = 1 WHERE payment_id = ?').run(id)
  })
  cancel()
  return getPayment(id)
}

module.exports = { getPayment, getMonthStatus, createPayment, cancelPayment }
