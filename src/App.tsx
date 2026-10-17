import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Athletes } from './pages/Athletes'
import { Backup } from './pages/Backup'
import { Dashboard } from './pages/Dashboard'
import { PaymentHistory } from './pages/PaymentHistory'
import { Payments } from './pages/Payments'
import { Registrations } from './pages/Registrations'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="athletes" element={<Athletes />} />
        <Route path="inscriptions" element={<Registrations />} />
        <Route path="paiements" element={<Payments />} />
        <Route path="historique" element={<PaymentHistory />} />
        <Route path="rapports" element={<Reports />} />
        <Route path="parametres" element={<Settings />} />
        <Route path="sauvegarde" element={<Backup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
