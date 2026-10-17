import { useCallback, useEffect, useState } from 'react'
import { Eye, Printer, Search, XCircle } from 'lucide-react'
import { Modal } from '../components/Modal'
import { ReceiptDialog } from '../components/ReceiptDialog'
import { dateLabel, money } from '../lib/format'
import type { GymSettings, Payment, Sport } from '../types'

export function PaymentHistory() {
  const [rows, setRows] = useState<Payment[]>([])
  const [sports, setSports] = useState<Sport[]>([])
  const [settings, setSettings] = useState<GymSettings>({ gymName: 'Salle Sport', address: '', phone: '', email: '', currency: 'MAD' })
  const [search, setSearch] = useState('')
  const [sportId, setSportId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<Payment | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(() => window.gym.payments.list({ search, ...(sportId ? { sportId: Number(sportId) } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) })
    .then(setRows).catch((reason: Error) => setError(reason.message))
  , [search, sportId, from, to])
  useEffect(() => {
    void refresh()
    window.gym.sports.list().then(setSports).catch((reason: Error) => setError(reason.message))
    window.gym.settings.get().then(setSettings).catch((reason: Error) => setError(reason.message))
  }, [refresh, search, sportId, from, to])
  const openReceipt = async (payment: Payment) => {
    setError('')
    try { setSelected(await window.gym.payments.get(payment.id)) }
    catch (reason) { setError((reason as Error).message) }
  }
  const cancel = async () => {
    if (!cancelTarget) return
    setBusy(true); setError('')
    try {
      await window.gym.payments.cancel({ id: cancelTarget.id, reason })
      setCancelTarget(null); setReason(''); setMessage(`Le paiement ${cancelTarget.receipt_no} a été annulé. Le reçu reste dans l’historique.`)
      await refresh()
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="page-stack">
      <div className="page-heading"><div><p className="eyebrow">TRAÇABILITÉ FINANCIÈRE</p><h1>Historique des paiements</h1><p className="muted">Les paiements annulés restent visibles et ne sont pas comptés dans les recettes.</p></div></div>
      {message && <button className="notice success-notice" onClick={() => setMessage('')}>{message} <span>×</span></button>}
      {error && !cancelTarget && <div className="notice error-notice">{error}</div>}
      <section className="panel list-panel">
        <div className="list-toolbar">
          <label className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, prénom ou numéro de reçu…" /></label>
          <select className="filter-select" value={sportId} onChange={(e) => setSportId(e.target.value)}><option value="">Toutes les disciplines</option>{sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <label className="date-filter"><span>Du</span><input aria-label="Date de début" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="date-filter"><span>Au</span><input aria-label="Date de fin" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="table-wrap"><table><thead><tr><th>N° REÇU</th><th>ATHLÈTE</th><th>DISCIPLINE</th><th>DATE</th><th>MOIS RÉGLÉS</th><th>MONTANT</th><th>STATUT</th><th className="align-right">ACTIONS</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id}><td className="receipt-id">{row.receipt_no}</td><td><strong>{row.given_name} {row.surname}</strong></td><td>{row.sport_name}</td><td>{dateLabel(row.paid_at)}</td><td>{Array.isArray(row.months) ? row.months.map((month) => `${month.month}/${month.year}`).join(', ') : row.months || '—'}</td><td className={`amount-cell ${row.status === 'cancelled' ? 'struck' : ''}`}>{money(row.amount_minor, settings.currency)}</td><td><span className={`status-pill ${row.status === 'validated' ? 'success' : 'danger'}`}>{row.status === 'validated' ? 'Validé' : 'Annulé'}</span></td><td><div className="row-actions"><button className="icon-button" title="Consulter le reçu" onClick={() => void openReceipt(row)}><Eye size={17} /></button><button className="icon-button" title="Réimprimer" onClick={() => void openReceipt(row)}><Printer size={16} /></button>{row.status === 'validated' && <button className="icon-button danger-icon" title="Annuler le paiement" onClick={() => { setCancelTarget(row); setError('') }}><XCircle size={17} /></button>}</div></td></tr>)}
          {!rows.length && <tr><td colSpan={8} className="empty-table"><Search size={24} /><strong>Aucun paiement trouvé</strong><span>Les résultats correspondant à vos filtres apparaîtront ici.</span></td></tr>}
        </tbody></table></div>
      </section>
      {selected && <ReceiptDialog payment={selected} settings={settings} onClose={() => setSelected(null)} />}
      {cancelTarget && <Modal title="Annuler un paiement" description={`Reçu ${cancelTarget.receipt_no} · ${cancelTarget.given_name} ${cancelTarget.surname}`} onClose={() => setCancelTarget(null)}>
        {error && <div className="notice error-notice">{error}</div>}
        <div className="notice warning-notice">Cette opération est tracée et ne supprime pas le reçu. Les mois concernés redeviendront impayés.</div>
        <label className="field"><span>Motif de l’annulation <b>*</b></span><textarea rows={4} maxLength={500} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Expliquez la raison de l’annulation…" /></label>
        <div className="modal-footer"><button className="secondary-button" onClick={() => setCancelTarget(null)}>Conserver le paiement</button><button className="danger-button" disabled={busy || !reason.trim()} onClick={() => void cancel()}>{busy ? 'Annulation…' : 'Confirmer l’annulation'}</button></div>
      </Modal>}
    </div>
  )
}
