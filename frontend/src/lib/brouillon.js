/**
 * Brouillon des paniers de caisse — persistance localStorage — @audience caissier.
 *
 * Clé `gv:paniers:v2` (schéma avec modes de vente par ligne) ; un brouillon
 * `gv:paniers:v1` (lignes sans mode) est encore LU et migré : chaque ligne y
 * devient un mode Détail. Lecture/écriture défensives (try/catch),
 * revalidation des lignes contre l'état COURANT des produits au chargement :
 * produit absent ou en rupture → ligne retirée ; mode retiré/inactif → ligne
 * retirée ; quantité re-bornée en unités de base (cumul des lignes produit).
 */
import { maxQuantiteLigne, modeDetail } from './conditionnements.js'
import { cleDeLigne, ligneCle } from './paniers.js'

/** Clé de stockage actuelle (version de schéma incluse). */
export const BROUILLON_CLE = 'gv:paniers:v2'
/** Version du schéma persisté. */
export const BROUILLON_VERSION = 2
/** Ancien schéma (lignes sans mode) — lu puis migré à la lecture. */
export const BROUILLON_CLE_V1 = 'gv:paniers:v1'
export const BROUILLON_VERSION_V1 = 1

/** @returns {Storage|null} localStorage si disponible (mode privé, SSR…) */
function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/**
 * Lit le brouillon (v2, à défaut v1 migré). Toute anomalie (JSON cassé,
 * version inconnue, structure invalide) → null : on repart de paniers vierges.
 * @param {Storage|null} [storage]
 * @returns {{paniers: Array, actif: number, seq: number}|null}
 */
export function lireBrouillon(storage = defaultStorage()) {
  if (!storage) return null
  try {
    let brut = null
    let version = null
    try {
      brut = storage.getItem(BROUILLON_CLE)
      if (brut) version = BROUILLON_VERSION
    } catch {
      /* ignore */
    }
    if (!brut) {
      try {
        brut = storage.getItem(BROUILLON_CLE_V1)
        if (brut) version = BROUILLON_VERSION_V1
      } catch {
        /* ignore */
      }
    }
    if (!brut || version === null) return null
    const data = JSON.parse(brut)
    if (!data || Number(data.version) !== version) return null
    if (!Array.isArray(data.paniers) || data.paniers.length === 0) return null
    const paniers = data.paniers.map((p, i) => ({
      id: Number.isInteger(p?.id) ? p.id : i + 1,
      // v1 : lignes sans `conditionnement` — revaliderBrouillon les fait
      // basculer en mode Détail (modeRestaurable).
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
 * Écrit le brouillon en schéma v2 (debounce géré par l'appelant).
 * L'ancien brouillon v1 est effacé pour éviter deux sources de vérité.
 * Jamais d'exception.
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
    try {
      storage.removeItem(BROUILLON_CLE_V1)
    } catch {
      /* ignore */
    }
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
    storage.removeItem(BROUILLON_CLE_V1)
  } catch {
    /* ignoré */
  }
}

/**
 * Mode d'une ligne restaurée, contre le catalogue COURANT :
 * - ligne sans mode (brouillon v1) → Détail du produit ;
 * - mode connu et actif → l'objet ACTUALISÉ du catalogue (prix/facteur neufs) ;
 * - mode supprimé ou retiré → null (la ligne est retirée).
 * @param {any} produit produit courant du catalogue
 * @param {any} brut mode persisté
 * @returns {object|null}
 */
export function modeRestaurable(produit, brut) {
  if (!brut || brut.id === null || brut.id === undefined) return modeDetail(produit)
  const trouve = (produit?.conditionnements ?? []).find((m) => m?.id === Number(brut.id))
  if (!trouve || trouve.actif === false) return null
  return trouve
}

/**
 * Revalide un brouillon restauré contre l'état courant des produits :
 * - ligne dont le produit n'existe plus ou est en rupture → supprimée ;
 * - ligne dont le mode de vente a disparu/inactif → supprimée ;
 * - snapshot produit remplacé par l'état courant (prix, stock, modes) ;
 * - quantité bornée en unités de base, cumul des lignes du même produit ;
 * - deux lignes devenant identiques (produit + mode) → fusionnées ;
 * - index actif hors bornes → 0.
 * Fonction pure : ni effet de bord ni entrée système.
 *
 * @param {{paniers: Array, actif: number, seq: number}} brut brouillon lu
 * @param {Array<any>} produits catalogue courant
 * @returns {{paniers: Array, actif: number, seq: number}}
 */
export function revaliderBrouillon(brut, produits) {
  const parId = new Map((produits ?? []).map((p) => [p.id, p]))
  const paniers = (brut?.paniers ?? []).map((p) => {
    const items = []
    const besoin = new Map() // produitId → unités de base déjà prises
    for (const l of p.items ?? []) {
      const courant = parId.get(l?.produit?.id)
      if (!courant) continue
      const stock = Math.max(0, Math.trunc(Number(courant.quantite ?? courant.stock ?? 0)))
      if (stock <= 0) continue
      const mode = modeRestaurable(courant, l.conditionnement)
      if (!mode) continue // mode retiré du catalogue
      const facteur = Math.max(1, Math.trunc(Number(mode.facteur) || 1))
      const pris = besoin.get(courant.id) ?? 0
      const max = maxQuantiteLigne(facteur, stock, pris)
      if (max < 1) continue
      const quantite = Math.min(Math.max(1, Math.trunc(l.quantite)), max)
      const cle = ligneCle(courant.id, mode)
      const existant = items.find((i) => cleDeLigne(i) === cle)
      if (existant) {
        // fusion : on retire la part déjà comptée pour cette ligne, on re-borna
        const prisHors = pris - existant.quantite * facteur
        const maxEx = maxQuantiteLigne(facteur, stock, prisHors)
        const fusion = Math.min(existant.quantite + quantite, maxEx)
        besoin.set(courant.id, prisHors + fusion * facteur)
        existant.quantite = fusion
        existant.produit = { ...l.produit, ...courant }
        existant.conditionnement = mode
        continue
      }
      besoin.set(courant.id, pris + quantite * facteur)
      items.push({
        produit: { ...l.produit, ...courant },
        conditionnement: mode,
        quantite,
      })
    }
    return { id: p.id, items }
  })
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

/** Nombre total de lignes (tous paniers confondus) — suivi des retraits. */
export function compterLignes(etat) {
  return (etat?.paniers ?? []).reduce((s, p) => s + (p.items?.length ?? 0), 0)
}
