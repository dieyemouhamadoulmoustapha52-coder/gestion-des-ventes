/**
 * Paniers multiples de caisse — @audience caissier.
 * Reducer PUR (testé par Vitest) : jusqu'à `PANIER_MAX` paniers, un seul actif.
 * Ligne = produit + MODE DE VENTE (null = Détail) + quantité en modes ;
 * les bornes de quantité sont calculées en unités de base via
 * `maxQuantiteLigne` (cumul des autres lignes du même produit déduit).
 * L'état vit dans CartContext ; la persistance est gérée à part (gv:paniers:v1).
 */
import { maxQuantiteLigne } from './conditionnements.js'

/** Nombre maximal de paniers ouverts simultanément. */
export const PANIER_MAX = 5

/**
 * @typedef {{produit: {id: number, stock: number, prix_unitaire: number, nom: string},
 *            conditionnement: object|null, quantite: number}} LignePanier
 * @typedef {{id: number, items: LignePanier[]}} Panier
 * @typedef {{paniers: Panier[], actif: number, seq: number}} PaniersState
 */

/**
 * Clé d'une ligne : produit + mode. Le Détail (mode absent, `est_detail` ou
 * facteur 1) a TOUJOURS la même clé `« id:detail »` — la restauration d'un
 * ancien brouillon (sans mode) ne crée donc jamais de doublon.
 * @param {number} produitId
 * @param {{id?: number|null, facteur?: number, est_detail?: boolean}|null} [mode]
 * @returns {string}
 */
export function ligneCle(produitId, mode) {
  const estDetail = !mode || mode.est_detail === true || Number(mode.facteur) === 1
  return `${produitId}:${estDetail ? 'detail' : mode.id}`
}

/** @param {LignePanier} ligne @returns {string} */
export function cleDeLigne(ligne) {
  return ligneCle(ligne?.produit?.id, ligne?.conditionnement ?? null)
}

/** Stock en unités de base d'un produit (alias legacy `stock` accepté). */
function stockDe(produit) {
  return Math.max(0, Math.trunc(Number(produit?.stock ?? produit?.quantite ?? 0)))
}

/** Facteur d'une ligne (mode absent = Détail = 1). */
function facteurDe(ligne) {
  return Math.max(1, Math.trunc(Number(ligne?.conditionnement?.facteur ?? 1)))
}

/** Unités de base prises par les AUTRES lignes d'un produit (hors `saufCle`). */
function besoinHorsLigne(items, produitId, saufCle) {
  return (items ?? []).reduce(
    (s, i) =>
      i?.produit?.id === produitId && cleDeLigne(i) !== saufCle
        ? s + Math.max(1, Math.trunc(i.quantite)) * facteurDe(i)
        : s,
    0,
  )
}

/** @returns {PaniersState} un panier unique, vide, actif */
export function paniersEtatInitial() {
  return { paniers: [{ id: 1, items: [] }], actif: 0, seq: 1 }
}

/** Applique une transformation au seul panier actif. */
function mapActif(state, fn) {
  return {
    ...state,
    paniers: state.paniers.map((p, i) => (i === state.actif ? fn(p) : p)),
  }
}

/**
 * Ajoute/incrémente une ligne (produit + mode), bornée au stock restant
 * déduction faite des autres lignes du même produit.
 * @returns {LignePanier[]} nouveau tableau (jamais muté)
 */
function ajouterLigne(items, produit, mode) {
  const stock = stockDe(produit)
  if (stock <= 0) return items
  const facteur = Math.max(1, Math.trunc(Number(mode?.facteur ?? 1)))
  const cle = ligneCle(produit.id, mode)
  const existant = items.find((i) => cleDeLigne(i) === cle)
  const hors = besoinHorsLigne(items, produit.id, cle)
  const max = maxQuantiteLigne(facteur, stock, hors)
  if (max < 1) return items
  if (existant) {
    const quantite = Math.min(existant.quantite + 1, max)
    if (quantite === existant.quantite) return items // déjà au maximum
    return items.map((i) =>
      cleDeLigne(i) === cle
        ? { ...i, quantite, produit, conditionnement: mode ?? i.conditionnement ?? null }
        : i,
    )
  }
  return [...items, { produit, conditionnement: mode ?? null, quantite: 1 }]
}

