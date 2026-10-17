import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Modal } from './Modal'
import { dateLabel, money, monthNames } from '../lib/format'
import type { GymSettings, Payment, PaymentMonth } from '../types'

export function ReceiptDialog({
  payment,
  settings,
  onClose,
}: {
  payment: Payment
  settings: GymSettings
  onClose: () => void
}) {
  const [error, setError] = useState('')
  const print = async () => {
    setError('')
    try { await window.gym.receipts.print() }
    catch (reason) { setError((reason as Error).message) }
  }
  const months = Array.isArray(payment.months)
    ? payment.months.map((item: PaymentMonth) => `${monthNames[item.month - 1]} ${item.year}`)
    : (payment.months || '').split(', ').filter(Boolean).map((value) => {
      const [month, year] = value.split('/')
      return `${monthNames[Number(month) - 1] || month} ${year}`
    })
  return (
    <Modal title="Reçu de paiement" description={`Reçu ${payment.receipt_no} · ${payment.status === 'validated' ? 'Paiement validé' : 'Paiement annulé'}`} onClose={onClose} wide>
      <div className="receipt-actions no-print">
        {error && <div className="notice error-notice">{error}</div>}
        <p>Deux exemplaires seront imprimés sur la même feuille. La réimpression ne crée pas de nouveau paiement.</p>
        <button className="primary-button" onClick={() => void print()}><Printer size={17} /> Imprimer les deux reçus</button>
      </div>
      <div className="receipts-preview">
        {[false, true].map((managementCopy) => <article className="receipt-paper" key={String(managementCopy)}>
          <div className="receipt-topline"><div className="receipt-logo">SS</div><div><h3>{settings.gymName}</h3><p>{settings.address || 'Gestion des activités sportives'}{settings.phone ? ` · ${settings.phone}` : ''}</p></div></div>
          <div className="receipt-heading"><strong>REÇU DE PAIEMENT</strong><span>{managementCopy ? 'EXEMPLAIRE DIRECTION' : 'EXEMPLAIRE ATHLÈTE'}</span></div>
          <div className="receipt-number"><span>N° DE REÇU</span><strong>{payment.receipt_no}</strong></div>
          <div className="receipt-details">
            <div><small>Athlète</small><strong>{payment.given_name} {payment.surname}</strong></div>
            <div><small>Discipline</small><strong>{payment.sport_name}</strong></div>
            <div><small>Date du paiement</small><strong>{dateLabel(payment.paid_at)}</strong></div>
            <div><small>Mode de paiement</small><strong>{payment.payment_method}</strong></div>
            <div className="receipt-months"><small>Mois réglés</small><strong>{months.length ? months.join(', ') : '—'}</strong></div>
          </div>
          <div className="receipt-total"><span>Montant encaissé</span><strong>{money(payment.amount_minor, settings.currency)}</strong></div>
          {payment.status === 'cancelled' && <p className="receipt-cancelled">ANNULÉ — {payment.cancellation_reason}</p>}
          <div className="receipt-signatures"><span>Signature du responsable</span><span>Cachet de la salle</span></div>
        </article>)}
      </div>
      <div className="modal-footer no-print"><button className="secondary-button" onClick={onClose}>Fermer</button></div>
    </Modal>
  )
}
