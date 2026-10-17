const fs = require('node:fs')
const path = require('node:path')
const Database = require('better-sqlite3')

let database
let databasePath

function initializeDatabase(userDataPath) {
  fs.mkdirSync(userDataPath, { recursive: true })
  databasePath = path.join(userDataPath, 'salle-sport.sqlite')
  database = new Database(databasePath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  database.pragma('busy_timeout = 5000')

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS athletes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      surname TEXT NOT NULL,
      given_name TEXT NOT NULL,
      birth_date TEXT,
      sex TEXT,
      address TEXT,
      phone TEXT,
      school_level TEXT,
      photo_path TEXT,
      guardian_name TEXT,
      guardian_phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS sports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      monthly_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (monthly_fee_minor >= 0)
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      athlete_id INTEGER NOT NULL REFERENCES athletes(id),
      sport_id INTEGER NOT NULL REFERENCES sports(id),
      judo_category TEXT CHECK (judo_category IS NULL OR judo_category IN ('100 DHS', '120 DHS')),
      starts_on TEXT NOT NULL,
      ends_on TEXT,
      monthly_fee_minor INTEGER NOT NULL CHECK (monthly_fee_minor >= 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (ends_on IS NULL OR ends_on >= starts_on)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_registration
      ON registrations (athlete_id, sport_id) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_registrations_athlete ON registrations (athlete_id);
    CREATE INDEX IF NOT EXISTS idx_registrations_sport ON registrations (sport_id);

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT UNIQUE,
      athlete_id INTEGER NOT NULL REFERENCES athletes(id),
      registration_id INTEGER NOT NULL REFERENCES registrations(id),
      paid_at TEXT NOT NULL DEFAULT (datetime('now')),
      amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('Espèces', 'Carte', 'Virement', 'Chèque')),
      status TEXT NOT NULL DEFAULT 'validated' CHECK (status IN ('validated', 'cancelled')),
      cancellation_reason TEXT,
      cancelled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS payment_months (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL REFERENCES payments(id),
      registration_id INTEGER NOT NULL REFERENCES registrations(id),
      year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
      is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_paid_registration_month
      ON payment_months (registration_id, year, month) WHERE is_void = 0;
    CREATE INDEX IF NOT EXISTS idx_payment_months_payment ON payment_months (payment_id);
    CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments (paid_at);
    CREATE INDEX IF NOT EXISTS idx_payments_athlete ON payments (athlete_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const migration = database.prepare(
    'INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)',
  )
  migration.run(1)

  const registrationColumns = database.prepare('PRAGMA table_info(registrations)').all()
  if (!registrationColumns.some(({ name }) => name === 'judo_category')) {
    database.exec(`
      ALTER TABLE registrations ADD COLUMN judo_category TEXT
        CHECK (judo_category IS NULL OR judo_category IN ('100 DHS', '120 DHS'))
    `)
  }
  migration.run(2)

  const insertSport = database.prepare(
    'INSERT OR IGNORE INTO sports (name, monthly_fee_minor) VALUES (?, 0)',
  )
  const seedSports = database.transaction(() => {
    for (const name of ['Judo', 'Aérobic', 'Lutte', 'Full Contact']) {
      insertSport.run(name)
    }
  })
  seedSports()

  return database
}

function getDatabase() {
  if (!database || !database.open) throw new Error('La base de données n’est pas initialisée.')
  return database
}

function getDatabasePath() {
  if (!databasePath) throw new Error('Le chemin de la base de données est indisponible.')
  return databasePath
}

function closeDatabase() {
  if (database?.open) database.close()
  database = undefined
}

module.exports = { initializeDatabase, getDatabase, getDatabasePath, closeDatabase }
