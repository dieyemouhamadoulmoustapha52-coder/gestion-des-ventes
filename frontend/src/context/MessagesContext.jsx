/**
 * Barre de messages — état global (React Context + useReducer).
 * Les messages de stock sont DÉRIVÉS de l'état des produits (pas stockés) ;
 * seuls les messages éphémères (vente) et les masquages sont en état.
 */
import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react'
import { useBoutique } from '../config/boutique.js'
import { useProduitsGrille } from '../hooks/queries.js'
import { deriveStockMessages, DUREE_EPHEMERE, trierMessages } from '../lib/messages.js'

const MessagesContext = createContext(null)
let nextId = 1

/**
 * @typedef {import('../lib/messages.js').Message} Message
 * @typedef {{masques: Record<string, string>, ephemere: Message|null,
 *            index: number, indexPrecedent: number}} MessagesState
 */

/**
 * @param {MessagesState} state
 * @param {{type: string, message?: Message, id?: string, index?: number}} action
 * @returns {MessagesState}
 */
function reducer(state, action) {
  switch (action.type) {
    case 'notify': {
      // Passe devant les autres ; on mémorise l'affichage précédent (une seule fois).
      const dejaEphemere = state.ephemere !== null
      return {
        ...state,
        ephemere: action.message,
        index: 0,
        indexPrecedent: dejaEphemere ? state.indexPrecedent : state.index,
      }
    }
    case 'expire': {
      if (state.ephemere?.id !== action.id) return state
      // Retour à l'affichage précédent (en compensant le retrait de la position 0).
      const index = state.index === 0 ? state.indexPrecedent : state.index - 1
      return { ...state, ephemere: null, index: Math.max(0, index) }
    }
    case 'masquer': {
      if (action.message.ephemere) {
        const index = state.index === 0 ? state.indexPrecedent : state.index - 1
        return { ...state, ephemere: null, index: Math.max(0, index) }
      }
      // Masqué jusqu'à changement du stock : on mémorise le texte affiché ;
      // si le texte change (stock revient/évolue), le message réapparaît.
      return {
        ...state,
        masques: { ...state.masques, [action.message.id]: action.message.texte },
      }
    }
    case 'index':
      return { ...state, index: action.index }
    default:
      return state
  }
}

/** @param {{children: React.ReactNode}} props */
export function MessagesProvider({ children }) {
  const boutique = useBoutique()
  const produits = useProduitsGrille({})
  const nextIdRef = useRef(nextId)
  const [state, dispatch] = useReducer(reducer, {
    masques: {},
    ephemere: null,
    index: 0,
    indexPrecedent: 0,
  })

  const list = useMemo(() => {
    const derives = deriveStockMessages(produits.data?.results ?? [], boutique.seuilStockBas)
    const visibles = derives.filter(
      (m) => state.masques[m.id] === undefined || state.masques[m.id] !== m.texte,
    )
    const base = trierMessages(visibles)
    return state.ephemere ? [state.ephemere, ...base] : base
  }, [produits.data, boutique.seuilStockBas, state.masques, state.ephemere])

  const index = Math.min(state.index, Math.max(0, list.length - 1))

  const notify = useCallback((message) => {
    const id = `evt:${nextIdRef.current++}`
    dispatch({
      type: 'notify',
      message: {
        audience: 'tous',
        ephemere: false,
        masquable: true,
        ...message,
        id,
        creeLe: Date.now(),
        duree: message.ephemere ? message.duree ?? DUREE_EPHEMERE : undefined,
      },
    })
    return id
  }, [])

  /** Notification « Vente enregistrée : {total} » (format FCFA). */
  const notifyVente = useCallback(
    (total) =>
      notify({
        type: 'vente-enregistree',
        niveau: 'succes',
        texte: `Vente enregistrée : ${total}`,
        audience: 'caissier',
        ephemere: true,
        masquable: true,
      }),
    [notify],
  )

  const expire = useCallback((id) => dispatch({ type: 'expire', id }), [])
  const masquer = useCallback((message) => dispatch({ type: 'masquer', message }), [])
  const setIndex = useCallback((i) => dispatch({ type: 'index', index: i }), [])

  const value = useMemo(
    () => ({ messages: list, index, notify, notifyVente, expire, masquer, setIndex }),
    [list, index, notify, notifyVente, expire, masquer, setIndex],
  )

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
}

/** @returns {{messages: Message[], index: number,
 *   notify: (m: object) => string, notifyVente: (total: string|number) => string,
 *   expire: (id: string) => void, masquer: (m: Message) => void,
 *   setIndex: (i: number) => void}} */
export function useMessages() {
  const ctx = useContext(MessagesContext)
  if (!ctx) throw new Error('useMessages doit être utilisé dans <MessagesProvider>')
  return ctx
}
