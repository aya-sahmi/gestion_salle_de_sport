import { useEffect, useState, type FormEvent } from 'react'
import { Building2, Save, Tags } from 'lucide-react'
import { money } from '../lib/format'
import type { GymSettings, Sport } from '../types'

export function Settings() {
  const [settings, setSettings] = useState<GymSettings>({ gymName: '', address: '', phone: '', email: '', currency: 'MAD' })
  const [sports, setSports] = useState<Sport[]>([])
  const [fees, setFees] = useState<Record<number, string>>({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    window.gym.settings.get().then(setSettings).catch((reason: Error) => setError(reason.message))
    window.gym.sports.list().then((data) => {
      setSports(data)
      setFees(Object.fromEntries(data.map((sport) => [sport.id, (sport.monthly_fee_minor / 100).toFixed(2)])))
    }).catch((reason: Error) => setError(reason.message))
  }, [])
  const saveSettings = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      setSettings(await window.gym.settings.update(settings))
      setMessage('Les informations de la salle ont été enregistrées.')
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  const saveFees = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const updates = sports.map((sport) => {
        const raw = fees[sport.id].replace(',', '.')
        if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error(`Tarif invalide pour ${sport.name}. Utilisez un montant avec au plus deux décimales.`)
        const minor = Math.round(Number(raw) * 100)
        return { id: sport.id, monthlyFeeMinor: minor }
      })
      setSports(await window.gym.sports.updateFees(updates))
      setMessage('Les tarifs par défaut ont été mis à jour. Les anciennes inscriptions conservent leur tarif.')
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="page-stack">
      <div className="page-heading"><div><p className="eyebrow">CONFIGURATION DE L’APPLICATION</p><h1>Paramètres</h1><p className="muted">Personnalisez les informations utilisées sur vos reçus et définissez vos tarifs courants.</p></div></div>
      {error && <div className="notice error-notice">{error}</div>}
      {message && <div className="notice success-notice">{message}</div>}
      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="settings-title"><div className="settings-icon"><Building2 size={20} /></div><div><h2>Informations de la salle</h2><p>Ces informations seront affichées sur les reçus.</p></div></div>
          <form className="form-body" onSubmit={(event) => void saveSettings(event)}>
            <label className="field"><span>Nom de la salle <b>*</b></span><input required maxLength={120} value={settings.gymName} onChange={(e) => setSettings({ ...settings, gymName: e.target.value })} /></label>
            <label className="field"><span>Adresse</span><textarea rows={2} maxLength={300} value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></label>
            <div className="form-grid"><label className="field"><span>Téléphone</span><input type="tel" maxLength={40} value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></label><label className="field"><span>E-mail</span><input type="email" maxLength={120} value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} /></label></div>
            <div className="settings-currency"><span>Devise</span><strong>Dirham marocain (MAD)</strong><small>Les montants sont conservés en centimes pour éviter les erreurs d’arrondi.</small></div>
            <button className="primary-button align-self-end" disabled={busy}><Save size={16} /> Enregistrer les informations</button>
          </form>
        </section>
        <section className="panel settings-panel">
          <div className="settings-title"><div className="settings-icon teal"><Tags size={20} /></div><div><h2>Tarifs mensuels</h2><p>Tarifs par défaut pour les nouvelles inscriptions.</p></div></div>
          <div className="fee-list">{sports.map((sport) => <label className="fee-row" key={sport.id}><div><strong>{sport.name}</strong><span>Tarif en vigueur : {money(sport.monthly_fee_minor)}</span></div><div className="money-input"><input type="number" min="0" step="0.01" value={fees[sport.id] ?? ''} onChange={(e) => setFees({ ...fees, [sport.id]: e.target.value })} /><span>MAD</span></div></label>)}</div>
          <div className="notice info-notice">Un changement de tarif ne modifie ni les inscriptions déjà créées, ni les paiements enregistrés.</div>
          <button className="primary-button align-self-end" disabled={busy || !sports.length} onClick={() => void saveFees()}><Save size={16} /> Enregistrer les tarifs</button>
        </section>
      </div>
    </div>
  )
}
