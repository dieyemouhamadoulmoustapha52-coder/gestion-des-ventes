import { useState } from 'react'
import { ArrowRight, BadgeDollarSign, BarChart3, PackageCheck, ShoppingBag, TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import Badge from '../components/Badge.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { useTableauDeBord } from '../hooks/queries.js'
import { isoDateDakar } from '../lib/dates.js'
import { formatFcfa } from '../lib/money.js'

const toISODate = (d) => isoDateDakar(d)

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

const CHART_WIDTH = 720
const CHART_HEIGHT = 260
const CHART_MARGIN = { top: 24, right: 16, bottom: 42, left: 88 }
const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Africa/Dakar',
  weekday: 'short',
  day: '2-digit',
})
const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat('fr-FR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function niceCeiling(value) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const fraction = value / magnitude
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return niceFraction * magnitude
}

function formatChartDate(date) {
  return DATE_FORMATTER.format(new Date(`${date}T00:00:00Z`))
}

function AreaChart({ days }) {
  const [activeIndex, setActiveIndex] = useState(null)
  const plotWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right
  const plotHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom
  const maxValue = niceCeiling(Math.max(...days.map((day) => day.ca), 0))
  const points = days.map((day, index) => ({
    ...day,
    x: CHART_MARGIN.left + (days.length === 1 ? plotWidth / 2 : (index / (days.length - 1)) * plotWidth),
    y: CHART_MARGIN.top + plotHeight - (day.ca / maxValue) * plotHeight,
  }))
  const baseline = CHART_MARGIN.top + plotHeight
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${points.at(-1).x} ${baseline} L ${points[0].x} ${baseline} Z`
  const activeDay = activeIndex === null ? null : points[activeIndex]

  return (
    <div className="relative overflow-x-auto">
      {activeDay ? (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center shadow-lg"
        >
          <p className="text-xs font-medium capitalize text-slate-500">{formatChartDate(activeDay.date)}</p>
          <p className="text-sm font-bold text-slate-900">{formatFcfa(activeDay.ca)}</p>
          <p className="text-xs text-slate-500">
            {activeDay.nb_ventes} transaction{activeDay.nb_ventes > 1 ? 's' : ''}
          </p>
        </div>
      ) : null}
      <svg
        aria-label="Chiffre d’affaires journalier en FCFA sur les sept derniers jours"
        className="h-[260px] min-w-[620px] w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        <defs>
          <linearGradient id="sales-area-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = (maxValue / 4) * tick
          const y = CHART_MARGIN.top + plotHeight - (plotHeight / 4) * tick
          return (
            <g key={tick}>
              <line
                x1={CHART_MARGIN.left}
                x2={CHART_WIDTH - CHART_MARGIN.right}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray={tick === 0 ? undefined : '4 5'}
                strokeOpacity="0.55"
              />
              <text
                fill="var(--muted)"
                dominantBaseline="middle"
                fontSize="11"
                textAnchor="end"
                x={CHART_MARGIN.left - 10}
                y={y}
              >
                {COMPACT_NUMBER_FORMATTER.format(value)} FCFA
              </text>
            </g>
          )
        })}
        <path d={areaPath} fill="url(#sales-area-gradient)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--primary)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {points.map((point, index) => (
          <g
            key={point.date}
            aria-label={`${formatChartDate(point.date)} : ${formatFcfa(point.ca)}, ${point.nb_ventes} transaction${point.nb_ventes > 1 ? 's' : ''}`}
            onBlur={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            role="img"
            tabIndex={0}
          >
            <circle
              cx={point.x}
              cy={point.y}
              fill="var(--primary-soft)"
              r={activeIndex === index ? 18 : 13}
            />
            <circle
              cx={point.x}
              cy={point.y}
              fill="var(--surface)"
              r="4.5"
              stroke="var(--primary)"
              strokeWidth="2.5"
            />
            <circle cx={point.x} cy={point.y} fill="transparent" r="16" />
            <text
              fill="var(--muted)"
              fontSize="11"
              textAnchor="middle"
              x={point.x}
              y={CHART_HEIGHT - 12}
            >
              {formatChartDate(point.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export default function Accueil() {
  const date = toISODate(new Date())
  const tableau = useTableauDeBord(date)
  const data = tableau.data
  const days = data?.serie_7_jours || []
  const totalCa = days.reduce((total, day) => total + day.ca, 0)
  const firstDayCa = days[0]?.ca ?? 0
  const lastDayCa = days.at(-1)?.ca ?? 0
  const trendPct = firstDayCa === 0 ? null : ((lastDayCa - firstDayCa) / firstDayCa) * 100
  const trendIsUp = trendPct === null || trendPct >= 0

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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="mb-4 h-10" />
          <Skeleton className="h-56" />
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
          {new Intl.DateTimeFormat('fr-FR', {
            timeZone: 'Africa/Dakar',
            dateStyle: 'full',
            timeStyle: 'short',
          }).format(new Date())}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BadgeDollarSign}
          label="CA du jour"
          value={formatFcfa(data.aujourdhui.ca)}
          detail={
            <span className={`inline-flex items-center gap-1 font-medium ${isUp ? 'text-emerald-700' : 'text-red-700'}`}>
              {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(ecartPct).toFixed(1)}% vs hier
            </span>
          }
          tone={isUp ? 'text-emerald-700' : 'text-red-700'}
        />
        <StatCard
          icon={ShoppingBag}
          label="Ventes"
          value={String(data.aujourdhui.nb_ventes)}
          detail="Transactions validées"
          tone="text-[var(--primary-ink)]"
        />
        <StatCard
          icon={BarChart3}
          label="Panier moyen"
          value={formatFcfa(data.aujourdhui.panier_moyen)}
          detail="Moyenne par ticket"
          tone="text-violet-700"
        />
        <StatCard
          icon={PackageCheck}
          label="Valeur stock"
          value={formatFcfa(data.stock.valeur_stock)}
          detail={`${data.stock.nb_en_alerte} en alerte · ${data.stock.nb_en_rupture} rupture`}
          tone="text-amber-700"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">7 derniers jours</h2>
              <p className="mt-1 text-sm text-slate-500">Évolution du chiffre d’affaires journalier</p>
            </div>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                backgroundColor: totalCa === 0 ? 'var(--surface-alt)' : trendIsUp ? 'var(--primary-soft)' : 'var(--surface-alt)',
                color: totalCa === 0 ? 'var(--muted)' : trendIsUp ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {totalCa > 0 && (trendIsUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
              {totalCa === 0
                ? 'Aucune vente'
                : trendPct === null
                  ? lastDayCa > 0
                    ? 'Nouveau CA'
                    : 'Départ à 0 FCFA'
                  : `${trendPct > 0 ? '+' : ''}${trendPct.toFixed(1)}% vs 1er jour`}
            </span>
          </div>
          {days.length === 0 || totalCa === 0 ? (
            <div className="flex h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 text-center">
              <p className="text-sm font-semibold text-slate-900">Aucune donnée de vente</p>
              <p className="mt-1 text-sm text-slate-500">
                Aucune vente enregistrée pour cette période.
              </p>
            </div>
          ) : (
            <AreaChart days={days} />
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">
            Top 5 semaine (unités de base)
          </h2>
            <Link to="/produits" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary-ink)]">
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
                  <Badge tone="blue">{p.qte} unité{p.qte > 1 ? 's' : ''}</Badge>
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
            <Link to="/produits?stock_bas=true" className="text-sm font-medium text-[var(--primary-ink)]">
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
            <Link to="/ventes" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary-ink)]">
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
                      {new Intl.DateTimeFormat('fr-FR', {
                        timeZone: 'Africa/Dakar',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(vente.date_vente))}
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
