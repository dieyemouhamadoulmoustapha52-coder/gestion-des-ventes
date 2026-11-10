/**
 * Paniers multiples de caisse — @audience caissier.
 * Reducer PUR (testé par Vitest) : jusqu'à `PANIER_MAX` paniers, un seul actif.
 * L'état vit dans CartContext ; la persistance est gérée à part (gv:paniers:v1).
 */

/** Nombre maximal de paniers ouverts simultanément. */
export const PANIER_MAX = 5

/**
 * @typedef {{produit: {id: number, stock: number, prix_unitaire: number, nom: string},
 *            quantite: number}} LignePanier
 * @typedef {{id: number, items: LignePanier[]}} Panier
 * @typedef {{paniers: Panier[], actif: number, seq: number}} PaniersState
 */

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

/** Ajoute/incrémente une ligne dans un panier (borné au stock du snapshot). */
function ajouterLigne(items, produit) {
  if (produit.stock <= 0) return items
  const existing = items.find((i) => i.produit.id === produit.id)
  if (existing) {
    return items.map((i) =>
      i.produit.id === produit.id
        ? { ...i, quantite: Math.min(i.quantite + 1, produit.stock), produit }
        : i,
    )
  }
  return [...items, { produit, quantite: 1 }]
}

/**
 * Reducer pur des paniers de caisse.
 * @param {PaniersState} state
 * @param {{type: string, produit?: object, id?: number, state?: PaniersState}} action
 *   - add/inc/dec/remove/clear : opèrent sur le panier ACTIF
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
      const { produit } = action
      if (!produit) return state
      return mapActif(state, (p) => ({ ...p, items: ajouterLigne(p.items, produit) }))
    }

    case 'inc':
      return mapActif(state, (p) => ({
        ...p,
        items: p.items.map((i) =>
          i.produit.id === action.id
            ? { ...i, quantite: Math.min(i.quantite + 1, i.produit.stock) }
            : i,
        ),
      }))

    case 'dec':
      return mapActif(state, (p) => ({
        ...p,
        items: p.items.map((i) =>
          i.produit.id === action.id ? { ...i, quantite: Math.max(1, i.quantite - 1) } : i,
        ),
      }))

    case 'remove':
      return mapActif(state, (p) => ({
        ...p,
        items: p.items.filter((i) => i.produit.id !== action.id),
      }))

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
