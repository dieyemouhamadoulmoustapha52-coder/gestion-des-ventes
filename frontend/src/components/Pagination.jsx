/** Pagination commune des listes (produits, ventes) — taille de page DRF. */
import Button from './Button.jsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Options de page_size proposées (convention DRF). */
export const PAGE_SIZES = [10, 25, 50]

/**
 * @param {{page: number, totalPages: number, count: number,
 *          onChange: (page: number) => void,
 *          pageSize?: number, onPageSizeChange?: (size: number) => void,
 *          labelTaille?: string}} props
 */
export default function Pagination({
  page,
  totalPages,
  count,
  onChange,
  pageSize,
  onPageSizeChange,
  labelTaille = 'par page',
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
      <p className="text-sm text-slate-500">
        {count} résultat{count > 1 ? 's' : ''}
        {totalPages > 1 ? ` — page ${page} / ${totalPages}` : ''}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && pageSize ? (
          <>
            <label htmlFor="page-size" className="text-sm text-slate-500">
              {labelTaille}
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </>
        ) : null}
        {totalPages > 1 ? (
          <>
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
          </>
        ) : null}
      </div>
    </div>
  )
}
