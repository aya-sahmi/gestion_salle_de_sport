import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, CircleAlert, CreditCard, Search } from 'lucide-react'
import { Modal } from '../components/Modal'
import { ReceiptDialog } from '../components/ReceiptDialog'
import { money, monthNames } from '../lib/format'
import type { Athlete, GymSettings, MonthStatus, Payment, Registration } from '../types'

export function Payments() {
  const current = new Date()
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [athleteId, setAthleteId] = useState('')
  const [registrationId, setRegistrationId] = useState('')
  const [year, setYear] = useState(current.getFullYear())
  const [status, setStatus] = useState<MonthStatus[]>([])
  const [months, setMonths] = useState<number[]>([])
  const [method, setMethod] = useState('Espèces')
  const [search, setSearch] = useState('')
  const [review, setReview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const [settings, setSettings] = useState<GymSettings>({ gymName: 'Salle Sport', address: '', phone: '', email: '', currency: 'MAD' })
  useEffect(() => {
    window.gym.athletes.list({ active: true }).then(setAthletes).catch((reason: Error) => setError(reason.message))
    window.gym.registrations.list({ status: 'active' }).then(setRegistrations).catch((reason: Error) => setError(reason.message))
    window.gym.settings.get().then(setSettings).catch((reason: Error) => setError(reason.message))
  }, [])
  const eligibleAthletes = useMemo(() => athletes.filter((athlete) => registrations.some((r) => r.athlete_id === athlete.id)), [athletes, registrations])
  const visibleAthletes = eligibleAthletes.filter((athlete) => `${athlete.given_name} ${athlete.surname} ${athlete.phone || ''}`.toLowerCase().includes(search.toLowerCase()))
  const athleteRegistrations = registrations.filter((row) => row.athlete_id === Number(athleteId))
  const selectedRegistration = athleteRegistrations.find((row) => row.id === Number(registrationId))
  useEffect(() => {
    if (!registrationId) return
    window.gym.payments.monthStatus({ registrationId: Number(registrationId), year })
      .then((result) => { setStatus(result); setMonths([]) })
      .catch((reason: Error) => setError(reason.message))
  }, [registrationId, year])
  const selectedTotal = months.length * (selectedRegistration?.monthly_fee_minor || 0)
  const toggleMonth = (month: number) => setMonths((currentMonths) =>
    currentMonths.includes(month) ? currentMonths.filter((value) => value !== month) : [...currentMonths, month].sort((a, b) => a - b),
  )
  const submit = () => {
    if (!months.length) { setError('Sélectionnez au moins un mois impayé.'); return }
    setReview(true); setError('')
  }
  const confirmPayment = async () => {
    if (!selectedRegistration) return
    setSaving(true); setError('')
    try {
      const created = await window.gym.payments.create({
        registrationId: selectedRegistration.id, year, months, paymentMethod: method,
      })
      setReview(false); setMessage(`Paiement enregistré avec succès · ${created.receipt_no}`)
      setReceipt(created)
      setStatus(await window.gym.payments.monthStatus({ registrationId: selectedRegistration.id, year }))
      setMonths([])
    } catch (reason) { setError((reason as Error).message) } finally { setSaving(false) }
  }
  const availableYears = Array.from({ length: 9 }, (_, i) => current.getFullYear() - 4 + i)
  return (
    <div className="page-stack">
      <div className="page-heading"><div><p className="eyebrow">ENCAISSEMENT</p><h1>Nouveau paiement</h1><p className="muted">Choisissez l’athlète, les mois impayés et validez l’encaissement.</p></div><div className="secure-mark"><span /> Écriture sécurisée SQLite</div></div>
      {message && <button className="notice success-notice" onClick={() => setMessage('')}><Check size={16} /> {message}<span>×</span></button>}
      {error && !review && <div className="notice error-notice"><CircleAlert size={17} />{error}</div>}
      <div className="payment-layout">
        <section className="panel athlete-picker">
          <div className="panel-heading"><div><h2>1. Sélectionner un athlète</h2><p>{eligibleAthletes.length} athlètes avec inscription active</p></div></div>
          <label className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, prénom ou téléphone…" /></label>
          <div className="athlete-choice-list">
            {visibleAthletes.map((athlete) => <button key={athlete.id} className={`athlete-choice ${Number(athleteId) === athlete.id ? 'selected' : ''}`} onClick={() => { setAthleteId(String(athlete.id)); setRegistrationId(''); setError('') }}>
              <div className="person-avatar">{athlete.given_name[0]}{athlete.surname[0]}</div><div><strong>{athlete.given_name} {athlete.surname}</strong><span>{athlete.phone || 'Téléphone non renseigné'}</span></div><ArrowRight size={16} />
            </button>)}
            {!visibleAthletes.length && <p className="empty-inline">Aucun athlète actif avec inscription ne correspond.</p>}
          </div>
        </section>
        <section className="panel months-panel">
          <div className="panel-heading"><div><h2>2. Sélectionner les mois</h2><p>{selectedRegistration ? `${selectedRegistration.sport_name} · tarif ${money(selectedRegistration.monthly_fee_minor)}/mois` : 'Choisissez un athlète et sa discipline'}</p></div></div>
          <div className="payment-controls">
            <label className="field"><span>Discipline / inscription</span><select value={registrationId} onChange={(e) => { setStatus([]); setMonths([]); setRegistrationId(e.target.value) }} disabled={!athleteId}><option value="">Choisir une inscription</option>{athleteRegistrations.map((row) => <option key={row.id} value={row.id}>{row.sport_name} · depuis {row.starts_on}</option>)}</select></label>
            <label className="field"><span>Année concernée</span><select value={year} onChange={(e) => setYear(Number(e.target.value))}>{availableYears.map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>
          <div className="month-grid">
            {monthNames.map((name, index) => {
              const monthStatus = status.find((row) => row.month === index + 1)
              const disabled = !monthStatus || monthStatus.status !== 'unpaid'
              return <button type="button" key={name} disabled={disabled} onClick={() => toggleMonth(index + 1)} className={`month-card ${monthStatus?.status || 'disabled'} ${months.includes(index + 1) ? 'checked' : ''}`}>
                <span className="month-check">{months.includes(index + 1) ? <Check size={14} /> : monthStatus?.status === 'paid' ? <Check size={14} /> : null}</span>
                <strong>{name}</strong><small>{monthStatus?.status === 'paid' ? 'Payé' : monthStatus?.status === 'not-applicable' ? 'Non applicable' : monthStatus?.status === 'unpaid' ? 'Impayé' : '—'}</small>
              </button>
            })}
          </div>
          <div className="month-legend"><span><i className="legend-paid" /> Payé</span><span><i className="legend-unpaid" /> Impayé</span><span><i className="legend-na" /> Non applicable</span></div>
          <div className="payment-summary">
            <label className="field"><span>Mode de paiement</span><select value={method} onChange={(e) => setMethod(e.target.value)}><option>Espèces</option><option>Carte</option><option>Virement</option><option>Chèque</option></select></label>
            <div className="summary-total"><span>{months.length} mois sélectionné{months.length !== 1 ? 's' : ''}</span><strong>{money(selectedTotal)}</strong></div>
            <button type="button" className="primary-button" disabled={!selectedRegistration || !months.length} onClick={submit}><CreditCard size={17} /> Vérifier le paiement</button>
          </div>
        </section>
      </div>
      {review && selectedRegistration && <Modal title="Confirmer l’encaissement" description="Vérifiez le récapitulatif avant l’enregistrement définitif." onClose={() => setReview(false)}>
        {error && <div className="notice error-notice">{error}</div>}
        <div className="review-list">
          <div><span>Athlète</span><strong>{eligibleAthletes.find((a) => a.id === Number(athleteId))?.given_name} {eligibleAthletes.find((a) => a.id === Number(athleteId))?.surname}</strong></div>
          <div><span>Discipline</span><strong>{selectedRegistration.sport_name}</strong></div>
          <div><span>Mois réglés</span><strong>{months.map((m) => `${monthNames[m - 1]} ${year}`).join(', ')}</strong></div>
          <div><span>Mode</span><strong>{method}</strong></div>
          <div className="review-total"><span>Total encaissé</span><strong>{money(selectedTotal)}</strong></div>
        </div>
        <div className="notice warning-notice"><CircleAlert size={17} />Après validation, le numéro de reçu sera réservé et les mois ne pourront être réglés une seconde fois.</div>
        <div className="modal-footer"><button className="secondary-button" onClick={() => setReview(false)}>Retour</button><button className="primary-button" disabled={saving} onClick={() => void confirmPayment()}>{saving ? 'Enregistrement…' : 'Confirmer le paiement'}</button></div>
      </Modal>}
      {receipt && <ReceiptDialog payment={receipt} settings={settings} onClose={() => setReceipt(null)} />}
    </div>
  )
}
