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
 * Liste paginée des ventes (sans lignes).
 * @param {{date?: string, date_debut?: string, date_fin?: string,
 *          produit?: number|string, mode_paiement?: string,
 *          page?: number, page_size?: number}} [params]
 *   date : 'YYYY-MM-DD' (jour unique, contrat historique)
 *   date_debut/date_fin : période incluse, format 'YYYY-MM-DD'
 *   produit : id du produit filtré, page/page_size : pagination DRF
 * @returns {Promise<import('./types.js').Page<import('./types.js').Vente>>}
 */
export async function listVentes({
  date,
  date_debut,
  date_fin,
  produit,
  mode_paiement,
  page,
  page_size,
} = {}) {
  const qs = new URLSearchParams()
  if (date) qs.set('date', date)
  if (date_debut) qs.set('date_debut', date_debut)
  if (date_fin) qs.set('date_fin', date_fin)
  if (produit) qs.set('produit', String(produit))
  if (mode_paiement) qs.set('mode_paiement', mode_paiement)
  if (page) qs.set('page', String(page))
  if (page_size) qs.set('page_size', String(page_size))
  const q = qs.toString()
  const data = await request(`ventes/${q ? `?${q}` : ''}`)
  return { ...data, results: data.results.map(normVente) }
}

/**
 * Toutes les ventes d'une période AVEC leurs lignes (export CSV, rapports,
 * plus vendus). Pagination DRF puis détail par vente, par paquets.
 * N'utilise que des endpoints du contrat — aucun nouveau champ d'API.
 * @param {{date?: string, date_debut?: string, date_fin?: string,
 *          mode_paiement?: string, produit?: number|string,
 *          maxPages?: number}} [params]
 * @returns {Promise<import('./types.js').VenteComplete[]>}
 */
export async function listVentesDetaillees(params = {}) {
  const maxPages = params.maxPages ?? 30
  const parPage = 100
  const premier = await listVentes({ ...params, page: 1, page_size: parPage })
  let ventes = [...premier.results]
  let page = 1
  let next = premier.next
  while (next && page < maxPages) {
    page += 1
    const suite = await listVentes({ ...params, page, page_size: parPage })
    ventes = ventes.concat(suite.results)
    next = suite.next
  }

  // Détails (lignes) par paquets de 12 requêtes parallèles.
  const completes = []
  for (let i = 0; i < ventes.length; i += 12) {
    const paquet = ventes.slice(i, i + 12)
    const details = await Promise.all(paquet.map((v) => getVente(v.id)))
    completes.push(...details)
  }
  return completes
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
