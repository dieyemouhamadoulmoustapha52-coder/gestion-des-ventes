/**
 * Validation du formulaire produit (@audience patron) — couche PURE.
 *
 * Mêmes règles que le service mock : champs requis, entiers ≥ 0, prix > 0,
 * puis la liste complète des modes via `validerConditionnements` (codes occupés
 * = codes produits transmis + codes des modes de ce produit retirés du
 * formulaire). Construit aussi le corps POST/PUT du contrat.
 * Testée par Vitest, utilisée par `ProduitForm`.
 */
import { UNITE_MAX, validerConditionnements } from './conditionnements.js'

/** Entier ≥ 0 à partir d'une saisie ('' → 0, invalide → null). */
export function entierSaisi(valeur) {
  const t = String(valeur ?? '').trim()
  if (t === '') return 0
  const n = Number(t)
  return Number.isInteger(n) && n >= 0 ? n : null
}

/**
 * Lignes du tableau « modes de vente » → forme du contrat.
 * La ligne Détail reçoit `facteur: 1`, aucun code, et le prix du détail.
 * @param {{modes: Array<any>}} form
 * @param {number} prix prix du détail (section Unités & prix)
 * @returns {Array<{id: number|null, libelle: string, facteur: number,
 *   prix_vente: number, code: string, est_detail: boolean, actif: boolean}>}
 */
export function modesDepuisFormulaire(form, prix) {
  return (form?.modes ?? []).map((m) => {
    const estDetail = m?.est_detail === true
    return {
      id: m?.id ?? null,
      libelle: String(m?.libelle ?? '').trim(),
      facteur: estDetail ? 1 : Number(m?.facteur),
      prix_vente: estDetail ? Number(prix) : Number(m?.prix_vente),
      code: estDetail ? '' : String(m?.code ?? '').trim().toUpperCase(),
      est_detail: estDetail,
      actif: m?.actif !== false,
    }
  })
}

/**
 * Valide le formulaire complet et construit le payload du contrat.
 *
 * @param {{code: string, nom: string, categorie: string, unite_base: string,
 *   prix_achat: string, prix: string, quantite: string, seuil_alerte: string,
 *   modes: Array<any>}} form valeurs de saisie (chaînes)
 * @param {{produit?: import('../api/types.js').Produit|null,
 *   codesProduits?: string[]}} [opts] produit édité + codes produits connus
 *   (sert au contrôle des codes de modes ; le service reste l'arbitre)
 * @returns {{valide: boolean, champs: Record<string, string>,
 *   parMode: Array<Record<string, string>>, global: string[],
 *   modes: Array<any>, data: object|null}}
 */
export function validerFormulaireProduit(form, opts = {}) {
  const produit = opts.produit ?? null
  const codesProduits = opts.codesProduits ?? []
  const champs = {}

  const code = String(form?.code ?? '').trim()
  const nom = String(form?.nom ?? '').trim()
  const unite = String(form?.unite_base ?? '').trim() || 'unité'
  const prix = Number(form?.prix)
  const prixAchat = String(form?.prix_achat ?? '').trim() === '' ? 0 : Number(form?.prix_achat)
  const quantite = entierSaisi(form?.quantite)
  const seuil = entierSaisi(form?.seuil_alerte)

  if (!code) champs.code = 'Ce champ est requis.'
  if (!nom) champs.nom = 'Ce champ est requis.'
  if (!String(form?.categorie ?? '').trim()) champs.categorie = 'Ce champ est requis.'
  if (!(prix > 0)) champs.prix = 'Le prix doit être supérieur à 0.'
  if (!Number.isFinite(prixAchat) || prixAchat < 0) {
    champs.prix_achat = 'Saisissez un coût valide (≥ 0).'
  }
  if (quantite === null) champs.quantite = 'Entier positif attendu.'
  if (seuil === null) champs.seuil_alerte = 'Entier positif attendu.'
  if (unite.length > UNITE_MAX) champs.unite_base = `${UNITE_MAX} caractères maximum.`

  const modes = modesDepuisFormulaire(form, prix)
  // codes encore pris par ce produit hors de la liste soumise (modes retirés)
  const codesRetires = (produit?.conditionnements ?? [])
    .filter((m) => m?.code && !modes.some((x) => x.id !== null && x.id === m.id))
    .map((m) => m.code)
  const { global, modes: parMode } = validerConditionnements(modes, {
    codesOccupes: [...codesProduits, ...codesRetires],
  })

  const valide =
    Object.keys(champs).length === 0 &&
    global.length === 0 &&
    parMode.every((m) => Object.keys(m).length === 0)

  const data = valide
    ? {
        code,
        nom,
        categorie: Number(form.categorie),
        unite_base: unite,
        prix_achat: prixAchat,
        prix,
        quantite,
        seuil_alerte: seuil,
        conditionnements: modes.map((m) => ({
          ...(m.id !== null ? { id: m.id } : {}),
          libelle: m.libelle,
          facteur: m.facteur,
          prix_vente: m.prix_vente,
          ...(m.code ? { code: m.code } : {}),
          est_detail: m.est_detail,
        })),
      }
    : null

  return { valide, champs, parMode, global, modes, data }
}
