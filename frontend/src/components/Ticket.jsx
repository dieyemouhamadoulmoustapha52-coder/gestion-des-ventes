/**
 * Ticket de vente imprimable — 80 mm, format thermique, N&B.
 * Affiché EN LIGNE (aucune popup) : aperçu + bouton « Imprimer le ticket ».
 * À l'impression : seul le ticket est imprimé (@page 80mm, voir Ticket.css).
 */
import { Printer, X } from 'lucide-react'
import Button from './Button.jsx'
import WhatsappIcon from './WhatsappIcon.jsx'
import { DEFAULT_BOUTIQUE } from '../config/boutique.js'
import { libelleLigneMode } from '../lib/conditionnements.js'
import { MODE_LABELS } from '../lib/constants.js'
import { dateHeureDakar } from '../lib/dates.js'
import { formatFcfa, toNumber } from '../lib/money.js'
import { buildWhatsAppLink, ouvrirWhatsApp } from '../lib/whatsapp.js'
import './Ticket.css'

/**
 * @param {{
 *   vente: (import('../api/types.js').VenteComplete & {
 *      montant_recu?: number,
 *      monnaie_rendue?: number,
 *   }) | null,
 *   boutique?: Partial<typeof DEFAULT_BOUTIQUE>,
 *   onFermer?: () => void,
 * }} props
 */
export default function Ticket({ vente, boutique = {}, onFermer }) {
  if (!vente) return null

  const shop = { ...DEFAULT_BOUTIQUE, ...boutique }
  const lignes = vente.lignes ?? []
  const recu = vente.montant_recu !== undefined && vente.montant_recu !== null
  const rendu = vente.monnaie_rendue !== undefined && vente.monnaie_rendue !== null

  return (
    <section className="space-y-3" aria-label={`Ticket de caisse n° ${vente.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Ticket — vente n° {vente.id}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => ouvrirWhatsApp(buildWhatsAppLink(vente, shop))}>
            <WhatsappIcon size={16} />
            Envoyer par WhatsApp
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" />
            Imprimer le ticket
          </Button>
          {onFermer ? (
            <Button variant="ghost" onClick={onFermer}>
              <X size={16} aria-hidden="true" />
              Fermer
            </Button>
          ) : null}
        </div>
      </div>

      <div className="ticket-print">
        <header className="ticket-header">
          <div className="ticket-brand-block">
            <div className="ticket-brand-name">{shop.nom || 'Boutique'}</div>
            {shop.adresse ? <div className="ticket-brand-meta">{shop.adresse}</div> : null}
            {shop.telephone ? <div className="ticket-brand-meta">{shop.telephone}</div> : null}
          </div>
          {shop.sigle ? <div className="ticket-logo-box">{shop.sigle}</div> : null}
        </header>

        <div className="ticket-meta">
          <div>Ticket N°: {vente.id}</div>
          <div>{dateHeureDakar(new Date(vente.date_vente))}</div>
        </div>

        <div className="ticket-lignes" aria-label="Détail des articles vendus">
          {lignes.map((l) => {
            const mode = libelleLigneMode(l) // « Carton (12) », vide au Détail
            const base = Number(l.quantite_base)
            return (
              <div key={l.id} className="ticket-ligne">
                <p className="ticket-ligne-nom">{l.produit_nom}</p>
                <div className="ticket-ligne-meta">
                  {/* mode → « 2 × Carton (12) », détail → « 3 × 1 500 » */}
                  <span>
                    {mode
                      ? `${l.quantite} × ${mode}`
                      : `${l.quantite} × ${formatFcfa(l.prix_unitaire)}`}
                  </span>
                  <span>{formatFcfa(l.montant_ligne)}</span>
                </div>
                {mode && base > 0 ? (
                  <div className="ticket-ligne-meta">
                    <span>
                      {formatFcfa(l.prix_unitaire)} / {mode} · {base} unité
                      {base > 1 ? 's' : ''}
                    </span>
                    <span aria-hidden="true" />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="ticket-rule">-----</div>

        <div className="ticket-total-row">
          <span>Total</span>
          <strong>{formatFcfa(vente.montant_total)}</strong>
        </div>

        <div className="ticket-summary-row">
          <span>Règlement</span>
          <strong>{MODE_LABELS[vente.mode_paiement] || vente.mode_paiement || '—'}</strong>
        </div>

        {recu ? (
          <div className="ticket-summary-row">
            <span>Reçu</span>
            <strong>{formatFcfa(toNumber(vente.montant_recu))}</strong>
          </div>
        ) : null}
        {rendu ? (
          <div className="ticket-summary-row">
            <span>Monnaie</span>
            <strong>{formatFcfa(toNumber(vente.monnaie_rendue))}</strong>
          </div>
        ) : null}

        <div className="ticket-footer">
          <div className="ticket-thanks">{shop.piedTicket || 'Merci de votre visite'}</div>
        </div>
      </div>
    </section>
  )
}
