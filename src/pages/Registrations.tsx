import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CalendarCheck, Plus, Search } from 'lucide-react'
import { Modal } from '../components/Modal'
import { dateLabel, inputDateToday, money } from '../lib/format'
import type { Athlete, Registration, Sport } from '../types'

export function Registrations() {
  const [rows, setRows] = useState<Registration[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [sports, setSports] = useState<Sport[]>([])
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const [athleteId, setAthleteId] = useState('')
  const [sportId, setSportId] = useState('')
  const [judoCategory, setJudoCategory] = useState<'100 DHS' | '120 DHS' | ''>('')
  const [startsOn, setStartsOn] = useState(inputDateToday())
  const [endTarget, setEndTarget] = useState<Registration | null>(null)
  const [endsOn, setEndsOn] = useState(inputDateToday())
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const selectedSport = sports.find((sport) => sport.id === Number(sportId))
  const isJudo = selectedSport?.name.trim().toLowerCase() === 'judo'
  const refresh = useCallback(() => window.gym.registrations.list({ status: filter || undefined })
    .then(setRows).catch((reason: Error) => setError(reason.message)), [filter])
  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    window.gym.athletes.list({ active: true }).then(setAthletes).catch((reason: Error) => setError(reason.message))
    window.gym.sports.list().then(setSports).catch((reason: Error) => setError(reason.message))
  }, [])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await window.gym.registrations.create({
        athleteId: Number(athleteId),
        sportId: Number(sportId),
        startsOn,
        ...(isJudo && judoCategory ? { judoCategory } : {}),
      })
      setModal(false); setMessage('Inscription créée. Le tarif mensuel est figé sur cette inscription.')
      await refresh()
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  const closeRegistration = async (event: FormEvent) => {
    event.preventDefault(); if (!endTarget) return
    setBusy(true); setError('')
    try {
      await window.gym.registrations.end({ id: endTarget.id, endsOn })
      setEndTarget(null); setMessage('Inscription clôturée. L’historique reste consultable.')
      await refresh()
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  const filtered = rows.filter((row) => `${row.given_name} ${row.surname} ${row.sport_name}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="page-stack">
      <div className="page-heading"><div><p className="eyebrow">DISCIPLINES & ADHÉSIONS</p><h1>Inscriptions</h1><p className="muted">Chaque inscription conserve sa discipline, son tarif mensuel et sa période de validité.</p></div><button className="primary-button" onClick={() => { setError(''); setAthleteId(''); setSportId(''); setJudoCategory(''); setStartsOn(inputDateToday()); setModal(true) }}><Plus size={17} /> Nouvelle inscription</button></div>
      {message && <button className="notice success-notice" onClick={() => setMessage('')}>{message} <span>×</span></button>}
      {error && !modal && !endTarget && <div className="notice error-notice">{error}</div>}
      <section className="panel list-panel">
        <div className="list-toolbar"><label className="search-field"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un athlète ou une discipline…" /></label>
          <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Toutes les inscriptions</option><option value="active">Actives</option><option value="ended">Terminées</option></select>
          <span className="result-count">{filtered.length} inscription{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="table-wrap"><table><thead><tr><th>ATHLÈTE</th><th>DISCIPLINE</th><th>CATÉGORIE JUDO</th><th>DATE DE DÉBUT</th><th>TARIF MENSUEL</th><th>STATUT</th><th className="align-right">ACTION</th></tr></thead><tbody>
          {filtered.map((row) => <tr key={row.id}><td><strong>{row.given_name} {row.surname}</strong></td><td><span className="sport-tag">{row.sport_name}</span></td><td>{row.judo_category ? `Catégorie ${row.judo_category}` : '—'}</td><td>{dateLabel(row.starts_on)}{row.ends_on ? ` — ${dateLabel(row.ends_on)}` : ''}</td><td className="amount-cell">{money(row.monthly_fee_minor)}</td><td><span className={`status-pill ${row.status === 'active' ? 'success' : 'neutral'}`}>{row.status === 'active' ? 'Active' : 'Terminée'}</span></td><td className="align-right">{row.status === 'active' && <button className="small-action" onClick={() => { setEndTarget(row); setEndsOn(inputDateToday()); setError('') }}>Clôturer</button>}</td></tr>)}
          {!filtered.length && <tr><td colSpan={7} className="empty-table"><CalendarCheck size={24} /><strong>Aucune inscription</strong><span>Créez une inscription ou adaptez les filtres.</span></td></tr>}
        </tbody></table></div>
      </section>
      {modal && <Modal title="Nouvelle inscription" description="Un tarif configuré est nécessaire pour encaisser les paiements." onClose={() => setModal(false)}>
        <form className="form-body" onSubmit={(event) => void submit(event)}>
          {error && <div className="notice error-notice">{error}</div>}
          <label className="field"><span>Athlète <b>*</b></span><select required value={athleteId} onChange={(e) => setAthleteId(e.target.value)}><option value="">Sélectionner un athlète</option>{athletes.map((a) => <option key={a.id} value={a.id}>{a.given_name} {a.surname}</option>)}</select></label>
          <label className="field"><span>Discipline <b>*</b></span><select required value={sportId} onChange={(e) => { setSportId(e.target.value); setJudoCategory('') }}><option value="">Sélectionner une discipline</option>{sports.map((s) => <option key={s.id} value={s.id}>{s.name} — tarif actuel : {money(s.monthly_fee_minor)}</option>)}</select></label>
          {isJudo && <label className="field"><span>Catégorie de judo <b>*</b></span><select required value={judoCategory} onChange={(e) => setJudoCategory(e.target.value as '100 DHS' | '120 DHS' | '')}><option value="">Sélectionner une catégorie</option><option value="100 DHS">Catégorie à 100 DHS / mois</option><option value="120 DHS">Catégorie à 120 DHS / mois</option></select></label>}
          <label className="field"><span>Date de début <b>*</b></span><input required type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></label>
          <div className="notice info-notice">{isJudo ? 'Le tarif de la catégorie choisie (100 ou 120 DHS par mois) est enregistré avec l’inscription.' : 'Le tarif courant est copié dans l’inscription. Les modifications futures des tarifs ne changeront pas cet historique.'}</div>
          <div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setModal(false)}>Annuler</button><button className="primary-button" disabled={busy}>{busy ? 'Enregistrement…' : 'Créer l’inscription'}</button></div>
        </form>
      </Modal>}
      {endTarget && <Modal title="Clôturer l’inscription" description={`${endTarget.given_name} ${endTarget.surname} · ${endTarget.sport_name}`} onClose={() => setEndTarget(null)}>
        <form className="form-body" onSubmit={(event) => void closeRegistration(event)}>
          {error && <div className="notice error-notice">{error}</div>}
          <label className="field"><span>Date de fin <b>*</b></span><input required type="date" min={endTarget.starts_on} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} /></label>
          <div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setEndTarget(null)}>Annuler</button><button className="primary-button" disabled={busy}>{busy ? 'Enregistrement…' : 'Confirmer la clôture'}</button></div>
        </form>
      </Modal>}
    </div>
  )
}
