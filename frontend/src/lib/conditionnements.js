/**
 * Modes de vente (conditionnements) — couche contrat PURE.
 *
 * Un produit = UN SEUL stock, en « unités de base » ; chaque mode de vente
 * contient un nombre entier d'unités de base (le `facteur`) et a son propre
 * prix. Phase 1 : quantités ENTIÈRES uniquement.
 *
 * Aucune dépendance système : testées par Vitest, réutilisées par le formulaire
 * produit (@audience patron), la caisse (@audience caissier) et le mock.
 * `normaliserProduit()` sert à la frontière API (src/api/adaptateur.js) et sur
 * toute donnée persistée (brouillon localStorage).
 */
import { formatNombre, toNumber } from './money.js'

/** Suggestions d'unité de base (formulaire produit). */
export const SUGGESTIONS_UNITE = ['unité', 'bouteille', 'pièce', 'sachet', 'paquet', 'boîte']

/** Suggestions de libellé pour un nouveau mode de vente. */
export const SUGGESTIONS_MODE = ['Demi-carton', 'Carton', 'Sac', 'Lot de 6', 'Paquet']

/** Longueur maximale de l'unité de base. */
export const UNITE_MAX = 30

/**
 * @typedef {Object} Conditionnement Mode de vente d'un produit.
 * @property {number|null} id `null` pour un Détail dérivé (produit sans mode enregistré)
 * @property {string} libelle non vide, unique par produit (insensible à la casse)
 * @property {number} facteur entier ≥ 1 — unités de base contenues dans le mode
 * @property {number} prix_vente FCFA pour un mode entier (> 0)
 * @property {string} code optionnel, sans espaces, en MAJUSCULES, unique (aucun pour le Détail)
 * @property {boolean} est_detail exactement UN mode de facteur 1
 * @property {boolean} actif un mode retiré passe à `false` (jamais supprimé)
 * @property {number} ordre position dans la liste
 */

/**
 * @typedef {Object} ProduitContrat Produit tel que défini par le contrat d'API.
 * @property {number} id
 * @property {string} code
 * @property {string} nom
 * @property {number} categorie id de la catégorie
 * @property {string} unite_base ex. « bouteille », « pièce » (30 caractères max)
 * @property {number|string} prix_achat coût d'UNE unité de base (décimal, 2 chiffres)
 * @property {number|string} quantite stock EN UNITÉS DE BASE
 * @property {number|string} seuil_alerte en unités de base
 * @property {number|string} prix prix du mode Détail (toujours synchronisé)
 * @property {Conditionnement[]} conditionnements
 */

