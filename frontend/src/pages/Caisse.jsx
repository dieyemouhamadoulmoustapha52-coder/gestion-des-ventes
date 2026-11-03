import { ShoppingCart } from 'lucide-react'
import EmptyState from '../components/EmptyState.jsx'

/** Écran de caisse — remplacé à l'étape 4. */
export default function Caisse() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Caisse</h1>
      <EmptyState
        icon={ShoppingCart}
        title="Environnement de caisse"
        message="L'écran de vente (grille produits, panier, encaissement) est construit à l'étape suivante."
      />
    </div>
  )
}
