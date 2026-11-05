/** Ticket de vente imprimable — largeur 80 mm, format thermique. */
import { Printer } from 'lucide-react'
import Button from './Button.jsx'
import Modal from './Modal.jsx'
import { DEFAULT_BOUTIQUE } from '../config/boutique.js'
import { MODE_LABELS } from '../lib/constants.js'
import { dateHeureDakar } from '../lib/dates.js'
import { formatFcfa } from '../lib/money.js'
import './Ticket.css'

const safeValue = (value, fallback) => (value ?? fallback)

/**
* @param {{
*   open: boolean,
*   onClose: () => void,
*   vente: (import('../api/types.js').VenteComplete & {
*      montant_recu?: number,
*      monnaie_rendue?: number,
*      client_nom?: string,
*      caissier?: string,
*   }) | null,
*   boutique?: Partial<typeof DEFAULT_BOUTIQUE>
* }} props
*/
export default function Ticket({ open, onClose, vente, boutique = {} }) {
 if (!vente) return null

 const shop = { ...DEFAULT_BOUTIQUE, ...boutique }
 const productionDate = new Date(vente.date_vente)
 const qteTotale = vente.lignes.reduce((sum, item) => sum + (Number(item.quantite) || 0), 0)
 const totalHt = Number(vente.montant_total || 0) / 1.18
 const tva = Number(vente.montant_total || 0) - totalHt
 const montantRecu = Number(safeValue(vente.montant_recu, vente.montant_total))
 const monnaieRendue = Number(safeValue(vente.monnaie_rendue, 0))

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
     <div className="ticket-print" aria-label={`Ticket de caisse n° ${vente.id}`}>
       <header className="ticket-header">
         <div className="ticket-brand-block">
           <div className="ticket-brand-name">{shop.nom || 'NOM STE'}</div>
           <div className="ticket-brand-meta">{shop.adresse || 'Adresse boutique'}</div>
         </div>
         <div className="ticket-logo-box">{shop.sigle || 'LOGO'}</div>
       </header>

       <div className="ticket-meta">
         <div>Ticket N°: {vente.id}</div>
         <div>{dateHeureDakar(productionDate)}</div>
       </div>

       <table className="ticket-table" aria-label="Détail des articles vendus">
         <thead>
           <tr>
             <th>Nom produits</th>
             <th>Qte.</th>
             <th>Prix U</th>
             <th>Total</th>
           </tr>
         </thead>
         <tbody>
           {vente.lignes.map((item) => (
             <tr key={item.id}>
               <td>{item.produit_nom}</td>
               <td>{item.quantite}</td>
               <td>{formatFcfa(item.prix_unitaire)}</td>
               <td>{formatFcfa(item.montant_ligne)}</td>
             </tr>
           ))}
         </tbody>
       </table>

       <div className="ticket-rule">-----</div>

       <div className="ticket-summary-row">
         <span>Qté totale</span>
         <strong>{qteTotale}</strong>
       </div>
       <div className="ticket-summary-row">
         <span>HT</span>
         <strong>{formatFcfa(totalHt)}</strong>
       </div>
       <div className="ticket-summary-row">
         <span>TVA (18%)</span>
         <strong>{formatFcfa(tva)}</strong>
       </div>
       <div className="ticket-total-row">
         <span>Total à payer</span>
         <strong>{formatFcfa(vente.montant_total)}</strong>
       </div>

       <div className="ticket-rule">-----</div>

       <div className="ticket-summary-row">
         <span>Reçu</span>
         <strong>{formatFcfa(montantRecu)}</strong>
       </div>
       <div className="ticket-summary-row">
         <span>Monnaie</span>
         <strong>{formatFcfa(monnaieRendue)}</strong>
       </div>

       <div className="ticket-footer">
         <div>Caissier: {vente.caissier || shop.caissier || 'CAISSIER'}</div>
         <div>Client: {vente.client_nom || 'Client de passage'}</div>
         <div>Règlement: {MODE_LABELS[vente.mode_paiement] || vente.mode_paiement}</div>
         <div className="ticket-thanks">
           {shop.message_ticket || 'Merci pour votre achat !'} • {shop.reseaux || '@NOMSTE'}
         </div>
       </div>
     </div>
   </Modal>
 )
}

