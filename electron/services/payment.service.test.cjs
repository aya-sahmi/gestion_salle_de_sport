const { afterEach, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  initializeDatabase,
  getDatabase,
  closeDatabase,
} = require('../database.cjs')
const payments = require('./payment.service.cjs')

let directory
let registrationId

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salle-sport-test-'))
  initializeDatabase(directory)
  const db = getDatabase()
  const athlete = db.prepare("INSERT INTO athletes (surname, given_name) VALUES ('Test', 'Amina')").run()
  const sport = db.prepare("SELECT id FROM sports WHERE name = 'Judo'").get()
  registrationId = Number(db.prepare(`
    INSERT INTO registrations (athlete_id, sport_id, starts_on, monthly_fee_minor)
    VALUES (?, ?, '2025-01-01', 12550)
  `).run(Number(athlete.lastInsertRowid), sport.id).lastInsertRowid)
})

afterEach(() => {
  closeDatabase()
  fs.rmSync(directory, { recursive: true, force: true })
})

test('multi-month payments use the saved registration rate and one unique receipt', () => {
  const payment = payments.createPayment({
    registrationId, year: 2025, months: [1, 2, 3], paymentMethod: 'Espèces',
  })
  assert.equal(payment.amount_minor, 37650)
  assert.match(payment.receipt_no, /^SS-\d{4}-\d{7}$/)
  assert.deepEqual(payment.months.map(({ month }) => month), [1, 2, 3])
  assert.equal(payments.getMonthStatus({ registrationId, year: 2025 })[0].status, 'paid')
})

test('duplicate and non-applicable months are refused without partial payment rows', () => {
  const first = payments.createPayment({
    registrationId, year: 2025, months: [1], paymentMethod: 'Espèces',
  })
  assert.throws(
    () => payments.createPayment({ registrationId, year: 2025, months: [2, 1], paymentMethod: 'Espèces' }),
    /déjà payé/,
  )
  assert.throws(
    () => payments.createPayment({ registrationId, year: 2025, months: [13], paymentMethod: 'Espèces' }),
    /Mois invalide/,
  )
  assert.equal(getDatabase().prepare('SELECT COUNT(*) AS count FROM payments').get().count, 1)
  assert.equal(getDatabase().prepare('SELECT COUNT(*) AS count FROM payment_months WHERE payment_id = ?').get(first.id).count, 1)
})

test('the SQLite uniqueness constraint and transaction prevent partial concurrent-style writes', () => {
  const payment = payments.createPayment({
    registrationId, year: 2025, months: [1], paymentMethod: 'Espèces',
  })
  const db = getDatabase()
  const insertDuplicate = () => db.prepare(`
    INSERT INTO payment_months (payment_id, registration_id, year, month, amount_minor)
    VALUES (?, ?, 2025, 1, 12550)
  `).run(payment.id, registrationId)
  assert.throws(insertDuplicate, /UNIQUE constraint failed/)

  const addPartialPayment = db.transaction(() => {
    const inserted = db.prepare(`
      INSERT INTO payments (athlete_id, registration_id, paid_at, amount_minor, payment_method)
      VALUES (?, ?, datetime('now'), 25100, 'Espèces')
    `).run(payment.athlete_id, registrationId)
    db.prepare(`
      INSERT INTO payment_months (payment_id, registration_id, year, month, amount_minor)
      VALUES (?, ?, 2025, 2, 12550)
    `).run(Number(inserted.lastInsertRowid), registrationId)
    db.prepare(`
      INSERT INTO payment_months (payment_id, registration_id, year, month, amount_minor)
      VALUES (?, ?, 2025, 1, 12550)
    `).run(Number(inserted.lastInsertRowid), registrationId)
  })
  assert.throws(addPartialPayment, /UNIQUE constraint failed/)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 1)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payment_months').get().count, 1)
})

test('cancellation preserves the receipt and releases months for corrected re-entry', () => {
  const oldPayment = payments.createPayment({
    registrationId, year: 2025, months: [4, 5], paymentMethod: 'Carte',
  })
  const cancelled = payments.cancelPayment({ id: oldPayment.id, reason: 'Erreur de saisie' })
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.receipt_no, oldPayment.receipt_no)
  assert.equal(cancelled.cancellation_reason, 'Erreur de saisie')
  assert.equal(payments.getMonthStatus({ registrationId, year: 2025 })[3].status, 'unpaid')

  const corrected = payments.createPayment({
    registrationId, year: 2025, months: [4, 5], paymentMethod: 'Espèces',
  })
  assert.notEqual(corrected.receipt_no, oldPayment.receipt_no)
  assert.equal(getDatabase().prepare('SELECT COUNT(*) AS count FROM payments').get().count, 2)
})

test('SQLite data survives closing and reopening the application database', () => {
  payments.createPayment({ registrationId, year: 2025, months: [6], paymentMethod: 'Virement' })
  closeDatabase()
  const db = initializeDatabase(directory)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 1)
  assert.equal(payments.getMonthStatus({ registrationId, year: 2025 })[5].status, 'paid')
})

test('the database enforces one active athlete registration per sport', () => {
  const athleteId = getDatabase().prepare('SELECT athlete_id FROM registrations WHERE id = ?')
    .pluck().get(registrationId)
  const sportId = getDatabase().prepare('SELECT sport_id FROM registrations WHERE id = ?')
    .pluck().get(registrationId)
  assert.throws(() => getDatabase().prepare(`
    INSERT INTO registrations (athlete_id, sport_id, starts_on, monthly_fee_minor)
    VALUES (?, ?, '2025-02-01', 12550)
  `).run(athleteId, sportId), /UNIQUE constraint failed/)
})
