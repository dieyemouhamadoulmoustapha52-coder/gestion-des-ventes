import { useMemo } from 'react'
import { ArrowRight, BadgeDollarSign, BarChart3, PackageCheck, ShoppingBag, TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import Badge from '../components/Badge.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { useTableauDeBord } from '../hooks/queries.js'
import { formatFcfa } from '../lib/money.js'

const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function deltaPct(today, yesterday) {
  if (!yesterday || yesterday.ca === 0) return today.ca === 0 ? 0 : 100
  return ((today.ca - yesterday.ca) / yesterday.ca) * 100
}

function StatCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Icon size={16} aria-hidden="true" className={tone} />
          {label}
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  )
}

export default function Accueil() {
  const date = toISODate(new Date())
  const tableau = useTableauDeBord(date)
  const data = tableau.data

  const maxCa = useMemo(() => {
    if (!data?.serie_7_jours?.length) return 1
    return Math.max(...data.serie_7_jours.map((j) => j.ca), 1)
  }, [data])

  const ecartPct = data ? deltaPct(data.aujourdhui, data.hier) : 0
  const isUp = ecartPct >= 0

  if (tableau.isError && !data) {
    return <ErrorState message={tableau.error.detail} onRetry={() => tableau.refetch()} />
  }

  if (tableau.isPending || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Accueil</p>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
          {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date())}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BadgeDollarSign}
          label="CA du jour"
          value={formatFcfa(data.aujourdhui.ca)}
          detail={
            <span className={`inline-flex items-center gap-1 font-medium ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
              {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(ecartPct).toFixed(1)}% vs hier
            </span>
          }
          tone={isUp ? 'text-emerald-600' : 'text-red-600'}
        />
        <StatCard
          icon={ShoppingBag}
          label="Ventes"
          value={String(data.aujourdhui.nb_ventes)}
          detail="Transactions validées"
          tone="text-blue-600"
        />
        <StatCard
          icon={BarChart3}
          label="Panier moyen"
          value={formatFcfa(data.aujourdhui.panier_moyen)}
          detail="Moyenne par ticket"
          tone="text-violet-600"
        />
        <StatCard
          icon={PackageCheck}
          label="Valeur stock"
          value={formatFcfa(data.stock.valeur_stock)}
          detail={`${data.stock.nb_en_alerte} en alerte · ${data.stock.nb_en_rupture} rupture`}
          tone="text-amber-600"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">7 derniers jours</h2>
            <span className="text-xs text-slate-500">CA journalier</span>
          </div>
          <div className="flex h-52 items-end gap-2 pt-4">
            {data.serie_7_jours.map((j) => {
              const height = (j.ca / maxCa) * 100
              return (
                <div key={j.date} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-full w-full items-end justify-center">
                    <div
                      title={`${j.date} · ${formatFcfa(j.ca)} · ${j.nb_ventes} vente${j.nb_ventes > 1 ? 's' : ''}`}
                      className="w-full rounded-t-xl bg-gradient-to-t from-blue-600 to-blue-400 shadow-sm transition-transform hover:scale-[1.02]"
                      style={{ height: `${Math.max(12, height)}%` }}
                    />
                  </div>
                  <div className="text-center text-[10px] text-slate-500">
                    <div>{new Date(`${j.date}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit' })}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Top 5 semaine</h2>
            <Link to="/produits" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600">
              Voir catalogue <ArrowRight size={14} />
            </Link>
          </div>
          <ul className="space-y-2">
            {data.top_produits_semaine.length === 0 ? (
              <EmptyState title="Aucune vente" message="La semaine est vide pour l'instant." />
            ) : (
              data.top_produits_semaine.map((p, index) => (
                <li key={`${p.produit}-${p.code}`} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{p.nom}</p>
                    <p className="font-mono text-[11px] text-slate-500">{p.code}</p>
                  </div>
                  <Badge tone="blue">× {p.qte}</Badge>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Stock</h2>
            <Link to="/produits?stock_bas=true" className="text-sm font-medium text-blue-600">
              Voir stock bas
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Produits</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{data.stock.nb_produits}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs uppercase tracking-wide text-amber-700">Alerte</p>
              <p className="mt-1 text-xl font-bold text-amber-800">{data.stock.nb_en_alerte}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs uppercase tracking-wide text-red-700">Rupture</p>
              <p className="mt-1 text-xl font-bold text-red-800">{data.stock.nb_en_rupture}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Dernières ventes</h2>
            <Link to="/ventes" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600">
              Historique <ArrowRight size={14} />
            </Link>
          </div>
          <ul className="space-y-2">
            {data.dernieres_ventes.length === 0 ? (
              <EmptyState title="Aucune vente" message="Aucune vente n’a été enregistrée." />
            ) : (
              data.dernieres_ventes.map((vente) => (
                <li key={vente.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Vente #{vente.id}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(vente.date_vente).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatFcfa(vente.montant_total)}</p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">{vente.mode_paiement}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}
