/** Badge d'état (rupture, stock bas, mode de paiement…). */

const TONES = {
  red: 'tone-red',
  orange: 'tone-orange',
  green: 'tone-green',
  blue: 'tone-blue',
  slate: 'tone-slate',
}

/**
 * @param {{tone?: keyof typeof TONES, className?: string,
 *          children: React.ReactNode}} props
 */
export default function Badge({ tone = 'slate', className = '', children }) {
  return (
    <span
      className={`badge-tone inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 ease-in-out ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
