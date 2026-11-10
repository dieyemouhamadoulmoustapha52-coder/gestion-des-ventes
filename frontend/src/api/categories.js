/** Endpoint catégorie — GET/POST categories/, GET/PUT/DELETE categories/{id}/ */
import { request } from './client.js'

/** @returns {Promise<import('./types.js').Page<import('./types.js').Categorie>>} */
export function listCategories() {
  return request('categories/')
}

/** @param {number} id @returns {Promise<import('./types.js').Categorie>} */
export function getCategory(id) {
  return request(`categories/${id}/`)
}

/**
 * @param {{nom: string, description?: string}} data
 * @returns {Promise<import('./types.js').Categorie>}
 */
export function createCategory(data) {
  return request('categories/', { method: 'POST', body: data })
}

/**
 * @param {number} id
 * @param {{nom?: string, description?: string}} data
 * @returns {Promise<import('./types.js').Categorie>}
 */
export function updateCategory(id, data) {
  return request(`categories/${id}/`, { method: 'PUT', body: data })
}

/** @param {number} id @returns {Promise<null>} 204 */
export function deleteCategory(id) {
  return request(`categories/${id}/`, { method: 'DELETE' })
}
