/**
 * Paniers de caisse — useReducer (reducer pur dans lib/paniers.js) + contexte.
 * Le panier vit AU-DESSUS du routage : il survit aux changements de page.
 * @audience caissier
 */
import { createContext, useContext, useMemo, useReducer } from 'react'
import { paniersEtatInitial, paniersReducer } from '../lib/paniers.js'

const CartContext = createContext(null)

/** @param {{children: React.ReactNode}} props */
export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(paniersReducer, undefined, paniersEtatInitial)

  const value = useMemo(() => {
    const courant = state.paniers[state.actif] ?? state.paniers[0]
    const items = courant.items
    const count = items.reduce((s, i) => s + i.quantite, 0)
    const total = items.reduce((s, i) => s + i.produit.prix_unitaire * i.quantite, 0)
    const lignes = (p) => p.items.reduce((s, i) => s + i.quantite, 0)
    return {
      items,
      count,
      total,
      add: (produit) => dispatch({ type: 'add', produit }),
      inc: (id) => dispatch({ type: 'inc', id }),
      dec: (id) => dispatch({ type: 'dec', id }),
      remove: (id) => dispatch({ type: 'remove', id }),
      // La vente validée ne vide QUE son panier (id = panier vendu).
      clear: (id) => dispatch({ type: 'clear', id }),
      vendu: (id) => dispatch({ type: 'vendu', id }),

      // Onglets « Panier 1…5 »
      paniers: state.paniers.map((p, i) => ({
        id: p.id,
        actif: i === state.actif,
        count: lignes(p),
        vide: p.items.length === 0,
      })),
      actifId: courant.id,
      activer: (index) => dispatch({ type: 'activer', id: index }),
      ajouterPanier: () => dispatch({ type: 'ajouter' }),
      fermerPanier: (id) => dispatch({ type: 'fermer', id }),
      hydrater: (etat) => dispatch({ type: 'hydrate', state: etat }),
    }
  }, [state])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

/** @returns {any} contexte panier (cf. CartProvider) */
export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart doit être utilisé dans <CartProvider>')
  return ctx
}
