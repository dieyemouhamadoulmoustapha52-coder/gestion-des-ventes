/** Modale accessible (portail, Escape, overlay, aria-modal). */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * @param {{open: boolean, title: string, onClose: () => void,
 *          children: React.ReactNode, footer?: React.ReactNode,
 *          size?: 'md'|'lg'}} props
 */
export default function Modal({ open, title, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal-enter relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_60px_rgba(15,23,42,0.28)] sm:rounded-2xl ${
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="button-animated clickable flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-alt)]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">{footer}</footer>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
