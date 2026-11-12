/**
 * Statistiques mensuelles — rapport « Ce mois-ci vs mois précédent »
 * @audience patron. Fonctions pures (testées par Vitest) : aucune dépendance
 * système, dates en chaîne 'YYYY-MM-DD' (fuseau Africa/Dakar, cf. lib/dates.js).
 */
import { dateDakar } from './dates.js'
import { toNumber } from './money.js'

/** Dernier jour (inclus) d'un mois : nombre de jours 28/29/30/31. */
function joursDuMois(annee, mois0) {
  return new Date(Date.UTC(annee, mois0 + 1, 0)).getUTCDate()
}

/**
 * Bornes des périodes comparées à partir de la date de référence.
 * - mois en cours : du 1er au jour de `ref` inclus ;
 * - mois précédent à nombre de jours égal (borné au nombre de jours du mois) ;
 * - mois précédent complet.
 * @param {string} ref 'YYYY-MM-DD'
 * @returns {{courant: [string,string], precedentMemeJours: [string,string],
 *            precedentComplet: [string,string]}}
 */
export function bornesMois(ref = dateDakar()) {
  const [y, m, j] = String(ref).split('-').map(Number)
  const mois0 = (m ?? 1) - 1
  const jourRef = j ?? 1

  const debutCourant = `${ref.slice(0, 7)}-01`
  const finCourant = ref

  const py = mois0 === 0 ? y - 1 : y
  const pm = mois0 === 0 ? 11 : mois0 - 1
  const prefixePrec = `${py}-${String(pm + 1).padStart(2, '0')}`
  const nbJours = joursDuMois(py, pm)
  const memeJours = Math.min(jourRef, nbJours)

  return {
    courant: [debutCourant, finCourant],
    precedentMemeJours: [`${prefixePrec}-01`, `${prefixePrec}-${String(memeJours).padStart(2, '0')}`],
    precedentComplet: [`${prefixePrec}-01`, `${prefixePrec}-${String(nbJours).padStart(2, '0')}`],
  }
}

/**
 * Agrège CA, nombre de ventes et bénéfice sur une période (bornes inclusives).
 * Le bénéfice n'est calculé que si le prix d'achat est disponible sur TOUTES
 * les lignes ; sinon `benefice: null` (affichage « — »).
 *
 * @param {Array<{date_vente: string, montant_total: number|string,
 *                lignes?: Array<{prix_unitaire: number, quantite: number,
 *                                prix_achat?: number|string}>}>} ventes
 * @param {[string, string]} periode [du, au] 'YYYY-MM-DD'
 * @returns {{ca: number, nbVentes: number, benefice: number|null}}
 */
export function agregerPeriode(ventes, [du, au]) {
  let ca = 0
  let nbVentes = 0
  let benefice = 0
  let beneficeDisponible = true

  for (const v of ventes ?? []) {
    const d = String(v.date_vente ?? '').slice(0, 10)
    if (!d || d < du || d > au) continue
    nbVentes += 1
    ca += toNumber(v.montant_total)
    const lignes = v.lignes ?? []
    if (lignes.length === 0) beneficeDisponible = false
    for (const l of lignes) {
      const pa = l?.prix_achat
      if (pa === null || pa === undefined || pa === '') {
        beneficeDisponible = false
        continue
      }
      benefice += (toNumber(l.prix_unitaire) - toNumber(pa)) * (Number(l.quantite) || 0)
    }
  }

  return {
    ca: Math.round(ca * 100) / 100,
    nbVentes,
    benefice: beneficeDisponible && nbVentes > 0 ? Math.round(benefice * 100) / 100 : null,
  }
}

/**
 * Variation en % : `((actuel − précédent) / précédent) × 100`.
 * Division par zéro (précédent à 0) → null (affiché « — »).
 * @param {number} actuel
 * @param {number} precedent
 * @returns {number|null} arrondie à 1 décimale
 */
export function variationPct(actuel, precedent) {
  const p = Number(precedent)
  if (!Number.isFinite(p) || p === 0) return null
  return Math.round(((Number(actuel) - p) / p) * 1000) / 10
}

