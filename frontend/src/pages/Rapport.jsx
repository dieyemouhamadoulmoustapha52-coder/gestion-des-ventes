import { BarChart3 } from 'lucide-react'
import EmptyState from '../components/EmptyState.jsx'

/** Rapport du jour — remplacé à l'étape 6. */
export default function Rapport() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Rapport du jour</h1>
      <EmptyState
        icon={BarChart3}
        title="Aucun rapport pour l'instant"
        message="Les indicateurs du jour (CA, ventes, répartitions, alertes) sont construits à l'étape suivante."
      />
    </div>
  )
}
