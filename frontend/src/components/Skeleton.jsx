/** Bloc de chargement animé — évite les sauts de mise en page. */
export default function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} aria-hidden="true" />
}
