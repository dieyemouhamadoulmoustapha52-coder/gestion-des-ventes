/** Ticket de vente imprimable — largeur80 mm (styles @media print dans index.css). */
import { Printer } from 'lucide-react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'
import { MODE_LABELS } from '../lib/constants.js'
import { formatFcfa } from '../lib/money.js'

const DTF = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * @param {{open: boolean, onClose: () => void,
 *          vente: import('../api/types.js').VenteComplete|null}} props
 */
export default function Ticket({ open, onClose, vente }) {
  if (!vente) return null

  return (
    <Modal
      open={open}
      title={`Ticket — vente n° ${vente.id}`}
      onClose={onClose}
      footer={
        <Button onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          Imprimer le ticket
        </Button>
      }
    >
      <div className="ticket-print">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-wide">Gestion des ventes</p>
          <p className="text-xs">Ticket de vente n° {vente.id}</p>
          <p className="text-xs">{DTF.format(new Date(vente.date_vente))}</p>
        </div>
        <hr className="my-2 border-slate-300" />
        <ul className="space-y-1 text-sm">
          {vente.lignes.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span>
                {l.quantite} × {l.produit_nom}
              </span>
              <span>{formatFcfa(l.montant_ligne)}</span>
            </li>
          ))}
        </ul>
        <hr className="my-2 border-slate-300" />
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span>{formatFcfa(vente.montant_total)}</span>
        </div>
        <p className="text-sm">Mode : {MODE_LABELS[vente.mode_paiement] || vente.mode_paiement}</p>
        <p className="mt-3 text-center text-xs">Merci de votre visite !</p>
      </div>
    </Modal>
  )
}
