/** Endpoint produit — produits/ avec search, categorie, stock_bas, pagination.
 *  Toute traduction du contrat vit dans src/api/adaptateur.js. */
import { request } from './client.js'
import { versVuePage, versVueProduit } from './adaptateur.js'

/** Normalisation : Decimal DRF → number + conditionnements + alias legacy. */
const norm = versVueProduit

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
  return versVuePage(data, norm)
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

/**
 * Réapprovisionne un produit : stock += quantite (opération atomique).
 * @param {number} id
 * @param {number} quantite entier strictement > 0
 * @returns {Promise<import('./types.js').Produit>} produit à jour
 */
export function reapprovisionnerProduit(id, quantite) {
  return request(`produits/${id}/reapprovisionner/`, {
    method: 'POST',
    body: { quantite },
  }).then(norm)
}
