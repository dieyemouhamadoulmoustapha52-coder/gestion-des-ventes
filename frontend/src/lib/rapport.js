/**
 * Fonctions pures du rapport (@audience patron) — agrégations de présentation.
 *
 * Les règles de calcul des rapports (chiffre d'affaires, encaissements par
 * mode, catégories, top produits, comparaison mensuelle, stock bas) sont
 * celles de l'API et de `lib/stats.js` : ces fonctions ne font que regrouper,
 * trier, limiter et rendre affichables les valeurs déjà calculées.
 *
 * Aucune dépendance système — testées par Vitest (`rapport.test.js`).
 */
import { toNumber } from './money.js'
import { variationPct } from './stats.js'

/**
 * Part en pourcentage (non arrondie) — `partPourcent(370000, 1267800)`.
 * Le formatage localisé est `formatPart` (1 décimale, virgule française).
 * @param {number|string} valeur
 * @param {number|string} total
 * @returns {number} 0 si le total est nul
 */
export function partPourcent(valeur, total) {
  const t = toNumber(total)
  if (t <= 0) return 0
  return (toNumber(valeur) / t) * 100
}

/**
 * Part en % au format français : `formatPart(29.184) → "29,2"`.
 * @param {number|string} part
 * @returns {string}
 */
export function formatPart(part) {
  return toNumber(part).toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/**
 * Regroupe les catégories : les `n` premières (déjà triées par l'API) plus
 * une ligne « Autres » qui agrège le reste (montant total + part).
 *
 * @param {Array<{categorie: string, ca: number|string}>} categories
 *   triées par CA décroissant (forme de `GET /api/rapports/jour/`)
 * @param {number} [n] nombre de catégories affichées (5 par défaut)
 * @param {number|string} [total] total de référence pour les parts
 *   (défaut : somme des catégories) — `ca_total` du rapport
 * @returns {{premieres: Array<{categorie: string, ca: number, part: number}>,
 *            autres: {nb: number, ca: number, part: number}|null,
 *            total: number}}
 */
export function grouperCategories(categories, n = 5, total = null) {
  const liste = (categories ?? []).map((c) => ({
    categorie: c.categorie,
    ca: toNumber(c.ca),
  }))
  const limite = Math.max(0, Math.trunc(n))
  const reference =
    total === null || total === undefined
      ? liste.reduce((somme, c) => somme + c.ca, 0)
      : toNumber(total)

  const premieres = liste.slice(0, limite).map((c) => ({
    ...c,
    part: partPourcent(c.ca, reference),
  }))

  const restantes = liste.slice(limite)
  const autres =
    restantes.length > 0
      ? {
          nb: restantes.length,
          ca: Math.round(restantes.reduce((somme, c) => somme + c.ca, 0) * 100) / 100,
          part: partPourcent(
            restantes.reduce((somme, c) => somme + c.ca, 0),
            reference,
          ),
        }
      : null

  return { premieres, autres, total: reference }
}

/**
 * Critère de criticité d'un produit en stock bas : plus le rapport
 * `stock / seuil` est faible, plus le produit est critique.
 * @param {{stock: number|string, seuil_alerte?: number|string,
 *          seuil?: number|string}} produit
 * @returns {number}
 */
function criticite(produit) {
  const stock = toNumber(produit.stock)
  const seuil = toNumber(produit.seuil_alerte ?? produit.seuil)
  if (seuil > 0) return stock / seuil
  return stock === 0 ? 0 : Number.POSITIVE_INFINITY
}

/** Une rupture est toujours plus critique qu'un stock bas. */
function estRupture(produit) {
  return Boolean(produit.en_rupture) || toNumber(produit.stock) === 0
}

/**
 * Tient les produits à surveiller : ruptures d'abord, puis du plus critique
 * au moins critique (`stock / seuil` croissant), stock puis nom en départage.
 *
 * @param {Array<{nom: string, stock: number|string, seuil_alerte?: number|string,
 *                seuil?: number|string, en_rupture?: boolean}>} produits
 * @returns {Array} copie triée (liste d'origine inchangée)
 */
export function trierStock(produits) {
  return [...(produits ?? [])].sort((a, b) => {
    const rupture = Number(estRupture(b)) - Number(estRupture(a))
    if (rupture !== 0) return rupture
    const parCriticite = criticite(a) - criticite(b)
    if (parCriticite !== 0) return parCriticite
    const parStock = toNumber(a.stock) - toNumber(b.stock)
    if (parStock !== 0) return parStock
    return String(a.nom ?? '').localeCompare(String(b.nom ?? ''), 'fr')
  })
}

/**
 * Limite une liste à `n` éléments pour un dépliage en ligne.
 * @template T
 * @param {T[]} liste
 * @param {number} n
 * @returns {T[]} au plus `n` éléments (jamais `undefined`)
 */
export function limiter(liste, n) {
  const max = Math.max(0, Math.trunc(n))
  return Array.isArray(liste) ? liste.slice(0, max) : []
}

/**
 * Variation à afficher pour une comparaison de périodes.
 *
 * La période précédente est réputée absente quand elle n'a **aucune vente**
 * (ou est manquante) : on n'affiche ni zéro ni tiret mais un message clair
 * (« Pas encore de comparaison disponible »).
 *
 * @param {{ca: number, nbVentes: number, benefice?: number|null}|null|undefined} courant
 * @param {{ca: number, nbVentes: number, benefice?: number|null}|null|undefined} precedent
 * @returns {{disponible: boolean, ca: number|null, nbVentes: number|null,
 *            benefice: number|null}}
 */
export function variationAffichable(courant, precedent) {
  const c = courant ?? null
  const p = precedent ?? null

  if (!c || !p || toNumber(p.nbVentes) <= 0) {
    return { disponible: false, ca: null, nbVentes: null, benefice: null }
  }

  return {
    disponible: true,
    ca: variationPct(c.ca, p.ca),
    nbVentes: variationPct(c.nbVentes, p.nbVentes),
    benefice:
      c.benefice !== null && c.benefice !== undefined &&
      p.benefice !== null && p.benefice !== undefined
        ? variationPct(c.benefice, p.benefice)
        : null,
  }
}

/**
 * Marge brute d'une période : `Σ (total_ligne − cout_unitaire_base × quantite_base)`.
 * Repli sur `prix_achat` pour les anciennes lignes dépourvues de coût figé.
 * `null` dès qu'une ligne manque de coût (comme `agregerPeriode` de `stats.js`)
 * : l'écran omet alors la carte plutôt que d'afficher un zéro trompeur.
 *
 * @param {Array<{date_vente: string, lignes?: Array<any>}>} ventes
 * @param {[string, string]} periode [du, au] 'YYYY-MM-DD' inclusifs
 * @returns {number|null} arrondie à 2 décimales
 */
export function beneficePeriode(ventes, [du, au]) {
  let total = 0
  let nbLignes = 0
  let disponible = true

  for (const v of ventes ?? []) {
    const d = String(v.date_vente ?? '').slice(0, 10)
    if (!d || d < du || d > au) continue

    const lignes = v.lignes ?? []
    if (lignes.length === 0) {
      disponible = false
      continue
    }

    for (const l of lignes) {
      const cout = l?.cout_unitaire_base ?? l?.prix_achat
      if (cout === null || cout === undefined || cout === '') {
        disponible = false
        continue
      }
      const quantite = Number.isInteger(l?.quantite_base)
        ? l.quantite_base
        : (Number(l?.quantite) || 0) * Math.max(1, Math.trunc(toNumber(l?.facteur) || 1))
      const montant = toNumber(l?.total_ligne ?? l?.montant_ligne)
      total += montant - toNumber(cout) * quantite
      nbLignes += 1
    }
  }

  if (!disponible || nbLignes === 0) return null
  return Math.round(total * 100) / 100
}

/**
 * Top `n` produits d'une journée : quantité vendue en UNITÉS DE BASE et CA.
 * Même cumul que `topProduits` de `stats.js`, borné à une seule journée.
 *
 * @param {Array<{date_vente: string, lignes?: Array<any>}>} ventes
 * @param {string} date 'YYYY-MM-DD'
 * @param {number} [n]
 * @returns {Array<{produit: number, nom: string, code: string, qte: number, ca: number}>}
 */
export function topProduitsJour(ventes, date, n = 5) {
  const cumul = new Map()

  for (const v of ventes ?? []) {
    const d = String(v.date_vente ?? '').slice(0, 10)
    if (d !== date) continue

    for (const l of v.lignes ?? []) {
      if (l?.produit === null || l?.produit === undefined) continue
      const e = cumul.get(l.produit) ?? {
        produit: l.produit,
        nom: l.produit_nom ?? '',
        code: l.produit_code ?? '',
        qte: 0,
        ca: 0,
      }
      e.qte += Number.isInteger(l.quantite_base)
        ? l.quantite_base
        : (Number(l.quantite) || 0) * Math.max(1, Math.trunc(toNumber(l.facteur) || 1))
      e.ca +=
        toNumber(l.montant_ligne) ||
        toNumber(l.prix_unitaire) * (Number(l.quantite) || 0)
      if (l.produit_nom) e.nom = l.produit_nom
      if (l.produit_code) e.code = l.produit_code
      cumul.set(l.produit, e)
    }
  }

  return [...cumul.values()]
    .sort((a, b) => b.qte - a.qte || b.ca - a.ca || a.produit - b.produit)
    .slice(0, Math.max(0, Math.trunc(n)))
    .map((e) => ({ ...e, ca: Math.round(e.ca * 100) / 100 }))
}
