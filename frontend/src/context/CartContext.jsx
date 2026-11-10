/**
 * Panier de caisse — useReducer + contexte.
 * Le panier vit AU-DESSUS du routage : il survit aux changements de page.
 */
import { createContext, useContext, useMemo, useReducer } from 'react'

const CartContext = createContext(null)

/**
 * État : liste de {produit, quantite}.
 * `produit` = snapshot Produit (id, nom, prix_unitaire, stock).
 */
function reducer(items, action) {
  switch (action.type) {
    case 'add': {
      const { produit } = action
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
    case 'inc':
      return items.map((i) =>
        i.produit.id === action.id
          ? { ...i, quantite: Math.min(i.quantite + 1, i.produit.stock) }
          : i,
      )
    case 'dec':
      return items.map((i) =>
        i.produit.id === action.id ? { ...i, quantite: Math.max(1, i.quantite - 1) } : i,
      )
    case 'remove':
      return items.filter((i) => i.produit.id !== action.id)
    case 'clear':
      return []
    default:
      return items
  }
}

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(reducer, [])

  const value = useMemo(() => {
    const count = items.reduce((s, i) => s + i.quantite, 0)
    const total = items.reduce((s, i) => s + i.produit.prix_unitaire * i.quantite, 0)
    return {
      items,
      count,
      total,
      add: (produit) => dispatch({ type: 'add', produit }),
      inc: (id) => dispatch({ type: 'inc', id }),
      dec: (id) => dispatch({ type: 'dec', id }),
      remove: (id) => dispatch({ type: 'remove', id }),
      clear: () => dispatch({ type: 'clear' }),
    }
  }, [items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

/** @returns {ReturnType<typeof CartProvider> extends never ? never : any} */
export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart doit être utilisé dans <CartProvider>')
  return ctx
}
