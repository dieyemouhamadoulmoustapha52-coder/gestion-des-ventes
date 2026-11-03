/** Bannière affichée quand le mode démo (MSW) n'a pas pu démarrer. */
import { AlertTriangle } from 'lucide-react'
import { demoState } from '../lib/demo.js'

export default function DemoBanner() {
  if (!demoState.indisponible) return null
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900 shadow-sm"
    >
      <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>
        <strong>Mode démo indisponible :</strong> ce navigateur bloque les service workers
        (navigation privée ?). Ouvre l'application dans un autre navigateur.
      </p>
    </div>
  )
}