/** Entier ≥ 0 (NaN → 0). */
function entierPositif(valeur) {
  const n = Math.trunc(toNumber(valeur))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Texte « n unité(s) » (pluriel simple). */
function unites(n) {
  return `${n} unité${n > 1 ? 's' : ''}`
}

/** Pluriel simple d'un libellé en bas de phrase : « Carton » → « cartons ». */
function pluriel(libelle, quantite) {
  const mot = String(libelle ?? '').trim().toLowerCase()
  if (quantite <= 1) return mot
  return mot.endsWith('s') || mot.endsWith('x') ? mot : `${mot}s`
}

/**
 * Normalise un produit au contrat : unité de base, stock/seuil/prix en nombres,
 * et surtout `conditionnements` — un produit sans reçoit un Détail issu de `prix`.
 * Appelé à la frontière API et sur toute donnée persistée (brouillon v1…).
 *
 * @param {Partial<ProduitContrat> & Record<string, any>} produit
 * @returns {any} copie normalisée (jamais mutée)
 */
export function normaliserProduit(produit) {
  if (!produit || typeof produit !== 'object') return produit
  const prix = toNumber(produit.prix ?? produit.prix_unitaire)
  const quantite = entierPositif(produit.quantite ?? produit.stock)
  const seuil = Math.max(0, Math.trunc(toNumber(produit.seuil_alerte ?? produit.seuil)))
  const modes = Array.isArray(produit.conditionnements)
    ? produit.conditionnements.filter(Boolean).map(normaliserConditionnement)
    : []

  return {
    ...produit,
    unite_base: String(produit.unite_base || 'unité').slice(0, UNITE_MAX),
    prix,
    prix_achat: toNumber(produit.prix_achat),
    quantite,
    seuil_alerte: seuil,
    est_en_alerte: produit.est_en_alerte ?? quantite <= seuil,
    conditionnements: modes.length > 0 ? trierModes(modes) : [detailDerive(prix)],
  }
}

/**
 * Normalise un mode de vente (nombres, défauts). Le `id` reste tel quel
 * (null pour un Détail dérivé).
 * @param {Partial<Conditionnement>} mode
 * @returns {Conditionnement}
 */
export function normaliserConditionnement(mode) {
  const facteur = Math.max(1, Math.trunc(toNumber(mode?.facteur) || 1))
  const estDetail = mode?.est_detail === true || facteur === 1
  return {
    id: Number.isInteger(mode?.id) ? mode.id : null,
    libelle: String(mode?.libelle ?? '').trim(),
    facteur,
    prix_vente: toNumber(mode?.prix_vente),
    code: String(mode?.code ?? '').trim().toUpperCase(),
    est_detail: estDetail,
    actif: mode?.actif !== false,
    ordre: Number.isInteger(mode?.ordre) ? mode.ordre : 0,
  }
}

/** Détail dérivé d'un prix (produit sans modes enregistrés). */
function detailDerive(prix) {
  return {
    id: null,
    libelle: 'Détail',
    facteur: 1,
    prix_vente: toNumber(prix),
    code: '',
    est_detail: true,
    actif: true,
    ordre: 0,
  }
}

/**
 * Trie les modes par facteur croissant (Détail → plus gros conditionnement),
 * puis par `ordre` pour facteurs égaux.
 * @param {Conditionnement[]} modes
 * @returns {Conditionnement[]} nouveau tableau
 */
export function trierModes(modes) {
  return [...(modes ?? [])].sort(
    (a, b) => toNumber(a.facteur) - toNumber(b.facteur) || (a.ordre ?? 0) - (b.ordre ?? 0),
  )
}

/** Modes actifs d'un produit, triés par facteur croissant. */
export function modesActifs(produit) {
  return trierModes((produit?.conditionnements ?? []).filter((m) => m?.actif !== false))
}

/** Mode « Détail » d'un produit (dérivé si absent). */
export function modeDetail(produit) {
  const modes = produit?.conditionnements ?? []
  return modes.find((m) => m?.est_detail || m?.facteur === 1) ?? detailDerive(produit?.prix)
}

/** Retrouve un mode par son id (null/undefined → détail). */
export function modeParId(produit, id) {
  if (id === null || id === undefined || id === '') return modeDetail(produit)
  return (produit?.conditionnements ?? []).find((m) => m?.id === Number(id)) ?? null
}

/**
 * Unités de base consommées par une quantité de modes.
 * @param {number} quantite nombre de modes (entier)
 * @param {number} facteur unités de base par mode (entier ≥ 1)
 * @returns {number}
 */
export function quantiteBase(quantite, facteur) {
  return entierPositif(quantite) * Math.max(1, Math.trunc(toNumber(facteur) || 1))
}

/**
 * Prix d'UNE unité de base pour un mode (non arrondi — arrondi à l'affichage).
 * @param {number} prixVente prix du mode
 * @param {number} facteur
 * @returns {number}
 */
export function prixParUnite(prixVente, facteur) {
  const f = Math.max(1, Math.trunc(toNumber(facteur) || 1))
  return toNumber(prixVente) / f
}

/**
 * Économie réalisée en achetant le mode plutôt que le détail : positif = remise,
 * négatif = mode plus cher que `facteur × détail`.
 * @param {number} prixVente prix du mode
 * @param {number} facteur
 * @param {number} prixDetail prix du mode Détail
 * @returns {number} FCFA (arrondi 2 décimales)
 */
export function remiseVsDetail(prixVente, facteur, prixDetail) {
  const f = Math.max(1, Math.trunc(toNumber(facteur) || 1))
  return arr2(toNumber(prixDetail) * f - toNumber(prixVente))
}

/**
 * Coût d'UNE unité de base pour un mode acheté en vrac (arrondi 2 décimales).
 * @param {number} prixAchatMode coût d'UN mode entier (ex. 13 000 le carton)
 * @param {number} facteur
 * @returns {number} ex. 1083.33
 */
export function coutParUnite(prixAchatMode, facteur) {
  const f = Math.max(1, Math.trunc(toNumber(facteur) || 1))
  return arr2(toNumber(prixAchatMode) / f)
}

/**
 * Marge FCFA d'un mode (prix de vente − coût des unités de base consommées).
 * @param {number} prixVente prix du mode
 * @param {number} facteur
 * @param {number} coutUnite coût d'une unité de base (prix_achat)
 * @returns {number} FCFA (arrondi 2 décimales) — négatif = vente à perte
 */
export function margeMode(prixVente, facteur, coutUnite) {
  const f = Math.max(1, Math.trunc(toNumber(facteur) || 1))
  return arr2(toNumber(prixVente) - toNumber(coutUnite) * f)
}

/** Arrondi à 2 décimales (coûts seulement — les FCFA de vente restent entiers). */
function arr2(n) {
  return Math.round((toNumber(n) + Number.EPSILON) * 100) / 100
}

/**
 * Nombre de modes entiers vendables avec le stock disponible.
 * @param {number} stock unités de base
 * @param {number} facteur
 * @returns {number}
 */
export function disponibleEnMode(stock, facteur) {
  const f = Math.max(1, Math.trunc(toNumber(facteur) || 1))
  return Math.max(0, Math.floor(Math.max(0, Math.trunc(toNumber(stock))) / f))
}

/**
 * Stock en toutes lettres : total en unités de base, puis le plus gros mode
 * vendable + le reste. `formaterStock(30, [Carton ×12])` → « 30 · 2 cartons +
 * 6 unités » ; sans mode vendable → « 6 unités » (pas de préfixe redondant).
 * @param {number} stock unités de base
 * @param {Array<Partial<Conditionnement>>} conditionnements
 * @returns {string} pluriel simple, jamais vide
 */
export function formaterStock(stock, conditionnements) {
  const s = Math.max(0, Math.trunc(toNumber(stock)))
  const candidats = (conditionnements ?? [])
    .filter((m) => m?.actif !== false && Math.trunc(toNumber(m?.facteur)) > 1)
    .sort((a, b) => toNumber(b.facteur) - toNumber(a.facteur))

  for (const mode of candidats) {
    const facteur = Math.trunc(toNumber(mode.facteur))
    const q = Math.floor(s / facteur)
    if (q < 1) continue
    const reste = s % facteur
    const parties = [`${q} ${pluriel(mode.libelle, q)}`]
    if (reste > 0) parties.push(unites(reste))
    return `${s} · ${parties.join(' + ')}`
  }
  return unites(s)
}

/**
 * Valide une liste complète de modes soumise (règles du contrat, en français).
 *
 * @param {Array<Partial<Conditionnement>>} modes liste complète (ordre = position)
 * @param {{codesOccupes?: string[]}} [opts] codes déjà pris par un produit ou par
 *   un mode hors de la liste soumise (comparaison insensible à la casse)
 * @returns {{global: string[], modes: Array<{libelle?: string, facteur?: string,
 *   prix_vente?: string, code?: string}>}} `global` = erreurs de liste,
 *   `modes[i]` = erreurs de champ du mode i (aligné sur la saisie)
 */
export function validerConditionnements(modes, opts = {}) {
  const liste = Array.isArray(modes) ? modes : []
  const global = []
  const parMode = liste.map(() => ({}))
  const codesOccupes = new Set(
    (opts.codesOccupes ?? []).map((c) => String(c ?? '').trim().toUpperCase()).filter(Boolean),
  )

  if (liste.length === 0) {
    global.push('Ajoutez au moins le mode « Au détail ».')
    return { global, modes: parMode }
  }

  // Détail : est_detail explicite, ou facteur 1 non marqué comme mode classique.
  const estDetailIdx = new Set(
    liste
      .map((m, i) => ((m?.est_detail === true || (m?.est_detail !== false &&
        Math.trunc(toNumber(m?.facteur)) === 1)) ? i : -1))
      .filter((i) => i >= 0),
  )
  if (estDetailIdx.size === 0) {
    global.push('Un mode « Au détail » (facteur 1) est requis.')
  } else if (estDetailIdx.size > 1) {
    global.push('Un seul mode peut être au détail.')
  }

  const vus = new Map() // libellé replié → index
  liste.forEach((m, i) => {
    const libelle = String(m?.libelle ?? '').trim()
    const facteur = Math.trunc(toNumber(m?.facteur))
    const prix = toNumber(m?.prix_vente)
    const code = String(m?.code ?? '').trim().toUpperCase()
    const estDetail = estDetailIdx.has(i)

    if (!libelle) {
      parMode[i].libelle = 'Le libellé est requis.'
    } else {
      const replie = libelle.toLowerCase()
      if (vus.has(replie)) {
        parMode[i].libelle = 'Ce libellé est déjà utilisé pour ce produit.'
      } else {
        vus.set(replie, i)
      }
    }

    if (estDetail) {
      if (facteur !== 1) {
        parMode[i].facteur = 'Le détail doit contenir exactement 1 unité.'
      }
    } else if (!Number.isInteger(toNumber(m?.facteur)) || facteur < 2) {
      parMode[i].facteur = 'Le facteur doit être un entier supérieur ou égal à 2.'
    }

    if (!(prix > 0)) {
      parMode[i].prix_vente = 'Le prix doit être supérieur à 0.'
    }

    if (m?.code !== undefined && m?.code !== null && String(m.code).trim() !== '') {
      if (/\s/.test(String(m.code))) {
        parMode[i].code = 'Le code ne doit pas contenir d’espace.'
      } else if (code && codesOccupes.has(code)) {
        parMode[i].code = 'Ce code est déjà utilisé par un produit ou un autre mode.'
      }
    }
  })

  return { global, modes: parMode }
}

/**
 * Besoin TOTAL en unités de base par produit (cumul des lignes).
 * 1 carton ×12 + 3 détails du même produit → 15.
 *
 * @param {Array<{produit: number, conditionnement?: {facteur?: number}|null,
 *                quantite: number}>} lignes
 * @returns {Map<number, number>} id produit → unités de base nécessaires
 */
export function besoinParProduit(lignes) {
  const besoin = new Map()
  for (const l of lignes ?? []) {
    const id = l?.produit
    if (id === null || id === undefined) continue
    const facteur = l?.conditionnement?.facteur ?? 1
    besoin.set(id, (besoin.get(id) ?? 0) + quantiteBase(l?.quantite, facteur))
  }
  return besoin
}

/**
 * Quantité MAXIMALE d'une ligne (un mode donné) sans dépasser le stock,
 * cumul des autres lignes du même produit déduits.
 *
 * @param {number} facteur facteur du mode de la ligne
 * @param {number} stock unités de base du produit
 * @param {number} [besoinHorsLigne] unités de base déjà prises par les AUTRES lignes
 * @returns {number} 0 si la ligne est déjà impossible
 */
export function maxQuantiteLigne(facteur, stock, besoinHorsLigne = 0) {
  const f = Math.max(1, Math.trunc(toNumber(facteur) || 1))
  const dispo = Math.max(0, Math.trunc(toNumber(stock)) - Math.max(0, toNumber(besoinHorsLigne)))
  return Math.max(0, Math.floor(dispo / f))
}

/**
 * Une ligne de vente est-elle un mode (non Détail) ?
 * Tolère les anciennes lignes sans snapshot (facteur absent = 1).
 * @param {{est_detail?: boolean, facteur?: number, conditionnement?: any}} ligne
 * @returns {boolean}
 */
export function estLigneMode(ligne) {
  if (!ligne) return false
  if (ligne.est_detail === false) return true
  if (ligne.est_detail === true) return false
  return toNumber(ligne.facteur) > 1
}

/**
 * Libellé d'affichage du mode d'une ligne : « Carton (12) », '' pour le détail.
 * @param {{libelle?: string, facteur?: number, est_detail?: boolean, conditionnement?: any}} ligne
 * @returns {string}
 */
export function libelleLigneMode(ligne) {
  if (!estLigneMode(ligne)) return ''
  const libelle = String(ligne?.libelle ?? ligne?.conditionnement?.libelle ?? '').trim()
  const facteur = Math.trunc(toNumber(ligne?.facteur ?? ligne?.conditionnement?.facteur))
  if (!libelle) return facteur > 1 ? `×${facteur}` : ''
  return facteur > 1 ? `${libelle} (${facteur})` : libelle
}

/**
 * Libellé d'affichage d'un mode dans le panier : « Carton (12) », '' au détail.
 * @param {Partial<Conditionnement>|null|undefined} mode
 * @returns {string}
 */
export function libelleConditionnement(mode) {
  if (!mode || mode.est_detail) return ''
  const libelle = String(mode.libelle ?? '').trim()
  const facteur = Math.trunc(toNumber(mode.facteur))
  return facteur > 1 ? `${libelle} (${facteur})` : libelle
}

/**
 * Étiquette d'un mode dans une liste déroulante (caisse, réappro) :
 * « Détail · 1 500 », « Carton ×12 · 15 000 » — montants en FCFA sans unité.
 * @param {Partial<Conditionnement>|null|undefined} mode
 * @param {number} [fallbackPrix] prix si `prix_vente` absent (Détail dérivé)
 * @returns {string}
 */
export function optionModeLabel(mode, fallbackPrix = 0) {
  const facteur = Math.max(1, Math.trunc(toNumber(mode?.facteur) || 1))
  const estDetail = !mode || mode.est_detail === true || facteur === 1
  const libelle = estDetail
    ? 'Détail'
    : `${String(mode.libelle ?? '').trim() || `×${facteur}`} ×${facteur}`
  return `${libelle} · ${formatNombre(toNumber(mode?.prix_vente ?? fallbackPrix))}`
}

/**
 * Prix d'UN mode pour une ligne de panier (détail → prix du produit).
 * @param {{prix?: number, prix_unitaire?: number}} produit
 * @param {Partial<Conditionnement>|null} [mode]
 * @returns {number}
 */
export function prixLigne(produit, mode) {
  if (mode && !mode.est_detail) return toNumber(mode.prix_vente)
  return toNumber(produit?.prix ?? produit?.prix_unitaire)
}
