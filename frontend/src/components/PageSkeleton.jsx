/** squelette de page affiché pendant le chargement d'une route lazy */
import Skeleton from './Skeleton.jsx'

export default function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Chargement de la page">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
