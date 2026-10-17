import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarDays, CircleAlert, CreditCard, Users, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dateLabel, money, monthNames } from '../lib/format'
import type { DashboardSummary } from '../types'

export function Dashboard() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    window.gym.dashboard.summary({ year, month }).then(setData).catch((reason: Error) => setError(reason.message))
  }, [year, month])
  const cards = data ? [
    { label: 'Athlètes inscrits', value: data.athletes_total, sub: `${data.athletes_active} actifs`, icon: Users, tone: 'blue' },
    { label: 'Recettes du mois', value: money(data.revenue), sub: `${data.paymentCount} paiements enregistrés`, icon: Wallet, tone: 'green' },
    { label: 'Paiements reçus', value: data.paymentCount, sub: `${monthNames[month - 1]} ${year}`, icon: CreditCard, tone: 'violet' },
    { label: 'Mois en retard', value: data.overdue, sub: 'Échéances non réglées à ce jour', icon: CircleAlert, tone: 'orange' },
  ] : []
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><p className="eyebrow">VUE D’ENSEMBLE</p><h1>Bonjour, bienvenue 👋</h1><p className="muted">Voici la situation de votre salle de sport.</p></div>
        <div className="period-select">
          <CalendarDays size={17} />
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Mois">
            {monthNames.map((name, i) => <option value={i + 1} key={name}>{name}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Année">
            {Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
      </div>
      {error && <div className="notice error-notice">{error}</div>}
      <section className="stats-grid">
        {cards.map(({ label, value, sub, icon: Icon, tone }) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon ${tone}`}><Icon size={20} /></div>
            <p className="stat-label">{label}</p>
            <div className="stat-value">{data ? value : '—'}</div>
            <p className="stat-sub">{sub}</p>
            <div className={`stat-trend ${tone}`}><ArrowUpRight size={15} /> Données locales</div>
          </article>
        ))}
      </section>
      <section className="dashboard-columns">
        <article className="panel discipline-panel">
          <div className="panel-heading"><div><h2>Inscriptions par discipline</h2><p>Adhérents actifs</p></div><span className="panel-badge">4 disciplines</span></div>
          <div className="discipline-list">
            {(data?.disciplineCounts || []).map((sport, i) => {
              const colors = ['#4768d8', '#e69a37', '#22a17b', '#8d63c7']
              const icons = ['柔', 'A', 'L', 'FC']
              const max = Math.max(1, ...((data?.disciplineCounts || []).map((item) => item.athletes)))
              return <div className="discipline-row" key={sport.id}>
                <div className="discipline-symbol" style={{ color: colors[i], background: `${colors[i]}14` }}>{icons[i]}</div>
                <div className="discipline-main"><div className="discipline-title"><strong>{sport.name}</strong><span>{sport.athletes} athlètes</span></div><div className="progress-track"><span style={{ width: `${Math.min(100, (sport.athletes / max) * 100)}%`, background: colors[i] }} /></div></div>
              </div>
            })}
            {!data && <p className="empty-inline">Chargement des disciplines…</p>}
          </div>
        </article>
        <article className="panel revenue-panel">
          <div className="panel-heading"><div><h2>Recettes par discipline</h2><p>Encaissements validés sur la période</p></div><span className="chart-mark"><ArrowDownRight size={17} /></span></div>
          <div className="revenue-total">{data ? money(data.revenue) : '—'} <span>total encaissé</span></div>
          <div className="revenue-bars">
            {(data?.bySport || []).map((item, i) => {
              const colors = ['#4768d8', '#e69a37', '#22a17b', '#8d63c7']
              const maximum = Math.max(1, ...((data?.bySport || []).map((row) => row.amount)))
              return <div className="bar-column" key={item.name}><div className="bar-value">{money(item.amount)}</div><div className="bar-track"><span style={{ height: `${Math.max(item.amount ? 8 : 0, item.amount / maximum * 100)}%`, background: colors[i] }} /></div><span className="bar-label">{item.name}</span></div>
            })}
          </div>
        </article>
      </section>
      <section className="panel table-panel">
        <div className="panel-heading"><div><h2>Derniers paiements</h2><p>Activité financière récente</p></div><Link to="/historique" className="text-link">Voir l’historique <ArrowUpRight size={15} /></Link></div>
        <div className="table-wrap">
          <table><thead><tr><th>Reçu</th><th>Athlète</th><th>Discipline</th><th>Date</th><th>Mois réglés</th><th>Montant</th><th>Statut</th></tr></thead>
            <tbody>{data?.recentPayments.map((payment) => <tr key={payment.id}>
              <td className="receipt-id">{payment.receipt_no}</td><td><strong>{payment.given_name} {payment.surname}</strong></td><td>{payment.sport_name}</td><td>{dateLabel(payment.paid_at)}</td><td>{String(payment.months || '—')}</td><td className="amount-cell">{money(payment.amount_minor)}</td><td><span className={`status-pill ${payment.status === 'validated' ? 'success' : 'danger'}`}>{payment.status === 'validated' ? 'Payé' : 'Annulé'}</span></td>
            </tr>)}
            {data && !data.recentPayments.length && <tr><td colSpan={7} className="empty-table">Aucun paiement enregistré pour le moment.</td></tr>}
            {!data && <tr><td colSpan={7} className="empty-table">Chargement des paiements…</td></tr>}
          </tbody></table>
        </div>
      </section>
    </div>
  )
}
