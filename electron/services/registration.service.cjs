const { getDatabase } = require('../database.cjs')

const judoFees = new Map([
  ['100 DHS', 10000],
  ['120 DHS', 12000],
])

function assertId(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} invalide.`)
  return value
}

function assertDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Date de début invalide.')
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Date de début invalide.')
  }
  return value
}

function insertRegistration(db, input, athleteId) {
  const sportId = assertId(input?.sportId, 'Discipline')
  const startsOn = assertDate(input?.startsOn)

  if (!db.inTransaction) throw new Error('La création de l’inscription exige une transaction.')
  const athlete = db.prepare('SELECT active FROM athletes WHERE id = ?').get(athleteId)
  if (!athlete || !athlete.active) throw new Error('L’athlète n’existe pas ou est inactif.')

  const sport = db.prepare('SELECT name, monthly_fee_minor FROM sports WHERE id = ?').get(sportId)
  if (!sport) throw new Error('Discipline introuvable.')

  const isJudo = sport.name.trim().toLowerCase() === 'judo'
  let category = null
  let monthlyFeeMinor = sport.monthly_fee_minor
  if (isJudo) {
    if (typeof input.judoCategory !== 'string' || !judoFees.has(input.judoCategory)) {
      throw new Error('Sélectionnez une catégorie de judo à 100 DHS ou à 120 DHS.')
    }
    category = input.judoCategory
    monthlyFeeMinor = judoFees.get(category)
  } else if (input.judoCategory != null && input.judoCategory !== '') {
    throw new Error('Une catégorie de judo ne peut être choisie que pour la discipline Judo.')
  }

  if (monthlyFeeMinor <= 0) {
    throw new Error('Configurez d’abord un tarif supérieur à zéro pour cette discipline.')
  }

  const existing = db.prepare(`
    SELECT id FROM registrations WHERE athlete_id = ? AND sport_id = ? AND status = 'active'
  `).get(athleteId, sportId)
  if (existing) throw new Error('Cet athlète possède déjà une inscription active dans cette discipline.')

  const result = db.prepare(`
    INSERT INTO registrations (athlete_id, sport_id, judo_category, starts_on, monthly_fee_minor)
    VALUES (?, ?, ?, ?, ?)
  `).run(athleteId, sportId, category, startsOn, monthlyFeeMinor)
  return { id: Number(result.lastInsertRowid) }
}

function createRegistration(input) {
  const athleteId = assertId(input?.athleteId, 'Athlète')
  const db = getDatabase()
  return db.transaction(() => insertRegistration(db, input, athleteId))()
}

function insertRegistrationInTransaction(db, input, athleteId) {
  assertId(athleteId, 'Athlète')
  return insertRegistration(db, input, athleteId)
}

module.exports = { createRegistration, insertRegistrationInTransaction }
