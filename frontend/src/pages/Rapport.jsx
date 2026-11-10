/**
 * Rapport du jour : sélecteur de date, cartes d'indicateurs,
 * répartitions (barres CSS, part en % à 1 décimale), top 3, produits à racheter.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, Banknote, CalendarDays, Receipt, ShoppingBasket } from 'lucide-react'
import Badge from '../components/Badge.jsx'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import RapportMensuel from '../components/RapportMensuel.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { useRapport } from '../hooks/queries.js'
import { MODE_LABELS } from '../lib/constants.js'
import { isoDateDakar } from '../lib/dates.js'
import { formatFcfa } from '../lib/money.js'

const toISODate = (d) => isoDateDakar(d)

/** Part en % (1 décimale, virgule française). */
const share = (value, total) =>
  total > 0
    ? ((value / total) * 100).toLocaleString('fr-FR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : '0,0'

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon size={16} aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

function PartBar({ label, value, total, detail, tone }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
        <span className="font-medium text-slate-900">{label}</span>
        <span className="text-slate-600">
          {formatFcfa(value)} · {share(value, total)} %
          {detail ? ` · ${detail}` : ''}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </li>
  )
}

export default function Rapport() {
  const [date, setDate] = useState(() => toISODate(new Date()))
  const rapport = useRapport(date)
  const data = rapport.data

  const isToday = date === toISODate(new Date())
  const emptyDay = data && data.nb_ventes === 0

  const title = useMemo(() => {
    const [y, m, d] = date.split('-')
    return `${d}/${m}/${y}`
  }, [date])

  return (
    <div className="space-y-4">
      {/* En-tête + sélecteur de date */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rapport du jour</h1>
          <p className="text-sm text-slate-500">Indicateurs du {title}</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="r-date" className="sr-only">
            Date du rapport
          </label>
          <input
            id="r-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || toISODate(new Date()))}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          />
          {!isToday ? (
            <Button variant="secondary" onClick={() => setDate(toISODate(new Date()))}>
              <CalendarDays size={16} aria-hidden="true" />
              Aujourd'hui
            </Button>
          ) : null}
        </div>
      </div>

      {/* États */}
      {rapport.isError && !data ? (
        <ErrorState message={rapport.error.detail} onRetry={() => rapport.refetch()} />
      ) : rapport.isPending ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
        </div>
      ) : data ? (
        <>
          {/* Cartes indicateurs */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={Banknote}
              label="Chiffre d'affaires"
              value={formatFcfa(data.ca_total)}
              hint="Total encaissé ce jour"
            />
            <StatCard
              icon={Receipt}
              label="Ventes"
              value={data.nb_ventes}
              hint="Nombre de transactions"
            />
            <StatCard
              icon={ShoppingBasket}
              label="Panier moyen"
              value={formatFcfa(data.panier_moyen)}
              hint="CA / nombre de ventes"
            />
          </div>

          {/* Répartitions */}
          <div className="grid gap-4 md:grid-cols-2">
            <section
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              aria-labelledby="t-modes"
          >
              <h2 id="t-modes" className="mb-3 text-sm font-semibold text-slate-900">
                Encaissements par mode
              </h2>
              {emptyDay || data.encaissements_par_mode.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Aucune vente ce jour-là.</p>
              ) : (
                <ul className="space-y-3">
                  {data.encaissements_par_mode.map((e) => (
                    <PartBar
                      key={e.mode_paiement}
                      label={MODE_LABELS[e.mode_paiement] || e.mode_paiement}
                      value={e.total}
                      total={data.ca_total}
                      detail={`${e.nb_ventes} vente${e.nb_ventes > 1 ? 's' : ''}`}
                      tone="bg-blue-600"
                    />
                  ))}
                </ul>
              )}
            </section>

            <section
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              aria-labelledby="t-cats"
            >
              <h2 id="t-cats" className="mb-3 text-sm font-semibold text-slate-900">
                CA par catégorie
              </h2>
              {emptyDay || data.ca_par_categorie.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Aucune vente ce jour-là.</p>
              ) : (
                <ul className="space-y-3">
                  {data.ca_par_categorie.map((c) => (
                    <PartBar
                      key={c.categorie}
                      label={c.categorie}
                      value={c.ca}
                      total={data.ca_total}
                      tone="bg-emerald-600"
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Top 3 + alertes */}
          <div className="grid gap-4 md:grid-cols-2">
            <section
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              aria-labelledby="t-top"
            >
              <h2 id="t-top" className="mb-3 text-sm font-semibold text-slate-900">
                Top 3 des produits vendus
              </h2>
              {data.top_produits.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Aucune vente ce jour-là.</p>
              ) : (
                <ol className="space-y-2">
                  {data.top_produits.map((t, i) => (
                    <li
                      key={t.produit}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          i === 0
                            ? 'bg-amber-100 text-amber-700'
                            : i === 1
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-orange-100 text-orange-700'
                        }`}
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{t.nom}</p>
                        <p className="font-mono text-xs text-slate-400">{t.code}</p>
                      </div>
                      <Badge tone="blue">× {t.qte}</Badge>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              aria-labelledby="t-alertes"
            >
              <h2 id="t-alertes" className="mb-3 text-sm font-semibold text-slate-900">
                Produits à racheter
              </h2>
              {data.produits_a_racheter.length === 0 ? (
                <div className="py-6">
                  <EmptyState
                    icon={AlertTriangle}
                    title="Aucun produit à racheter"
                    message="Tous les stocks sont au-dessus de leur seuil d'alerte."
                  />
                </div>
              ) : (
                <ul className="space-y-2">
                  {data.produits_a_racheter.map((p) => (
                    <li
                      key={p.produit}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{p.nom}</p>
                        <p className="text-xs text-slate-500">
                          Stock {p.stock} · seuil {p.seuil_alerte}
                        </p>
                      </div>
                      <Badge tone={p.en_rupture ? 'red' : 'orange'}>
                        {p.en_rupture ? 'Rupture' : 'À racheter'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}

      {/* Rapport mensuel — indépendant de la date choisie (@audience patron) */}
      <RapportMensuel />
    </div>
  )
}