/**
 * Reducer pur des paniers de caisse.
 * @param {PaniersState} state
 * @param {{type: string, produit?: object, mode?: object|null, cle?: string,
 *          id?: number, state?: PaniersState}} action
 *   - add {produit, mode?} : ajoute/incrémente la ligne produit+mode (Détail si mode omis)
 *   - inc/dec/remove {cle} : opèrent sur une ligne (l'ancien `id` = ligne Détail)
 *   - mode {cle, mode} : change le mode d'une ligne (fusion si la ligne cible existe)
 *   - stocks {majs: [{id, quantite}]} : applique produits_mis_a_jour à tous les paniers
 *   - activer {id} : bascule d'onglet (index)
 *   - ajouter : crée un panier (max PANIER_MAX) et le rend actif
 *   - fermer {id} : ferme UN panier VIDE uniquement
 *   - vendu {id} : vide le panier de la vente validée (les autres sont intacts)
 *   - hydrate {state} : restauration depuis localStorage (déjà revalidée)
 * @returns {PaniersState}
 */
export function paniersReducer(state, action) {
  switch (action.type) {
    case 'hydrate':
      return action.state ?? state

    case 'add': {
      const { produit, mode } = action
      if (!produit) return state
      return mapActif(state, (p) => ({ ...p, items: ajouterLigne(p.items, produit, mode ?? null) }))
    }

    case 'inc':
      return mapActif(state, (p) => {
        const cle = action.cle ?? ligneCle(action.id, action.mode ?? null)
        return {
          ...p,
          items: p.items.map((i) => {
            if (cleDeLigne(i) !== cle) return i
            const hors = besoinHorsLigne(p.items, i.produit.id, cle)
            const max = maxQuantiteLigne(facteurDe(i), stockDe(i.produit), hors)
            return { ...i, quantite: Math.min(i.quantite + 1, max) }
          }),
        }
      })

    case 'dec':
      return mapActif(state, (p) => {
        const cle = action.cle ?? ligneCle(action.id, action.mode ?? null)
        return {
          ...p,
          items: p.items.map((i) =>
            cleDeLigne(i) === cle ? { ...i, quantite: Math.max(1, i.quantite - 1) } : i,
          ),
        }
      })

    case 'remove':
      return mapActif(state, (p) => {
        const cle = action.cle ?? ligneCle(action.id, action.mode ?? null)
        return { ...p, items: p.items.filter((i) => cleDeLigne(i) !== cle) }
      })

    case 'mode':
      return mapActif(state, (p) => changerMode(p, action))

    case 'stocks': {
      // `produits_mis_a_jour` d'une vente : met à jour les snapshots de stock
      // des lignes (y compris dans les autres paniers en attente).
      const majs = new Map(
        (action.majs ?? [])
          .filter((m) => Number.isInteger(m?.id) && Number.isFinite(Number(m.quantite)))
          .map((m) => [m.id, Math.max(0, Math.trunc(Number(m.quantite)))]),
      )
      if (majs.size === 0) return state
      let touche = false
      const paniers = state.paniers.map((p) => ({
        ...p,
        items: p.items.map((i) => {
          const q = majs.get(i.produit.id)
          if (q === undefined || i.produit.quantite === q) return i
          touche = true
          return { ...i, produit: { ...i.produit, quantite: q, stock: q } }
        }),
      }))
      return touche ? { ...state, paniers } : state
    }

    case 'clear':
      return typeof action.id === 'number'
        ? { ...state, paniers: state.paniers.map((p) => (p.id === action.id ? { ...p, items: [] } : p)) }
        : mapActif(state, (p) => ({ ...p, items: [] }))

    case 'vendu': {
      // La vente ne réinitialise QUE son panier.
      const id = action.id ?? state.paniers[state.actif]?.id
      return { ...state, paniers: state.paniers.map((p) => (p.id === id ? { ...p, items: [] } : p)) }
    }

    case 'activer': {
      const idx = action.id
      if (!Number.isInteger(idx) || idx < 0 || idx >= state.paniers.length) return state
      return { ...state, actif: idx }
    }

    case 'ajouter': {
      if (state.paniers.length >= PANIER_MAX) return state
      const panier = { id: state.seq + 1, items: [] }
      return {
        paniers: [...state.paniers, panier],
        actif: state.paniers.length,
        seq: state.seq + 1,
      }
    }

    case 'fermer': {
      const idx = state.paniers.findIndex((p) => p.id === action.id)
      if (idx === -1) return state
      if (state.paniers[idx].items.length > 0) return state // jamais de perte
      const paniers = state.paniers.filter((_, i) => i !== idx)
      if (paniers.length === 0) return paniersEtatInitial()
      const actif = state.actif > idx ? state.actif - 1 : Math.min(state.actif, paniers.length - 1)
      return { ...state, paniers, actif }
    }

    default:
      return state
  }
}

