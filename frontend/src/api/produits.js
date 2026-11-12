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
 * Crée un produit (contrat complet : `conditionnements` = liste des modes,
 * sans `id` — le service attribue les identifiants).
 * @param {object} data {code, nom, categorie, unite_base, prix_achat, prix,
 *   quantite, seuil_alerte, conditionnements}
 * @returns {Promise<import('./types.js').Produit>}
 */
export function createProduit(data) {
  return request('produits/', { method: 'POST', body: data }).then(norm)
}

/**
 * Remplace un produit : PUT complet, la liste `conditionnements` est
 * intégralement remplacée (absent = mode retiré → inactif).
 * @param {number} id
 * @param {object} data même forme que {@link createProduit}
 * @returns {Promise<import('./types.js').Produit>}
 */
export function updateProduit(id, data) {
  return request(`produits/${id}/`, { method: 'PUT', body: data }).then(norm)
}

/** @param {number} id @returns {Promise<null>} 204 — 409 si produit vendu (PROTECT) */
export function deleteProduit(id) {
  return request(`produits/${id}/`, { method: 'DELETE' })
}

/**
 * Réapprovisionne un produit : quantite += quantite × facteur (atomique).
 * Sans `conditionnement`, le mode est le Détail (facteur 1).
 * @param {number} id
 * @param {number} quantite entier strictement > 0, en unités du mode reçu
 *   (le service multiplie par `facteur` avant d'ajouter au stock)
 * @param {number|null} [conditionnement] id du mode de vente reçu
 * @returns {Promise<import('./types.js').Produit>} produit à jour
 */
export function reapprovisionnerProduit(id, quantite, conditionnement = null) {
  return request(`produits/${id}/reapprovisionner/`, {
    method: 'POST',
    body: conditionnement === null || conditionnement === undefined
      ? { quantite }
      : { quantite, conditionnement },
  }).then(norm)
}
