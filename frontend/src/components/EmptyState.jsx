/** État vide (aucun résultat, aucun élément). */
export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {Icon ? <Icon className="h-10 w-10 text-slate-400" aria-hidden="true" /> : null}
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {message ? <p className="max-w-sm text-sm text-slate-500">{message}</p> : null}
      {action}
    </div>
  )
}
