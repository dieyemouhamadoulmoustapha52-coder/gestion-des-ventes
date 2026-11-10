import { useEffect, useState } from 'react'

/**
 * Valeur différée — évite une requête à chaque frappe (debounce 250 ms).
 * Utilisée sur les recherches texte de Produits et d'Historique
 * (jamais sur la Caisse : son filtrage est local + useDeferredValue).
 * @template T @param {T} value @param {number} delay ms (250 par défaut)
 * @returns {T}
 */
export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Alias historique (mêmes arguments). */
export const useDebounce = useDebouncedValue
