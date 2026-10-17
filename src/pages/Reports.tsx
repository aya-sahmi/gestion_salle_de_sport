import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { dateLabel, inputDateToday, money, monthNames } from '../lib/format'
import type { Sport } from '../types'

type RevenueRow = { date: string; sport: string; payments: number; amount: number }
type PaidMonthRow = { year: number; month: number; sport: string; payments: number; amount: number }
type OverdueRow = {
  athlete_id: number; surname: string; given_name: string; registration_id: number
  sport_name: string; monthly_fee_minor: number; months_due: Array<{ year: number; month: number }>
  outstanding_minor: number
}
export function Reports() {
  const today = inputDateToday()
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(today)
  const [paidYear, setPaidYear] = useState(Number(today.slice(0, 4)))
  const [sportId, setSportId] = useState('')
  const [sports, setSports] = useState<Sport[]>([])
  const [rows, setRows] = useState<RevenueRow[]>([])
  const [paidMonths, setPaidMonths] = useState<PaidMonthRow[]>([])
  const [overdue, setOverdue] = useState<OverdueRow[]>([])
  const [error, setError] = useState('')
  useEffect(() => { window.gym.sports.list().then(setSports).catch((reason: Error) => setError(reason.message)) }, [])
  useEffect(() => {
    window.gym.reports.revenue({ from, to, ...(sportId ? { sportId: Number(sportId) } : {}) })
      .then((result) => { setRows(result); setError('') })
      .catch((reason: Error) => setError(reason.message))
  }, [from, to, sportId])
  useEffect(() => {
    window.gym.reports.byPaidMonth({ year: paidYear, ...(sportId ? { sportId: Number(sportId) } : {}) })
      .then(setPaidMonths).catch((reason: Error) => setError(reason.message))
    window.gym.reports.overdue().then(setOverdue).catch((reason: Error) => setError(reason.message))
  }, [paidYear, sportId])
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  const count = rows.reduce((sum, row) => sum + row.payments, 0)
  const exportCsv = () => {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
    const content = [
      ['Date', 'Discipline', 'Nombre de paiements', 'Montant encaissé (centimes)'].map(escape).join(';'),
      ...rows.map((row) => [row.date, row.sport, String(row.payments), String(row.amount)].map(escape).join(';')),
      ['TOTAL', '', String(count), String(total)].map(escape).join(';'),
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `rapport-recettes-${from}-${to}.csv`; anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="page-stack">
      <div className="print-only"><h1>Rapport financier — Salle Sport</h1><p>Période : {dateLabel(from)} au {dateLabel(to)}</p></div>
      <div className="page-heading no-print"><div><p className="eyebrow">ANALYSE FINANCIÈRE</p><h1>Rapports</h1><p className="muted">Les recettes affichées excluent tous les paiements annulés.</p></div><div className="button-row"><button className="secondary-button" onClick={() => window.print()}><Printer size={16} /> Imprimer / PDF</button><button className="primary-button" disabled={!rows.length} onClick={exportCsv}><Download size={16} /> Exporter CSV</button></div></div>
      {error && <div className="notice error-notice">{error}</div>}
      <section className="panel report-filter-panel no-print">
        <div className="report-filters"><label className="field"><span>Date de début</span><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label><label className="field"><span>Date de fin</span><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label><label className="field"><span>Discipline</span><select value={sportId} onChange={(e) => setSportId(e.target.value)}><option value="">Toutes</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label><label className="field"><span>Année du mois payé</span><select value={paidYear} onChange={(e) => setPaidYear(Number(e.target.value))}>{Array.from({ length: 9 }, (_, i) => new Date().getFullYear() - 4 + i).map((year) => <option key={year}>{year}</option>)}</select></label></div>
      </section>
      <section className="stats-grid report-stats">
        <article className="stat-card"><div className="stat-icon green"><FileSpreadsheet size={20} /></div><p className="stat-label">Montant net encaissé</p><div className="stat-value">{money(total)}</div><p className="stat-sub">{dateLabel(from)} — {dateLabel(to)}</p></article>
        <article className="stat-card"><div className="stat-icon violet"><Download size={20} /></div><p className="stat-label">Paiements validés</p><div className="stat-value">{count}</div><p className="stat-sub">Les annulations sont exclues</p></article>
      </section>
      <section className="panel table-panel">
        <div className="panel-heading"><div><h2>Détail des recettes</h2><p>Regroupement par jour et discipline</p></div><span className="panel-badge">{rows.length} lignes</span></div>
        <div className="table-wrap"><table><thead><tr><th>DATE D’ENCAISSEMENT</th><th>DISCIPLINE</th><th>PAIEMENTS</th><th className="align-right">RECETTES NETTES</th></tr></thead><tbody>
          {rows.map((row, i) => <tr key={`${row.date}-${row.sport}-${i}`}><td>{dateLabel(row.date)}</td><td><span className="sport-tag">{row.sport}</span></td><td>{row.payments}</td><td className="align-right amount-cell">{money(row.amount)}</td></tr>)}
          {!rows.length && <tr><td colSpan={4} className="empty-table">Aucune recette validée sur cette période.</td></tr>}
        </tbody><tfoot><tr><td colSpan={2}><strong>Total de la période</strong></td><td><strong>{count}</strong></td><td className="align-right amount-cell"><strong>{money(total)}</strong></td></tr></tfoot></table></div>
      </section>
      <section className="panel table-panel">
        <div className="panel-heading"><div><h2>Recettes par mois réglé</h2><p>Mois de service payé pendant {paidYear} · tarifs réellement encaissés</p></div><span className="panel-badge">{paidMonths.length} lignes</span></div>
        <div className="table-wrap"><table><thead><tr><th>MOIS RÉGLÉ</th><th>DISCIPLINE</th><th>PAIEMENTS</th><th className="align-right">MONTANT ENCAISSÉ</th></tr></thead><tbody>
          {paidMonths.map((row, index) => <tr key={`${row.year}-${row.month}-${row.sport}-${index}`}><td>{monthNames[row.month - 1]} {row.year}</td><td>{row.sport}</td><td>{row.payments}</td><td className="align-right amount-cell">{money(row.amount)}</td></tr>)}
          {!paidMonths.length && <tr><td colSpan={4} className="empty-table">Aucun mois réglé sur cette année.</td></tr>}
        </tbody></table></div>
      </section>
      <section className="panel table-panel">
        <div className="panel-heading"><div><h2>Échéances en retard</h2><p>Mois échus et non réglés pour les athlètes actifs</p></div><span className="status-pill danger">{overdue.reduce((sum, row) => sum + row.months_due.length, 0)} mois</span></div>
        <div className="table-wrap"><table><thead><tr><th>ATHLÈTE</th><th>DISCIPLINE</th><th>MOIS IMPAYÉS</th><th className="align-right">RESTE DÛ</th></tr></thead><tbody>
          {overdue.map((row) => <tr key={row.registration_id}><td><strong>{row.given_name} {row.surname}</strong></td><td>{row.sport_name}</td><td>{row.months_due.map((month) => `${monthNames[month.month - 1]} ${month.year}`).join(', ')}</td><td className="align-right amount-cell">{money(row.outstanding_minor)}</td></tr>)}
          {!overdue.length && <tr><td colSpan={4} className="empty-table">Aucun mois impayé échu pour les athlètes actifs.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  )
}
