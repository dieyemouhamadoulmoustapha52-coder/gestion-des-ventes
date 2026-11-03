/** État d'erreur avec bouton « Réessayer ». */
import { AlertTriangle, RefreshCw } from 'lucide-react'
import Button from './Button.jsx'

/**
 * @param {{message?: string, onRetry?: () => void}} props
 */
export default function ErrorState({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center"
    >
      <AlertTriangle className="h-8 w-8 text-red-500" aria-hidden="true" />
      <p className="max-w-md text-sm font-medium text-red-700">
        {message || 'Une erreur est survenue.'}
      </p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          Réessayer
        </Button>
      ) : null}
    </div>
  )
}
