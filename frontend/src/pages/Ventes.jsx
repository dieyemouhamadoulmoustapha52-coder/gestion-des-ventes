/**
 * Historique des ventes : filtres (date, mode), pagination,
 * détail en tiroir, réimpression du ticket.
 */
import { useMemo, useState } from 'react'
import { Eye, Receipt } from 'lucide-react'
import Badge from '../components/Badge.jsx'
import Button from '../components/Button.jsx'
import Drawer from '../components/Drawer.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Pagination from '../components/Pagination.jsx'
import Skeleton from '../components/Skeleton.jsx'
import Ticket from '../components/Ticket.jsx'
import { useVente, useVentes } from '../hooks/queries.js'
import { MODE_LABELS } from '../lib/constants.js'
import { formatFcfa } from '../lib/money.js'

const PAGE_SIZE = 10
const DTF = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const MODE_TONES = {
  ESPECES: 'green',
  WAVE: 'blue',
  ORANGE_MONEY: 'orange',
  CARTE: 'slate',
}

function RowSkeleton() {
  return (
    <tr>
      <td className="px-4 py-4" colSpan={5}>
        <Skeleton className="h-6 w-full" />
      </td>
    </tr>
  )
}

export default function Ventes() {
  const [date, setDate] = useState('')
  const [mode, setMode] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const [reprint, setReprint] = useState(null)

  const params = useMemo(
    () => ({ date: date || undefined, mode_paiement: mode || undefined, page }),
    [date, mode, page],
  )
  const ventes = useVentes(params)
  const detail = useVente(selectedId)

  const count = ventes.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const hasFilters = Boolean(date || mode)

  const resetFilters = () => {
    setDate('')
    setMode('')
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Historique des ventes</h1>
          <p className="text-sm text-slate-500">
            {count} vente{count > 1 ? 's' : ''} enregistrée{count > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div>
          <label htmlFor="v-date" className="sr-only">
            Filtrer par date
          </label>
          <input
            id="v-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setPage(1)
            }}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-48"
          />
        </div>
        <div>
          <label htmlFor="v-mode" className="sr-only">
            Filtrer par mode de paiement
          </label>
          <select
            id="v-mode"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value)
              setPage(1)
            }}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-52"
          >
            <option value="">Tous les modes</option>
            {Object.entries(MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {hasFilters ? (
          <Button variant="ghost" onClick={resetFilters}>
            Réinitialiser
          </Button>
        ) : null}
      </div>

      {/* États */}
      {ventes.isError && !ventes.data ? (
        <ErrorState message={ventes.error.detail} onRetry={() => ventes.refetch()} />
      ) : ventes.isPending ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {[0, 1, 2, 3].map((i) => (
                <RowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      ) : count === 0 ? (
        <EmptyState
          icon={Receipt}
          title={hasFilters ? 'Aucun résultat' : 'Aucune vente'}
          message={
            hasFilters
              ? 'Aucune vente ne correspond à ces filtres.'
              : 'Les ventes encaissées en caisse apparaîtront ici.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={resetFilters}>
                Réinitialiser les filtres
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">N°</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Mode</th>
                  <th scope="col" className="px-4 py-3">Total</th>
                  <th scope="col" className="px-4 py-3 text-right">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ventes.data.results.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">#{v.id}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {DTF.format(new Date(v.date_vente))}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={MODE_TONES[v.mode_paiement] || 'slate'}>
                        {MODE_LABELS[v.mode_paiement] || v.mode_paiement}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                      {formatFcfa(v.montant_total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(v.id)}
                        aria-label={`Voir le détail de la vente n° ${v.id}`}
                        className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Eye size={16} aria-hidden="true" />
                        Détail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} count={count} onChange={setPage} />
        </div>
      )}

      {/* Tiroir de détail */}
      <Drawer
        open={selectedId !== null}
        title={`Vente n° ${selectedId ?? ''}`}
        onClose={() => setSelectedId(null)}
        footer={
          detail.data ? (
            <Button
              className="w-full"
              onClick={() => setReprint(detail.data)}
              disabled={detail.isPending}
            >
              <Receipt size={16} aria-hidden="true" />
              Réimprimer le ticket
            </Button>
          ) : null
        }
      >
        {detail.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-32" />
          </div>
        ) : detail.isError ? (
          <ErrorState message={detail.error.detail} onRetry={() => detail.refetch()} />
        ) : detail.data ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Date</dt>
                <dd className="font-medium text-slate-900">
                  {DTF.format(new Date(detail.data.date_vente))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Mode de paiement</dt>
                <dd>
                  <Badge tone={MODE_TONES[detail.data.mode_paiement] || 'slate'}>
                    {MODE_LABELS[detail.data.mode_paiement] || detail.data.mode_paiement}
                  </Badge>
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">Client</dt>
                <dd className="font-medium text-slate-900">
                  {detail.data.client_nom || '—'}
                </dd>
              </div>
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                {detail.data.lignes.length} ligne{detail.data.lignes.length > 1 ? 's' : ''}
              </h3>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {detail.data.lignes.map((l) => (
                  <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{l.produit_nom}</p>
                      <p className="text-xs text-slate-500">
                        {l.quantite} × {formatFcfa(l.prix_unitaire)} · {l.produit_code}
                      </p>
                    </div>
                    <p className="whitespace-nowrap font-semibold text-slate-900">
                      {formatFcfa(l.montant_ligne)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
              <span className="text-sm font-medium text-blue-900">Total</span>
              <span className="text-lg font-bold text-blue-900">
                {formatFcfa(detail.data.montant_total)}
              </span>
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* Réimpression */}
      <Ticket vente={reprint} open={Boolean(reprint)} onClose={() => setReprint(null)} />
    </div>
  )
}
