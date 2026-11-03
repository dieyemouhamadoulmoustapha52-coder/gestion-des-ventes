/**
 * Client HTTP unique de l'application — LE seul endroit qui parle fetch.
 * C'est aussi le seul endroit où l'on ajoutera plus tard un header d'auth.
 *
 * Erreurs normalisées : ApiError {status, code, detail, fields, payload}.
 */

const BASE = String(import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')
const TIMEOUT_MS = 15_000

/**
 * Erreur normalisée unique pour tous les échecs réseau / API.
 */
export class ApiError extends Error {
  /**
   * @param {{status: number, code: string, detail?: string,
   *          fields?: Record<string, string[]>|null,
   *          payload?: object|null}} init
   */
  constructor({ status, code, detail = '', fields = null, payload = null }) {
    super(detail || code)
    this.name = 'ApiError'
    /** @type {number} 0 = réseau/timeout (pas de réponse HTTP) */
    this.status = status
    /** @type {string} ex. 'stock_insuffisant' | 'validation_error' | 'timeout' */
    this.code = code
    /** @type {string} message lisible */
    this.detail = detail
    /** @type {Record<string, string[]>|null} erreurs 400 par champ DRF */
    this.fields = fields
    /** @type {object|null} corps brut (utile : produit, stock_disponible…) */
    this.payload = payload
  }
}

/** Vrai si l'erreur est « stock insuffisant » (409 métier). */
export function isStockError(err) {
  return err instanceof ApiError && err.code === 'stock_insuffisant'
}

/** @param {string} path type 'produits/?page=2' (slash final requis) */
function url(path) {
  return `${BASE}/${path.replace(/^\/+/, '')}`
}

/**
 * @param {number} status
 * @param {object|null} payload
 * @returns {ApiError}
 */
function normalizeError(status, payload) {
  if (payload && typeof payload.code === 'string') {
    // Erreur métier : {"code": "stock_insuffisant", "detail": …, …}
    return new ApiError({ status, code: payload.code, detail: payload.detail || '', payload })
  }
  const isFieldMap =
    payload !== null && typeof payload === 'object' && !Array.isArray(payload) &&
    Object.values(payload).every((v) => Array.isArray(v))
  if (isFieldMap) {
    // Erreur de validation DRF : {"champ": ["message"]}
    const detail = Object.values(payload).flat()[0] || 'Données invalides.'
    return new ApiError({ status, code: 'validation_error', detail, fields: payload, payload })
  }
  return new ApiError({
    status,
    code: 'http_error',
    detail: (payload && payload.detail) || `Erreur HTTP ${status}`,
    payload,
  })
}

/**
 * Requête générique. Timeout 15 s, 204 → null, erreurs normalisées.
 * @param {string} path chemin relatif à la base ('ventes/' — slash final obligatoire)
 * @param {{method?: string, body?: object, signal?: AbortSignal}} [options]
 * @returns {Promise<any>}
 * @throws {ApiError}
 */
export async function request(path, { method = 'GET', body, signal } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })

  try {
    const res = await fetch(url(path), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (res.status === 204) return null
    const payload = await res.json().catch(() => null)
    if (!res.ok) throw normalizeError(res.status, payload)
    return payload
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err.name === 'AbortError') {
      throw new ApiError({ status: 0, code: 'timeout', detail: 'Délai dépassé (15 s) — l\'API ne répond pas.' })
    }
    throw new ApiError({ status: 0, code: 'network_error', detail: 'Impossible de joindre l\'API (vérifier le serveur ou le mode mock).' })
  } finally {
    clearTimeout(timer)
  }
}
