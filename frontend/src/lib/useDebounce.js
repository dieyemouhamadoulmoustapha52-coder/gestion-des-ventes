import { useEffect, useState } from 'react'

/**
 * Valeur différée — évite une requête à chaque frappe.
 * @template T @param {T} value @param {number} delay ms (250 par défaut)
 * @returns {T}
 */
export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
