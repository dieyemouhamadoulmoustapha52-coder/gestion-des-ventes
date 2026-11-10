/**
 * Messages de la barre de notifications — modèle partagé.
 * Format compatible avec une future table `notification` du backend :
 * { id, type, niveau, texte, action?, audience, ephemere, duree?, masquable, creeLe }
 *
 * @typedef {'stock-bas'|'rupture'|'vente-enregistree'} MessageType
 * @typedef {'info'|'succes'|'avertissement'|'critique'} MessageNiveau
 * @typedef {'patron'|'caissier'|'tous'} MessageAudience
 * @typedef {{label: string, route?: string, callback?: () => void}} MessageAction
 * @typedef {object} Message
 * @property {string} id stable (ex. `stock-bas:<idProduit>`)
 * @property {MessageType} type
 * @property {MessageNiveau} niveau
 * @property {string} texte
 * @property {MessageAction} [action]
 * @property {MessageAudience} audience
 * @property {boolean} ephemere disparait tout seul
 * @property {number} [duree] durée en ms (messages éphémères)
 * @property {boolean} masquable l'utilisateur peut le fermer
 * @property {number} creeLe horodatage (ms)
 */

/** Priorité d'affichage : la plus forte d'abord. */
export const PRIORITE = { critique: 0, avertissement: 1, succes: 2, info: 3 }

/** Durée d'affichage d'un message éphémère (ms). */
export const DUREE_EPHEMERE = 4000

/** Seuil de regroupement : au-delà, un seul message groupé. */
export const SEUIL_GROUPEMENT = 3

/**
 * Dérive les messages de stock à partir de l'état des produits (fonction pure :
 * un seul message par produit, la rupture remplace le stock bas du même produit,
 * disparition automatique quand le stock remonte).
 *
 * @param {Array<{id: number|string, nom: string, stock: number,
 *                seuil_alerte?: number, seuil?: number}>} produits
 * @param {number} [seuilDefaut] seuil boutique si le produit n'a pas de sien
 * @returns {Message[]}
 */
export function deriveStockMessages(produits, seuilDefaut = 5) {
  const list = []
  for (const p of produits ?? []) {
    const stock = Number(p.stock)
    if (!Number.isFinite(stock)) continue
    const seuil = Number(p.seuil_alerte ?? p.seuil ?? seuilDefaut)
    const base = { audience: 'tous', ephemere: false, creeLe: 0 }
    if (stock === 0) {
      list.push({
        ...base,
        id: `stock-bas:${p.id}`,
        type: 'rupture',
        niveau: 'critique',
        texte: `${p.nom} : rupture de stock`,
        masquable: false,
      })
    } else if (stock <= seuil) {
      list.push({
        ...base,
        id: `stock-bas:${p.id}`,
        type: 'stock-bas',
        niveau: 'avertissement',
        texte: `${p.nom} : il reste ${stock}`,
        masquable: true,
      })
    }
  }

  if (list.length > SEUIL_GROUPEMENT) {
    return [
      {
        id: 'stock-groupe',
        type: 'stock-bas',
        niveau: 'avertissement',
        texte: `${list.length} produits en stock bas`,
        action: { label: 'Voir', route: '/produits?stock_bas=true' },
        audience: 'tous',
        ephemere: false,
        masquable: false,
        creeLe: 0,
      },
    ]
  }
  return list
}

/**
 * Tri par priorité d'affichage (stable : les horodatages égaux gardent l'ordre).
 * @param {Message[]} messages
 * @returns {Message[]}
 */
export function trierMessages(messages) {
  return [...messages].sort((a, b) => PRIORITE[a.niveau] - PRIORITE[b.niveau] || a.creeLe - b.creeLe)
}
