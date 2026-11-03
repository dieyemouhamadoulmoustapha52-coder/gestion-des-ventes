/** Endpoint produit — produits/ avec search, categorie, stock_bas, pagination. */
import { request } from './client.js'
import { toNumber } from '../lib/money.js'

/** Normalisation : prix_unitaire "6200.00" → number. */
const norm = (p) => ({ ...p, prix_unitaire: toNumber(p.prix_unitaire) })

/**
 * @param {{search?: string, categorie?: number|string|null,
 *          stock_bas?: boolean, page?: number}} [params]
 * @returns {Promise<import('./types.js').Page<import('./types.js').Produit>>}
 */
export async function listProduits({ search, categorie, stock_bas, page } = {}) {
  const qs = new URLSearchParams()
  if (search) qs.set('search', search)
  if (categorie !== undefined && categorie !== null && categorie !== '') qs.set('categorie', String(categorie))
  if (stock_bas) qs.set('stock_bas', 'true')
  if (page) qs.set('page', String(page))
  const q = qs.toString()
  const data = await request(`produits/${q ? `?${q}` : ''}`)
  return { ...data, results: data.results.map(norm) }
}

/** @param {number} id @returns {Promise<import('./types.js').Produit>} */
export async function getProduit(id) {
  return norm(await request(`produits/${id}/`))
}

/**
 * @param {{code: string, nom: string, categorie: number, prix_unitaire: number,
 *          stock?: number, seuil_alerte?: number}} data
 * @returns {Promise<import('./types.js').Produit>}
 */
export function createProduit(data) {
  return request('produits/', { method: 'POST', body: data })
}

/**
 * @param {number} id
 * @param {Partial<{code: string, nom: string, categorie: number,
 *        prix_unitaire: number, stock: number, seuil_alerte: number}>} data
 * @returns {Promise<import('./types.js').Produit>} PATCH partiel
 */
export function updateProduit(id, data) {
  return request(`produits/${id}/`, { method: 'PATCH', body: data })
}

/** @param {number} id @returns {Promise<null>} 204 — 409 si produit vendu (PROTECT) */
export function deleteProduit(id) {
  return request(`produits/${id}/`, { method: 'DELETE' })
}