/**
 * Change le mode d'une ligne : la quantité est re-bornée en unités de base,
 * et la ligne fusionne si le produit+mode existe déjà dans le panier.
 * Mode absent du catalogue ou qui ne tient pas en stock → no-op.
 */
function changerMode(panier, action) {
  const { cle, mode } = action
  const idx = panier.items.findIndex((i) => cleDeLigne(i) === cle)
  if (idx === -1) return panier
  const ligne = panier.items[idx]
  const nouvelleCle = ligneCle(ligne.produit.id, mode ?? null)
  const facteur = Math.max(1, Math.trunc(Number(mode?.facteur ?? 1)))
  const stock = stockDe(ligne.produit)
  const hors = besoinHorsLigne(panier.items, ligne.produit.id, cle)
  const max = maxQuantiteLigne(facteur, stock, hors)
  if (max < 1) return panier // ce mode ne tient pas : la ligne reste en place
  const quantite = Math.min(ligne.quantite, max)

  if (nouvelleCle === cle) {
    // même mode (Détail ↔ Détail) : on réordonne rien, on borne seulement
    return {
      ...panier,
      items: panier.items.map((i, j) => (j === idx ? { ...i, conditionnement: mode ?? null, quantite } : i)),
    }
  }

  const cible = panier.items.findIndex((i, j) => j !== idx && cleDeLigne(i) === nouvelleCle)
  if (cible === -1) {
    return {
      ...panier,
      items: panier.items.map((i, j) =>
        j === idx ? { ...i, conditionnement: mode ?? null, quantite } : i,
      ),
    }
  }

  // Fusion : la ligne cible absorbe la quantité (re-bornée), on garde la position la plus ancienne.
  const autre = panier.items[cible]
  const horsAutre = panier.items.reduce(
    (s, i, j) =>
      j !== idx && j !== cible && i.produit.id === ligne.produit.id
        ? s + Math.max(1, Math.trunc(i.quantite)) * facteurDe(i)
        : s,
    0,
  )
  const maxAutre = maxQuantiteLigne(facteur, stock, horsAutre)
  const fusion = {
    ...autre,
    produit: ligne.produit,
    conditionnement: mode ?? null,
    quantite: Math.min(autre.quantite + quantite, maxAutre),
  }
  const position = Math.min(idx, cible)
  const reste = panier.items.filter((_, j) => j !== idx && j !== cible)
  return { ...panier, items: [...reste.slice(0, position), fusion, ...reste.slice(position)] }
}
