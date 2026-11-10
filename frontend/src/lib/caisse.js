/**
 * Fonctions pures de la caisse rapide — @audience caissier.
 * Aucune dépendance : testées par Vitest, réutilisées par l'écran Caisse.
 */

/**
 * Calcule la monnaie à rendre ou le montant manquant.
 * `recu` vide/absent → statut 'vide' (l'encaissement reste autorisé).
 *
 * @param {number} total montant à payer en FCFA
 * @param {string|number|null|undefined} recu montant reçu saisi ("" si vide)
 * @returns {{statut: 'vide'|'insuffisant'|'ok', monnaie: number, manque: number}}
 *   - 'vide'        : rien de saisie, monnaie = 0, manque = 0
 *   - 'insuffisant' : recu < total → monnaie = 0, manque = total − recu
 *   - 'ok'          : recu ≥ total → monnaie = recu − total, manque = 0
 */
export function calculerMonnaie(total, recu) {
  const t = Number.isFinite(Number(total)) ? Number(total) : 0
  if (recu === null || recu === undefined || String(recu).trim() === '') {
    return { statut: 'vide', monnaie: 0, manque: 0 }
  }
  const n = Number(String(recu).trim().replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(n)) return { statut: 'vide', monnaie: 0, manque: 0 }
  if (n < t) return { statut: 'insuffisant', monnaie: 0, manque: Math.round((t - n) * 100) / 100 }
  return { statut: 'ok', monnaie: Math.round((n - t) * 100) / 100, manque: 0 }
}

/**
 * Filtre les produits pour la recherche rapide (insensible à la casse/accents).
 * Recherche sur le nom ET le code (référence) lorsque celui-ci existe.
 *
 * @param {Array<{nom: string, code?: string}>} produits
 * @param {string} terme texte saisi par le caissier
 * @returns {Array} produits correspondants, dans l'ordre d'origine
 */
export function filtrerProduits(produits, terme) {
  const q = normalize(terme)
  if (!q) return []
  return (produits ?? []).filter((p) => normalize(p.nom).includes(q) || (p.code && normalize(p.code).includes(q)))
}

function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/**
 * Les plus vendus : quantités totales par produit sur un jeu de ventes
 * (chaque vente porte ses lignes), tri décroissant, top N.
 *
 * @param {Array<{lignes?: Array<{produit: number, quantite: number}>}>} ventes
 * @param {number} [n] nombre max de produits retournés (8 en caisse)
 * @returns {Array<{produit: number, quantite: number}>}
 */
export function topVendus(ventes, n = 8) {
  const qtes = new Map()
  for (const v of ventes ?? []) {
    for (const l of v.lignes ?? []) {
      const id = l?.produit
      if (id === null || id === undefined) continue
      qtes.set(id, (qtes.get(id) ?? 0) + (Number(l.quantite) || 0))
    }
  }
  return [...qtes.entries()]
    .map(([produit, quantite]) => ({ produit, quantite }))
    .sort((a, b) => b.quantite - a.quantite || a.produit - b.produit)
    .slice(0, Math.max(0, n))
}
