import { useState } from 'react'
import { Archive, CheckCircle2, Download, HardDrive, ShieldCheck, Upload } from 'lucide-react'

export function Backup() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const create = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await window.gym.backups.create()
      if (!result.canceled) setMessage(`Sauvegarde créée : ${result.path}`)
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  const restore = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await window.gym.backups.restore()
      if (!result.canceled) setMessage('La sauvegarde a été restaurée et la base relue avec succès.')
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="page-stack">
      <div className="page-heading"><div><p className="eyebrow">PROTECTION DES DONNÉES</p><h1>Sauvegarde & restauration</h1><p className="muted">Protégez vos informations financières avec une copie cohérente de la base locale.</p></div></div>
      {error && <div className="notice error-notice">{error}</div>}
      {message && <div className="notice success-notice"><CheckCircle2 size={17} />{message}</div>}
      <div className="backup-banner"><div className="backup-banner-icon"><ShieldCheck size={25} /></div><div><strong>Vos données restent sur cet ordinateur</strong><p>La base active est stockée dans le dossier utilisateur de Windows et conservée lors des mises à jour.</p></div><span className="offline-pill"><i /> Hors ligne</span></div>
      <div className="backup-grid">
        <section className="panel backup-card"><div className="backup-icon"><Download size={22} /></div><h2>Créer une sauvegarde</h2><p>Enregistrez une copie vérifiée de la base SQLite sur cet ordinateur ou sur un support externe, comme une clé USB.</p><ul><li><CheckCircle2 size={15} /> Copie cohérente même pendant l’utilisation</li><li><CheckCircle2 size={15} /> Fichier SQLite portable</li><li><CheckCircle2 size={15} /> Choix de l’emplacement sécurisé</li></ul><button className="primary-button" disabled={busy} onClick={() => void create()}><Archive size={16} /> {busy ? 'Traitement…' : 'Choisir où sauvegarder'}</button></section>
        <section className="panel backup-card"><div className="backup-icon amber"><Upload size={22} /></div><h2>Restaurer une sauvegarde</h2><p>La sauvegarde est contrôlée avant son installation. Une copie de sécurité de la base actuelle est conservée.</p><ul><li><CheckCircle2 size={15} /> Vérification SQLite d’intégrité</li><li><CheckCircle2 size={15} /> Confirmation avant remplacement</li><li><CheckCircle2 size={15} /> Retour arrière possible en cas d’erreur</li></ul><button className="secondary-button" disabled={busy} onClick={() => void restore()}><HardDrive size={16} /> {busy ? 'Traitement…' : 'Sélectionner une sauvegarde'}</button></section>
      </div>
      <div className="notice warning-notice"><Archive size={17} /> Conservez une copie récente sur un support distinct de l’ordinateur. La restauration remplace les données actuelles après confirmation.</div>
    </div>
  )
}
