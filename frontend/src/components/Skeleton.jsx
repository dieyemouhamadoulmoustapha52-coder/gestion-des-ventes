/** Bloc de chargement animé — évite les sauts de mise en page. */
export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`skeleton-block animate-pulse rounded-lg ${className}`}
      aria-hidden="true"
    />
  )
}
