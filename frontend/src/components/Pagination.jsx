/** Pagination commune des listes (produits, ventes). */
import Button from './Button.jsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * @param {{page: number, totalPages: number, count: number,
 *          onChange: (page: number) => void}} props
 */
export default function Pagination({ page, totalPages, count, onChange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
      <p className="text-sm text-slate-500">
        {count} résultat{count > 1 ? 's' : ''}
        {totalPages > 1 ? ` — page ${page} / ${totalPages}` : ''}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            aria-label="Page précédente"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Précédent
          </Button>
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
            aria-label="Page suivante"
          >
            Suivant
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
