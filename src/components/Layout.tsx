import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity, Archive, BarChart3, Bell, CreditCard,
  Dumbbell, LayoutDashboard, Settings, Users, Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'

const links = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/athletes', label: 'Athlètes', icon: Users },
  { to: '/inscriptions', label: 'Inscriptions', icon: Dumbbell },
  { to: '/paiements', label: 'Paiements', icon: CreditCard },
  { to: '/historique', label: 'Historique', icon: Wallet },
  { to: '/rapports', label: 'Rapports', icon: BarChart3 },
]

const titleByPath: Record<string, string> = {
  '/': 'Tableau de bord',
  '/athletes': 'Athlètes',
  '/inscriptions': 'Inscriptions',
  '/paiements': 'Paiements',
  '/historique': 'Historique des paiements',
  '/rapports': 'Rapports financiers',
  '/parametres': 'Paramètres',
  '/sauvegarde': 'Sauvegarde & restauration',
}

export function Layout({ children }: { children?: ReactNode }) {
  const location = useLocation()
  const [gymName, setGymName] = useState('Salle Sport')
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    window.gym.settings.get()
      .then((settings) => setGymName(settings.gymName))
      .catch((reason: Error) => setLoadError(`Impossible de charger les paramètres : ${reason.message}`))
  }, [])
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Activity size={22} strokeWidth={2.5} /></div>
          <div><strong>SALLE SPORT</strong><span>Gestion & suivi</span></div>
        </div>
        <div className="nav-caption">ESPACE DE GESTION</div>
        <nav className="nav-links" aria-label="Navigation principale">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /><span>{label}</span>
              {to === '/historique' && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-divider" />
          <div className="nav-caption">CONFIGURATION</div>
          <NavLink to="/parametres" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Settings size={18} /><span>Paramètres</span>
          </NavLink>
          <NavLink to="/sauvegarde" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Archive size={18} /><span>Sauvegarde</span>
          </NavLink>
          <div className="offline-pill"><span /> Fonctionne hors ligne</div>
          <div className="profile">
            <div className="profile-avatar">SS</div>
            <div className="profile-info"><strong>Compte local</strong><span>{gymName}</span></div>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Gestion</span><span className="crumb-separator">/</span><strong>{titleByPath[location.pathname] || 'Gestion'}</strong></div>
          <div className="topbar-actions">
            <span className="today-date">{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date())}</span>
            <span className="topbar-divider" />
            <div className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></div>
            <div className="topbar-user">LO</div>
          </div>
        </header>
        <div className="page-content">{loadError && <div className="notice error-notice">{loadError}</div>}{children || <Outlet />}</div>
      </main>
    </div>
  )
}
