/**
 * Paniers de caisse — useReducer (reducer pur dans lib/paniers.js) + contexte.
 * Le panier vit AU-DESSUS du routage : il survit aux changements de page.
 * Brouillon localStorage `gv:paniers:v1` : écriture debounce 200 ms,
 * restauration revalidée contre le catalogue courant.
 * @audience caissier
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { useProduitsGrille } from '../hooks/queries.js'
import { useMessages } from './MessagesContext.jsx'
import {
  aDesLignes,
  ecrireBrouillon,
  effacerBrouillon,
  lireBrouillon,
  revaliderBrouillon,
} from '../lib/brouillon.js'
import { paniersEtatInitial, paniersReducer } from '../lib/paniers.js'

const CartContext = createContext(null)
const DELAI_BROUILLON = 200 // ms

/** @param {{children: React.ReactNode}} props */
export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(paniersReducer, undefined, paniersEtatInitial)
  const [pret, setPret] = useState(false) // brouillon traité (ou abandonné)
  const produits = useProduitsGrille({})
  const { notify } = useMessages()

  // ── Restauration : revalide chaque ligne contre le catalogue courant ──
  useEffect(() => {
    if (pret || !produits.data) return
    setPret(true)
    try {
      const brut = lireBrouillon()
      if (!brut) return
      const etat = revaliderBrouillon(brut, produits.data.results ?? [])
      dispatch({ type: 'hydrate', state: etat })
      if (aDesLignes(etat)) {
        notify({
          type: 'panier-restaure',
          niveau: 'info',
          texte: 'Panier restauré',
          ephemere: true,
          masquable: true,
          audience: 'caissier',
        })
      }
    } catch {
      /* brouillon illisible : on repart de zéro */
    }
  }, [produits.data, pret, notify])

  // ── Persistance debounce (200 ms) ; tout panier vide → clé effacée ──
  useEffect(() => {
    if (!pret) return
    const timer = setTimeout(() => {
      try {
        if (aDesLignes(state)) ecrireBrouillon(state)
        else effacerBrouillon()
      } catch {
        /* stockage indisponible : le brouillon reste tel quel */
      }
    }, DELAI_BROUILLON)
    return () => clearTimeout(timer)
  }, [state, pret])

  const value = useMemo(() => {
    const courant = state.paniers[state.actif] ?? state.paniers[0]
    const items = courant.items
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
      // La vente validée ne vide QUE son panier (id = panier vendu).
      clear: (id) => dispatch({ type: 'clear', id }),
      vendu: (id) => dispatch({ type: 'vendu', id }),

      // Onglets « Panier 1…5 »
      paniers: state.paniers.map((p, i) => ({
        id: p.id,
        actif: i === state.actif,
        count: p.items.reduce((s, l) => s + l.quantite, 0),
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
