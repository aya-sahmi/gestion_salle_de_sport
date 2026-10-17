import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Eye, Pencil, Plus, Search, UserRound, UserRoundX } from 'lucide-react'
import { Modal } from '../components/Modal'
import { dateLabel, inputDateToday, money } from '../lib/format'
import type { Athlete, AthleteInput, Registration, Payment, Sport } from '../types'

const blank: AthleteInput = {
  surname: '', givenName: '', birthDate: '', sex: '', address: '', phone: '',
  schoolLevel: '', guardianName: '', guardianPhone: '',
}

export function Athletes() {
  const [rows, setRows] = useState<Athlete[]>([])
  const [sports, setSports] = useState<Sport[]>([])
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [sportFilter, setSportFilter] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | 'detail' | null>(null)
  const [selected, setSelected] = useState<Athlete | null>(null)
  const [detail, setDetail] = useState<(Athlete & { registrations: Registration[]; payments: Payment[] }) | null>(null)
  const [form, setForm] = useState<AthleteInput>(blank)
  const [sportId, setSportId] = useState('')
  const [judoCategory, setJudoCategory] = useState<'100 DHS' | '120 DHS' | ''>('')
  const [registrationStartsOn, setRegistrationStartsOn] = useState(inputDateToday())
  const [isActive, setIsActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const selectedSport = sports.find((sport) => sport.id === Number(sportId))
  const isJudo = selectedSport?.name.trim().toLowerCase() === 'judo'
  const refresh = useCallback(() => window.gym.athletes.list({
    search,
    ...(sportFilter ? { sportId: Number(sportFilter) } : {}),
    ...(activeFilter ? { active: activeFilter === 'active' } : {}),
  }).then(setRows).catch((reason: Error) => setError(reason.message)), [search, activeFilter, sportFilter])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { window.gym.sports.list().then(setSports).catch((reason: Error) => setError(reason.message)) }, [])

  const openForm = (athlete?: Athlete) => {
    setSelected(athlete || null)
    setForm(athlete ? {
      surname: athlete.surname, givenName: athlete.given_name, birthDate: athlete.birth_date || '',
      sex: athlete.sex || '', address: athlete.address || '', phone: athlete.phone || '',
      schoolLevel: athlete.school_level || '', guardianName: athlete.guardian_name || '',
      guardianPhone: athlete.guardian_phone || '',
    } : blank)
    setSportId('')
    setJudoCategory('')
    setRegistrationStartsOn(inputDateToday())
    setIsActive(athlete ? athlete.active === 1 : true)
    setModal(athlete ? 'edit' : 'create')
    setError('')
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      if (selected) await window.gym.athletes.update({ ...form, id: selected.id, active: isActive })
      else await window.gym.athletes.create({
        ...form,
        ...(sportId ? {
          sportId: Number(sportId),
          startsOn: registrationStartsOn,
          ...(isJudo && judoCategory ? { judoCategory } : {}),
        } : {}),
      })
      setModal(null); setMessage(selected
        ? 'Fiche athlète mise à jour.'
        : `Athlète ajouté avec succès${selectedSport ? ` et inscrit en ${selectedSport.name}${isJudo ? ` (catégorie ${judoCategory})` : ''}` : ''}.`)
      await refresh()
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  const openDetails = async (athlete: Athlete) => {
    setSelected(athlete); setModal('detail'); setDetail(null); setError('')
    try { setDetail(await window.gym.athletes.get(athlete.id)) }
    catch (reason) { setError((reason as Error).message) }
  }

  return (
    <div className="page-stack">
      <div className="page-heading"><div><p className="eyebrow">GESTION DES ADHÉRENTS</p><h1>Athlètes</h1><p className="muted">Consultez et gérez les dossiers des sportifs de votre salle.</p></div><button className="primary-button" onClick={() => openForm()}><Plus size={17} /> Ajouter un athlète</button></div>
      {message && <button className="notice success-notice" onClick={() => setMessage('')}>{message} <span>×</span></button>}
      {error && !modal && <div className="notice error-notice">{error}</div>}
      <div className="panel list-panel">
        <div className="list-toolbar">
          <label className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher nom, prénom ou téléphone…" /></label>
          <select className="filter-select" value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}><option value="">Toutes les disciplines</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select>
          <select className="filter-select" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}><option value="">Tous les statuts</option><option value="active">Actifs</option><option value="inactive">Inactifs</option></select>
          <span className="result-count">{rows.length} athlète{rows.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="table-wrap"><table><thead><tr><th>ATHLÈTE</th><th>TÉLÉPHONE</th><th>DISCIPLINES</th><th>INSCRIPTION</th><th>STATUT</th><th className="align-right">ACTIONS</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <td><div className="person-cell"><div className="person-avatar">{row.given_name[0]}{row.surname[0]}</div><div><strong>{row.given_name} {row.surname}</strong><span>N° {String(row.id).padStart(5, '0')}</span></div></div></td>
            <td>{row.phone || '—'}</td><td><span className="sport-tags">{row.sports || 'Aucune discipline'}</span></td><td>{dateLabel(row.created_at)}</td>
            <td><span className={`status-pill ${row.active ? 'success' : 'neutral'}`}>{row.active ? 'Actif' : 'Inactif'}</span></td>
            <td><div className="row-actions"><button className="icon-button" title="Consulter la fiche" onClick={() => void openDetails(row)}><Eye size={17} /></button><button className="icon-button" title="Modifier" onClick={() => openForm(row)}><Pencil size={16} /></button></div></td>
          </tr>)}
          {!rows.length && <tr><td colSpan={6} className="empty-table"><UserRound size={24} /><strong>Aucun athlète à afficher</strong><span>Ajoutez un athlète ou modifiez les filtres de recherche.</span></td></tr>}
        </tbody></table></div>
      </div>

      {modal === 'create' || modal === 'edit' ? <Modal title={selected ? 'Modifier un athlète' : 'Nouvel athlète'} description="Les champs marqués d’une étoile sont obligatoires." onClose={() => setModal(null)} wide>
        <form className="form-body" onSubmit={(event) => void submit(event)}>
          {error && <div className="notice error-notice">{error}</div>}
          <div className="form-grid">
            <label className="field"><span>Nom <b>*</b></span><input required maxLength={80} value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} /></label>
            <label className="field"><span>Prénom <b>*</b></span><input required maxLength={80} value={form.givenName} onChange={(e) => setForm({ ...form, givenName: e.target.value })} /></label>
            <label className="field"><span>Date de naissance</span><input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></label>
            <label className="field"><span>Sexe</span><select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}><option value="">Non renseigné</option><option>Femme</option><option>Homme</option><option>Autre</option></select></label>
            <label className="field"><span>Téléphone</span><input type="tel" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="field"><span>Niveau scolaire</span><input maxLength={80} value={form.schoolLevel} onChange={(e) => setForm({ ...form, schoolLevel: e.target.value })} /></label>
            <label className="field field-span"><span>Adresse</span><input maxLength={300} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          </div>
          {!selected && <>
            <div className="form-section-label">Inscription à une discipline (facultatif)</div>
            <div className="form-grid">
              <label className="field"><span>Discipline</span><select value={sportId} onChange={(e) => { setSportId(e.target.value); setJudoCategory('') }}><option value="">Aucune pour le moment</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}{sport.name.trim().toLowerCase() === 'judo' ? '' : ` — ${money(sport.monthly_fee_minor)}/mois`}</option>)}</select></label>
              <label className="field"><span>Date de début de l’inscription</span><input type="date" disabled={!sportId} required={Boolean(sportId)} value={registrationStartsOn} onChange={(e) => setRegistrationStartsOn(e.target.value)} /></label>
              {isJudo && <label className="field"><span>Catégorie de judo <b>*</b></span><select required value={judoCategory} onChange={(e) => setJudoCategory(e.target.value as '100 DHS' | '120 DHS' | '')}><option value="">Sélectionner une catégorie</option><option value="100 DHS">Catégorie à 100 DHS / mois</option><option value="120 DHS">Catégorie à 120 DHS / mois</option></select></label>}
            </div>
            {isJudo && <div className="notice info-notice">Le choix de catégorie fixe le tarif mensuel de l’inscription.</div>}
          </>}
          <div className="form-section-label">Parent ou tuteur (facultatif)</div>
          <div className="form-grid">
            <label className="field"><span>Nom du parent / tuteur</span><input maxLength={120} value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} /></label>
            <label className="field"><span>Téléphone du parent / tuteur</span><input type="tel" maxLength={40} value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} /></label>
          </div>
          {selected && <label className="checkbox-line"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Athlète actif</label>}
          <div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Annuler</button><button className="primary-button" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div>
        </form>
      </Modal> : null}

      {modal === 'detail' && <Modal title={selected ? `${selected.given_name} ${selected.surname}` : 'Fiche athlète'} description="Fiche détaillée et activité financière" onClose={() => setModal(null)} wide>
        <div className="detail-body">
          {error && <div className="notice error-notice">{error}</div>}
          {!detail ? <p>Chargement de la fiche…</p> : <>
            <div className="detail-grid">
              <div><small>Téléphone</small><strong>{detail.phone || '—'}</strong></div><div><small>Date de naissance</small><strong>{dateLabel(detail.birth_date)}</strong></div>
              <div><small>Adresse</small><strong>{detail.address || '—'}</strong></div><div><small>Parent / tuteur</small><strong>{detail.guardian_name || '—'} {detail.guardian_phone ? `· ${detail.guardian_phone}` : ''}</strong></div>
            </div>
            <h3 className="detail-section-title">Inscriptions aux disciplines</h3>
            {detail.registrations.length ? detail.registrations.map((r: Registration) => <div className="detail-list-row" key={r.id}><span>{r.sport_name}{r.judo_category ? ` · catégorie ${r.judo_category}` : ''}</span><span>{dateLabel(r.starts_on)}</span><span className={`status-pill ${r.status === 'active' ? 'success' : 'neutral'}`}>{r.status === 'active' ? 'Active' : 'Terminée'}</span></div>) : <p className="muted">Aucune inscription enregistrée.</p>}
            <h3 className="detail-section-title">Historique récent des paiements</h3>
            {detail.payments.length ? detail.payments.slice(0, 8).map((p: Payment) => <div className="detail-list-row" key={p.id}><span>{p.receipt_no}</span><span>{dateLabel(p.paid_at)}</span><strong>{money(p.amount_minor)}</strong></div>) : <p className="muted">Aucun paiement enregistré.</p>}
            {!detail.active && <div className="notice warning-notice"><UserRoundX size={17} /> Cet athlète est inactif. Son historique financier est conservé.</div>}
          </>}
        </div>
      </Modal>}
    </div>
  )
}
