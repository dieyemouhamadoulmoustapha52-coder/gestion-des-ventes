import { Package } from 'lucide-react'
import EmptyState from '../components/EmptyState.jsx'

/** Écran produits & catégories — remplacé à l'étape 3. */
export default function Produits() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Produits</h1>
      <EmptyState
        icon={Package}
        title="Catalogue produits"
        message="Le tableau produits, la recherche et la gestion des catégories sont construits à l'étape suivante."
      />
    </div>
  )
}
