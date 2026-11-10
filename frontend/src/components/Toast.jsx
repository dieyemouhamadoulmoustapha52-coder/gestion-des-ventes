/** Toasts succès/erreur — contexte global, auto-dismiss, aria-live. */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

const ToastContext = createContext(null)
let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type, message) => {
      const id = nextId++
      setToasts((list) => [...list, { id, type, message }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 sm:items-end sm:p-4"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 shadow-lg ring-1 ${
              t.type === 'error'
                ? 'bg-red-600 text-white ring-red-700'
                : 'bg-emerald-700 text-white ring-emerald-700'
            }`}
          >
            {t.type === 'error' ? (
              <XCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Fermer la notification"
              className="rounded p-1 hover:bg-white/20"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** @returns {{success: (m: string) => void, error: (m: string) => void}} */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>')
  return ctx
}
