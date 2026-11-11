/**
 * Adaptateur de contrat — LE seul endroit où les noms de champs du contrat
 * (« prix », « quantite », « total », « moyen_paiement »…) rencontrent les noms
 * vus par les écrans. Quand le vrai backend sera branché, on n'ajuste qu'ici.
 *
 * Double travail :
 *  1. normalisation (Decimal DRF en chaîne → nombre, produits sans
 *     `conditionnements` → Détail dérivé via `normaliserProduit`) ;
 *  2. alias « legacy » (`prix_unitaire`, `stock`, `montant_total`…) conservés
 *     pour les écrans non encore migrés — `@alias` à supprimer à la migration.
 *
 * Les allers (corps POST/PUT) partent tels quels : les écrans envoient déjà
 * les noms du contrat.
 */
import { normaliserProduit, normaliserConditionnement } from '../lib/conditionnements.js'
import { toNumber } from '../lib/money.js'

/**
 * Produit brut (contrat) → objet vu par les écrans.
 * @param {any} brut
 * @returns {any}
 */
export function versVueProduit(brut) {
  const p = normaliserProduit(brut)
  if (!p || typeof p !== 'object') return p
  const prix = toNumber(p.prix)
  return {
    ...p,
    prix,
    prix_achat: toNumber(p.prix_achat),
    conditionnements: (p.conditionnements ?? []).map(versVueConditionnement),
    // @alias legacy (API historique) — voir en-tête de fichier
    prix_unitaire: prix,
    stock: p.quantite,
    seuil: p.seuil_alerte,
  }
}

/** Mode de vente → nombres (prix_vente Decimal → number). */
export function versVueConditionnement(brut) {
  const c = normaliserConditionnement(brut)
  return { ...c, prix_vente: toNumber(c.prix_vente) }
}

/**
 * Ligne de vente (snapshot du contrat) → objet vu par les écrans.
 * Anciennes lignes : libellé « Détail », facteur 1, `quantite_base = quantite`.
 * @param {any} brut
 * @param {{produit_nom?: string, produit_code?: string, prix_achat?: number}} [enrichi]
 * @returns {any}
 */
export function versVueLigne(brut, enrichi = {}) {
  if (!brut || typeof brut !== 'object') return brut
  const facteur = Math.max(1, Math.trunc(toNumber(brut.facteur) || 1))
  const quantite = Math.max(0, Math.trunc(toNumber(brut.quantite)))
  const prixUnitaire = toNumber(brut.prix_unitaire)
  const total = toNumber(brut.total_ligne ?? brut.montant_ligne) || prixUnitaire * quantite
  const estDetail = brut.est_detail !== false && facteur === 1
  return {
    ...brut,
    ...enrichi,
    quantite,
    facteur,
    libelle: String(brut.libelle ?? '').trim() || (estDetail ? 'Détail' : `×${facteur}`),
    est_detail: estDetail,
    conditionnement: brut.conditionnement ?? null,
    quantite_base: Math.max(0, Math.trunc(toNumber(brut.quantite_base) || quantite * facteur)),
    prix_unitaire: prixUnitaire,
    cout_unitaire_base:
      brut.cout_unitaire_base !== undefined && brut.cout_unitaire_base !== null
        ? toNumber(brut.cout_unitaire_base)
        : enrichi.prix_achat !== undefined && enrichi.prix_achat !== null
          ? toNumber(enrichi.prix_achat)
          : null,
    total_ligne: total,
    // @alias legacy (API historique)
    montant_ligne: total,
  }
}

/**
 * Vente → objet vu par les écrans. Le contrat répond `total`/`moyen_paiement`
 * sur POST ; GET renvoie encore `montant_total`/`mode_paiement` : les deux
 * sont acceptés ici.
 * @param {any} brut
 * @param {Array<any>} [lignes]
 * @returns {any}
 */
export function versVueVente(brut, lignes) {
  if (!brut || typeof brut !== 'object') return brut
  const total = toNumber(brut.montant_total ?? brut.total)
  const mode = brut.mode_paiement ?? brut.moyen_paiement ?? ''
  const vue = {
    ...brut,
    montant_total: total,
    total,
    mode_paiement: mode,
    moyen_paiement: mode,
  }
  if (Array.isArray(lignes)) vue.lignes = lignes
  else if (Array.isArray(brut.lignes)) vue.lignes = brut.lignes.map((l) => versVueLigne(l))
  return vue
}

/**
 * Page paginée → vue complète des résultats.
 * @template T
 * @param {any} page
 * @param {(item: any) => T} [map]
 * @returns {any}
 */
export function versVuePage(page, map = versVueProduit) {
  if (!page || typeof page !== 'object') return page
  return { ...page, results: Array.isArray(page.results) ? page.results.map(map) : [] }
}
