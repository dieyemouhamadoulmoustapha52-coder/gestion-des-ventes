/**
 * Historique des ventes — @audience patron.
 * Filtres période (du/au + raccourcis), produit, moyen de paiement ;
 * reflétés dans l'URL (du, au, produit, mode, page, page_size) ;
 * pagination DRF (10/25/50), totaux du jeu filtré, export CSV complet ;
 * détail en tiroir, réimpression du ticket.
 */
import { useEffect, useMemo, useState } from 'react'
import { Download, Eye, Receipt } from 'lucide-react'
import Badge from '../components/Badge.jsx'
import Button from '../components/Button.jsx'
import Drawer from '../components/Drawer.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Pagination from '../components/Pagination.jsx'
import Skeleton from '../components/Skeleton.jsx'
import Ticket from '../components/Ticket.jsx'
import { useToast } from '../components/Toast.jsx'
import { listVentesDetaillees } from '../api/ventes.js'
import { useBoutique } from '../config/boutique.js'
import { useProduitsGrille, useTotauxVentes, useVente, useVentes } from '../hooks/queries.js'
import { MODE_LABELS } from '../lib/constants.js'
import { dateDakar, decaleJours, FUSEAU } from '../lib/dates.js'
import { genererCsvVentes, nomFichierCsv, telechargerCsv } from '../lib/exportCsv.js'
import { formatFcfa } from '../lib/money.js'

const DTF = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const MODE_TONES = {
  ESPECES: 'green',
  WAVE: 'blue',
  ORANGE_MONEY: 'orange',
  CARTE: 'slate',
}

/** Lit les filtres depuis l'URL (retour/avant du navigateur compris). */
function lireFiltres() {
  const p = new URLSearchParams(window.location.search)
  const taille = Number(p.get('page_size'))
  return {
    du: p.get('du') || '',
    au: p.get('au') || '',
    produit: p.get('produit') || '',
    mode: p.get('mode') || '',
    page: Math.max(1, Number(p.get('page')) || 1),
    pageSize: [10, 25, 50].includes(taille) ? taille : 10,
  }
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
  const [f, setF] = useState(lireFiltres)
  const [selectedId, setSelectedId] = useState(null)
  const [reprint, setReprint] = useState(null)
  const [exportEnCours, setExportEnCours] = useState(false)

  const toast = useToast()
  const boutique = useBoutique()
  const produits = useProduitsGrille({})

  // Filtres → URL (remplacement, sans historique parasite).
  useEffect(() => {
    const p = new URLSearchParams()
    if (f.du) p.set('du', f.du)
    if (f.au) p.set('au', f.au)
    if (f.produit) p.set('produit', f.produit)
    if (f.mode) p.set('mode', f.mode)
    if (f.page > 1) p.set('page', String(f.page))
    if (f.pageSize !== 10) p.set('page_size', String(f.pageSize))
    const next = p.toString() ? `?${p.toString()}` : ''
    if (window.location.search !== next) {
      window.history.replaceState({}, '', `${window.location.pathname}${next}`)
    }
  }, [f])

  // Retour/avant du navigateur → resynchronisation des filtres.
  useEffect(() => {
    const onPop = () => setF(lireFiltres())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const paramsFiltres = useMemo(
    () => ({
      date_debut: f.du || undefined,
      date_fin: f.au || undefined,
      produit: f.produit || undefined,
      mode_paiement: f.mode || undefined,
    }),
    [f.du, f.au, f.produit, f.mode],
  )

  const ventes = useVentes({ ...paramsFiltres, page: f.page, page_size: f.pageSize })
  const totaux = useTotauxVentes(paramsFiltres)
  const detail = useVente(selectedId)

  const count = ventes.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(count / f.pageSize))
  const hasFilters = Boolean(f.du || f.au || f.produit || f.mode)

  const setFiltre = (patch) => setF((prev) => ({ ...prev, ...patch, page: 1 }))

  const resetFilters = () =>
    setF({ du: '', au: '', produit: '', mode: '', page: 1, pageSize: f.pageSize })

  // Raccourcis de période (fuseau Dakar).
  const aujourdhui = dateDakar()
  const raccourcis = [
    { label: "Aujourd'hui", du: aujourdhui, au: aujourdhui },
    { label: '7 jours', du: decaleJours(aujourdhui, -6), au: aujourdhui },
    {
      label: 'Ce mois',
      du: `${aujourdhui.slice(0, 7)}-01`,
      au: aujourdhui,
    },
  ]

  // Export CSV : TOUT le jeu filtré (pas seulement la page courante).
  const exporter = async () => {
    setExportEnCours(true)
    try {
      const toutes = await listVentesDetaillees(paramsFiltres)
      if (toutes.length === 0) {
        toast.error('Aucune vente à exporter avec ces filtres.')
        return
      }
      telechargerCsv(
        genererCsvVentes(toutes, MODE_LABELS),
        nomFichierCsv(toutes, f.du || undefined, f.au || undefined),
      )
    } catch {
      toast.error('Export CSV impossible.')
    } finally {
      setExportEnCours(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Historique des ventes</h1>
          <p className="text-sm text-slate-500">
            {totaux.data ? totaux.data.count : count} vente
            {(totaux.data ? totaux.data.count : count) > 1 ? 's' : ''} ·{' '}
            {formatFcfa(totaux.data?.total ?? 0)}
          </p>
        </div>
        <Button variant="secondary" onClick={exporter} disabled={exportEnCours}>
          <Download size={16} aria-hidden="true" />
          {exportEnCours ? 'Export…' : 'Exporter CSV'}
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
        <div className="flex flex-wrap gap-2">
          {raccourcis.map((r) => {
            const actif = f.du === r.du && f.au === r.au
            return (
              <button
                key={r.label}
                type="button"
                aria-pressed={actif}
                onClick={() => setFiltre(actif && hasFilters ? { du: '', au: '' } : { du: r.du, au: r.au })}
                className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition ${
                  actif
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="v-du" className="block text-xs font-medium text-slate-500">
              Du
            </label>
            <input
              id="v-du"
              type="date"
              value={f.du}
              max={f.au || undefined}
              onChange={(e) => setFiltre({ du: e.target.value })}
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-44"
            />
          </div>
          <div>
            <label htmlFor="v-au" className="block text-xs font-medium text-slate-500">
              Au
            </label>
            <input
              id="v-au"
              type="date"
              value={f.au}
              min={f.du || undefined}
              onChange={(e) => setFiltre({ au: e.target.value })}
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-44"
            />
          </div>
          <div>
            <label htmlFor="v-produit" className="block text-xs font-medium text-slate-500">
              Produit
            </label>
            <select
              id="v-produit"
              value={f.produit}
              onChange={(e) => setFiltre({ produit: e.target.value })}
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-52"
            >
              <option value="">Tous les produits</option>
              {(produits.data?.results ?? []).map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="v-mode" className="block text-xs font-medium text-slate-500">
              Moyen de paiement
            </label>
            <select
              id="v-mode"
              value={f.mode}
              onChange={(e) => setFiltre({ mode: e.target.value })}
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-48"
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
                  <tr key={v.id} className="transition-colors duration-200 ease-in-out">
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
                        className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
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
          <Pagination
            page={f.page}
            totalPages={totalPages}
            count={count}
            onChange={(page) => setF((prev) => ({ ...prev, page }))}
            pageSize={f.pageSize}
            onPageSizeChange={(pageSize) => setFiltre({ pageSize })}
          />
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
      <Ticket vente={reprint} boutique={boutique} open={Boolean(reprint)} onClose={() => setReprint(null)} />
    </div>
  )
}
