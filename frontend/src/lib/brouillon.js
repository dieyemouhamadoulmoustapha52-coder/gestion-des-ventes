/**
 * Brouillon des paniers de caisse — persistance localStorage — @audience caissier.
 * Clé `gv:paniers:v1` (version de schéma), lecture/écriture défensives (try/catch),
 * revalidation des lignes contre l'état COURANT des produits au moment du chargement.
 */

/** Clé de stockage (version de schéma incluse). */
export const BROUILLON_CLE = 'gv:paniers:v1'
/** Version du schéma persisté. */
export const BROUILLON_VERSION = 1

/** @returns {Storage|null} localStorage si disponible (mode privé, SSR…) */
function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/**
 * Lit le brouillon. Toute anomalie (JSON cassé, version inconnue, structure
 * invalide) → null : on repart de paniers vierges.
 * @param {Storage|null} [storage]
 * @returns {{paniers: Array, actif: number, seq: number}|null}
 */
export function lireBrouillon(storage = defaultStorage()) {
  if (!storage) return null
  try {
    const brut = storage.getItem(BROUILLON_CLE)
    if (!brut) return null
    const data = JSON.parse(brut)
    if (!data || data.version !== BROUILLON_VERSION) return null
    if (!Array.isArray(data.paniers) || data.paniers.length === 0) return null
    const paniers = data.paniers.map((p, i) => ({
      id: Number.isInteger(p?.id) ? p.id : i + 1,
      items: Array.isArray(p?.items)
        ? p.items.filter(
            (l) =>
              l &&
              Number.isInteger(l.produit?.id) &&
              Number.isInteger(l.quantite) &&
              l.quantite > 0,
          )
        : [],
    }))
    const actif =
      Number.isInteger(data.actif) && data.actif >= 0 && data.actif < paniers.length
        ? data.actif
        : 0
    const seq = Number.isInteger(data.seq) && data.seq >= paniers.length ? data.seq : paniers.length
    return { paniers, actif, seq }
  } catch {
    return null
  }
}

/**
 * Écrit le brouillon (debounce géré par l'appelant). Jamais d'exception.
 * @param {{paniers: Array, actif: number, seq: number}} etat
 * @param {Storage|null} [storage]
 * @returns {boolean} true si l'écriture a réussi
 */
export function ecrireBrouillon(etat, storage = defaultStorage()) {
  if (!storage || !etat) return false
  try {
    storage.setItem(
      BROUILLON_CLE,
      JSON.stringify({ version: BROUILLON_VERSION, ...etat }),
    )
    return true
  } catch {
    return false // quota dépassé, mode privé…
  }
}

/**
 * Efface le brouillon (après vente validée, ou nettoyage). Jamais d'exception.
 * @param {Storage|null} [storage]
 */
export function effacerBrouillon(storage = defaultStorage()) {
  if (!storage) return
  try {
    storage.removeItem(BROUILLON_CLE)
  } catch {
    /* ignoré */
  }
}

/**
 * Revalide un brouillon restauré contre l'état courant des produits :
 * - ligne dont le produit n'existe plus → supprimée ;
 * - quantité bornée au stock courant ; stock à 0 → ligne supprimée ;
 * - snapshot produit remplacé par l'état courant (prix, stock) ;
 * - index actif hors bornes → 0.
 * Fonction pure : ni effet de bord ni entrée système.
 *
 * @param {{paniers: Array, actif: number, seq: number}} brut brouillon lu
 * @param {Array<{id: number, stock: number}>} produits catalogue courant
 * @returns {{paniers: Array, actif: number, seq: number}}
 */
export function revaliderBrouillon(brut, produits) {
  const parId = new Map((produits ?? []).map((p) => [p.id, p]))
  const paniers = (brut?.paniers ?? []).map((p) => ({
    id: p.id,
    items: (p.items ?? [])
      .map((l) => {
        const courant = parId.get(l.produit.id)
        if (!courant) return null
        const stock = Number(courant.stock) || 0
        if (stock <= 0) return null
        return {
          produit: { ...l.produit, ...courant },
          quantite: Math.max(1, Math.min(l.quantite, stock)),
        }
      })
      .filter(Boolean),
  }))
  const liste = paniers.length > 0 ? paniers : [{ id: 1, items: [] }]
  const actif =
    Number.isInteger(brut?.actif) && brut.actif >= 0 && brut.actif < liste.length ? brut.actif : 0
  const seq = Number.isInteger(brut?.seq) && brut.seq >= liste.length ? brut.seq : liste.length
  return { paniers: liste, actif, seq }
}

/** Vrai si au moins un panier restauré contient des lignes. */
export function aDesLignes(etat) {
  return (etat?.paniers ?? []).some((p) => (p.items ?? []).length > 0)
}