/**
 * Compare le mois en cours (1er → aujourd'hui) au même nombre de jours du
 * mois précédent, et au mois précédent complet.
 *
 * @param {Array} ventes jeu couvrant le mois précédent + le mois en cours
 * @param {string} [ref] 'YYYY-MM-DD' (défaut : aujourd'hui, fuseau Dakar)
 * @returns {{bornes: ReturnType<typeof bornesMois>,
 *   courant: {ca: number, nbVentes: number, benefice: number|null},
 *   precedentMemeJours: {ca: number, nbVentes: number, benefice: number|null},
 *   precedentComplet: {ca: number, nbVentes: number, benefice: number|null},
 *   variations: {ca: number|null, nbVentes: number|null, benefice: number|null}}}
 */
export function comparerMois(ventes, ref = dateDakar()) {
  const bornes = bornesMois(ref)
  const courant = agregerPeriode(ventes, bornes.courant)
  const precedentMemeJours = agregerPeriode(ventes, bornes.precedentMemeJours)
  const precedentComplet = agregerPeriode(ventes, bornes.precedentComplet)

  return {
    bornes,
    courant,
    precedentMemeJours,
    precedentComplet,
    variations: {
      ca: variationPct(courant.ca, precedentMemeJours.ca),
      nbVentes: variationPct(courant.nbVentes, precedentMemeJours.nbVentes),
      benefice:
        courant.benefice !== null && precedentMemeJours.benefice !== null
          ? variationPct(courant.benefice, precedentMemeJours.benefice)
          : null,
    },
  }
}

/**
 * Top N produits du mois en cours (quantité vendue en UNITÉS DE BASE, CA),
 * avec variation de quantité vs le mois précédent à nombre de jours égal.
 * Une ligne « 2 cartons ×12 » compte pour 24 (et non 2).
 *
 * @param {Array<{date_vente: string, montant_total: number|string,
 *                lignes?: Array<{produit: number, produit_nom?: string,
 *                                produit_code?: string, quantite: number,
 *                                facteur?: number, quantite_base?: number,
 *                                prix_unitaire: number, montant_ligne: number|string}>}>} ventes
 * @param {string} [ref] 'YYYY-MM-DD'
 * @param {number} [n] taille du top (5 par défaut)
 * @returns {Array<{produit: number, nom: string, code: string, qte: number,
 *                  ca: number, qtePrecedent: number, variation: number|null}>}
 */
export function topProduits(ventes, ref = dateDakar(), n = 5) {
  const bornes = bornesMois(ref)
  const cumul = (periode) => {
    const m = new Map()
    for (const v of ventes ?? []) {
      const d = String(v.date_vente ?? '').slice(0, 10)
      if (!d || d < periode[0] || d > periode[1]) continue
      for (const l of v.lignes ?? []) {
        if (l?.produit === null || l?.produit === undefined) continue
        const e = m.get(l.produit) ?? {
          produit: l.produit,
          nom: l.produit_nom ?? '',
          code: l.produit_code ?? '',
          qte: 0,
          ca: 0,
        }
        // quantité en unités de base (facteur × modes), sinon mode lui-même
        e.qte += Number.isInteger(l.quantite_base)
          ? l.quantite_base
          : (Number(l.quantite) || 0) * Math.max(1, Math.trunc(toNumber(l.facteur) || 1))
        e.ca += toNumber(l.montant_ligne) || toNumber(l.prix_unitaire) * (Number(l.quantite) || 0)
        if (l.produit_nom) e.nom = l.produit_nom
        if (l.produit_code) e.code = l.produit_code
        m.set(l.produit, e)
      }
    }
    return m
  }

  const actuels = cumul(bornes.courant)
  const precedents = cumul(bornes.precedentMemeJours)

  return [...actuels.values()]
    .sort((a, b) => b.qte - a.qte || b.ca - a.ca || a.produit - b.produit)
    .slice(0, Math.max(0, n))
    .map((e) => {
      const qtePrecedent = precedents.get(e.produit)?.qte ?? 0
      return {
        ...e,
        ca: Math.round(e.ca * 100) / 100,
        qtePrecedent,
        variation: variationPct(e.qte, qtePrecedent),
      }
    })
}
