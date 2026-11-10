/** Endpoint vente — ventes/ (liste légère, création, détail avec lignes). */
import { request } from './client.js'
import { toNumber } from '../lib/money.js'

const normVente = (v) => ({ ...v, montant_total: toNumber(v.montant_total) })
const normLigne = (l) => ({
  ...l,
  prix_unitaire: toNumber(l.prix_unitaire),
  montant_ligne: toNumber(l.montant_ligne),
})
const normComplete = (v) => ({ ...normVente(v), lignes: (v.lignes || []).map(normLigne) })

/**
 * @param {{date?: string, mode_paiement?: string, page?: number}} [params]
 *   date : 'YYYY-MM-DD', mode_paiement : 'ESPECES' | …
 * @returns {Promise<import('./types.js').Page<import('./types.js').Vente>>}
 */
export async function listVentes({ date, mode_paiement, page } = {}) {
  const qs = new URLSearchParams()
  if (date) qs.set('date', date)
  if (mode_paiement) qs.set('mode_paiement', mode_paiement)
  if (page) qs.set('page', String(page))
  const q = qs.toString()
  const data = await request(`ventes/${q ? `?${q}` : ''}`)
  return { ...data, results: data.results.map(normVente) }
}

/**
 * Création d'une vente — le serveur fige les prix et décrémente les stocks.
 * @param {{mode_paiement: import('./types.js').ModePaiement,
 *          lignes: Array<{produit: number, quantite: number}>,
 *          client_nom?: string}} data
 * @returns {Promise<import('./types.js').VenteComplete>} 201
 * @throws {import('./client.js').ApiError} code 'stock_insuffisant' (409)
 */
export function creerVente(data) {
  return request('ventes/', { method: 'POST', body: data })
}

/** @param {number} id @returns {Promise<import('./types.js').VenteComplete>} */
export async function getVente(id) {
  return normComplete(await request(`ventes/${id}/`))
}
