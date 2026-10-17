const { afterEach, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { initializeDatabase, getDatabase, closeDatabase } = require('../database.cjs')
const registrations = require('./registration.service.cjs')

let directory
let judoId
let lutteId

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salle-sport-registration-test-'))
  initializeDatabase(directory)
  const db = getDatabase()
  judoId = db.prepare("SELECT id FROM sports WHERE name = 'Judo'").pluck().get()
  lutteId = db.prepare("SELECT id FROM sports WHERE name = 'Lutte'").pluck().get()
})

afterEach(() => {
  closeDatabase()
  fs.rmSync(directory, { recursive: true, force: true })
})

function createAthlete(name) {
  return Number(getDatabase().prepare(
    'INSERT INTO athletes (surname, given_name) VALUES (?, ?)',
  ).run(name, 'Test').lastInsertRowid)
}

function getRegistration(id) {
  return getDatabase().prepare(
    'SELECT judo_category, monthly_fee_minor FROM registrations WHERE id = ?',
  ).get(id)
}

test('Judo registration stores the 100 DHS category and monthly fee', () => {
  const athleteId = createAthlete('Amina')
  const { id } = registrations.createRegistration({
    athleteId, sportId: judoId, startsOn: '2026-10-17', judoCategory: '100 DHS',
  })
  assert.deepEqual(getRegistration(id), { judo_category: '100 DHS', monthly_fee_minor: 10000 })
})

test('Judo registration stores the 120 DHS category and monthly fee', () => {
  const athleteId = createAthlete('Youssef')
  const { id } = registrations.createRegistration({
    athleteId, sportId: judoId, startsOn: '2026-10-17', judoCategory: '120 DHS',
  })
  assert.deepEqual(getRegistration(id), { judo_category: '120 DHS', monthly_fee_minor: 12000 })
})

test('Judo registration requires one of its two categories', () => {
  const athleteId = createAthlete('Salma')
  assert.throws(
    () => registrations.createRegistration({ athleteId, sportId: judoId, startsOn: '2026-10-17' }),
    /Sélectionnez une catégorie de judo/,
  )
  assert.throws(
    () => registrations.createRegistration({
      athleteId, sportId: judoId, startsOn: '2026-10-17', judoCategory: '150 DHS',
    }),
    /Sélectionnez une catégorie de judo/,
  )
  assert.equal(getDatabase().prepare('SELECT COUNT(*) AS count FROM registrations').get().count, 0)
})

test('other disciplines keep their configured fee and reject a Judo category', () => {
  const db = getDatabase()
  db.prepare('UPDATE sports SET monthly_fee_minor = 7500 WHERE id = ?').run(lutteId)
  const athleteId = createAthlete('Omar')
  const { id } = registrations.createRegistration({
    athleteId, sportId: lutteId, startsOn: '2026-10-17',
  })
  assert.deepEqual(getRegistration(id), { judo_category: null, monthly_fee_minor: 7500 })
  assert.throws(
    () => registrations.createRegistration({
      athleteId: createAthlete('Nora'), sportId: lutteId, startsOn: '2026-10-17', judoCategory: '100 DHS',
    }),
    /ne peut être choisie que pour la discipline Judo/,
  )
})

test('a new athlete and Judo registration can be inserted in one transaction', () => {
  const db = getDatabase()
  const create = db.transaction(() => {
    const athleteId = Number(db.prepare(
      "INSERT INTO athletes (surname, given_name) VALUES ('Rania', 'Test')",
    ).run().lastInsertRowid)
    const registration = registrations.insertRegistrationInTransaction(db, {
      sportId: judoId, startsOn: '2026-10-17', judoCategory: '120 DHS',
    }, athleteId)
    return { athleteId, registrationId: registration.id }
  })
  const { athleteId, registrationId } = create()
  assert.equal(getDatabase().prepare(
    'SELECT athlete_id FROM registrations WHERE id = ?',
  ).pluck().get(registrationId), athleteId)
  assert.equal(getRegistration(registrationId).monthly_fee_minor, 12000)
})

test('an invalid discipline selection rolls back new-athlete registration creation', () => {
  const db = getDatabase()
  const create = db.transaction(() => {
    const athleteId = Number(db.prepare(
      "INSERT INTO athletes (surname, given_name) VALUES ('Nadia', 'Test')",
    ).run().lastInsertRowid)
    registrations.insertRegistrationInTransaction(db, {
      sportId: judoId, startsOn: '2026-10-17',
    }, athleteId)
  })
  assert.throws(create, /Sélectionnez une catégorie de judo/)
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM athletes WHERE surname = 'Nadia'").get().count, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM registrations').get().count, 0)
})

test('initializing an older database adds the optional Judo category column', () => {
  closeDatabase()
  const legacyPath = path.join(directory, 'salle-sport.sqlite')
  fs.rmSync(legacyPath, { force: true })
  const Database = require('better-sqlite3')
  const legacyDb = new Database(legacyPath)
  legacyDb.exec(`
    CREATE TABLE registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      athlete_id INTEGER NOT NULL REFERENCES athletes(id),
      sport_id INTEGER NOT NULL REFERENCES sports(id),
      starts_on TEXT NOT NULL,
      ends_on TEXT,
      monthly_fee_minor INTEGER NOT NULL CHECK (monthly_fee_minor >= 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (ends_on IS NULL OR ends_on >= starts_on)
    );
  `)
  legacyDb.close()

  const migratedDb = initializeDatabase(directory)
  const columns = migratedDb.prepare('PRAGMA table_info(registrations)').all()
  assert.ok(columns.some(({ name }) => name === 'judo_category'))
  assert.equal(migratedDb.prepare('SELECT version FROM schema_migrations ORDER BY version').all().length, 2)
})
