import { Receipt } from 'lucide-react'
import EmptyState from '../components/EmptyState.jsx'

/** Historique des ventes — remplacé à l'étape 5. */
export default function Ventes() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Historique des ventes</h1>
      <EmptyState
        icon={Receipt}
        title="Aucune vue pour l'instant"
        message="La liste filtrable des ventes et le détail en tiroir sont construits à l'étape suivante."
      />
    </div>
  )
}
