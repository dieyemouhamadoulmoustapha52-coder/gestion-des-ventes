/** Bouton commun — cible tactile ≥ 44 px, focus visible, état désactivé. */

const VARIANTS = {
  primary:
    'bg-[var(--primary)] text-[var(--primary-contrast)] border border-transparent hover:brightness-110 shadow-[0_10px_20px_rgba(37,99,235,0.22)]',
  secondary: 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-alt)] shadow-sm',
  danger:
    'bg-[var(--danger)] text-[var(--danger-contrast)] border border-transparent hover:brightness-110 shadow-[0_10px_22px_rgba(220,38,38,0.25)]',
  ghost: 'bg-transparent text-[var(--muted)] border border-transparent hover:bg-[var(--surface-alt)] shadow-none',
}

/**
 * @param {{variant?: 'primary'|'secondary'|'danger'|'ghost',
 *          className?: string} & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export default function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`button-animated clickable inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.94] hover:-translate-y-0.5 hover:shadow-xl ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
