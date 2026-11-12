/**
 * Section « Ce mois-ci vs mois précédent » — rapport mensuel.
 * Indépendante de la date du rapport : compare le mois en cours (1er →
 * aujourd'hui) au même nombre de jours du mois précédent + total complet.
 * @audience patron
 */
import { AlertTriangle, Banknote, Percent, Receipt, TrendingDown, TrendingUp } from 'lucide-react'
import EmptyState from './EmptyState.jsx'
import ErrorState from './ErrorState.jsx'
import Skeleton from './Skeleton.jsx'
import { useVentesPeriode } from '../hooks/queries.js'
import { dateDakar } from '../lib/dates.js'
import { formatFcfa } from '../lib/money.js'
import { bornesMois, comparerMois, topProduits } from '../lib/stats.js'

/** Variation % : flèche + signe + texte (jamais la couleur seule). */
function Variation({ value }) {
  if (value === null || value === undefined) {
    return (
      <span className="text-xs font-medium text-slate-500" aria-label="variation indisponible">
        —
      </span>
    )
  }
  if (value === 0) {
    return <span className="text-xs font-medium text-slate-500">= 0 % (stable)</span>
  }
  const hausse = value > 0
  const Icon = hausse ? TrendingUp : TrendingDown
  const signe = hausse ? '+' : '−'
  const texte = `${Math.abs(value).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        hausse ? 'text-emerald-700' : 'text-red-700'
      }`}
    >
      <Icon size={13} aria-hidden="true" />
      {signe} {texte} {hausse ? 'en hausse' : 'en baisse'}
    </span>
  )
}

function CarteIndicateur({ icon: Icon, label, valeur, variation }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon size={16} aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{valeur}</p>
      <p className="mt-1">{variation}</p>
    </div>
  )
}

/** Format court 'DD/MM/YYYY' pour les bornes de période. */
function court(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function RapportMensuel() {
  const ref = dateDakar()
  const bornes = bornesMois(ref)
  const ventes = useVentesPeriode(bornes.precedentComplet[0], ref)

  if (ventes.isError && !ventes.data) {
    return (
      <section aria-labelledby="t-mensuel" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="t-mensuel" className="mb-3 text-sm font-semibold text-slate-900">
          Ce mois-ci vs mois précédent
        </h2>
        <ErrorState message={ventes.error.detail} onRetry={() => ventes.refetch()} />
      </section>
    )
  }
  if (ventes.isPending) {
    return (
      <section aria-labelledby="t-mensuel" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="t-mensuel" className="mb-3 text-sm font-semibold text-slate-900">
          Ce mois-ci vs mois précédent
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </section>
    )
  }

  const cmp = comparerMois(ventes.data, ref)
  const top = topProduits(ventes.data, ref, 5)
  const { courant, precedentMemeJours, precedentComplet, variations } = cmp
  const beneficeDispo = courant.benefice !== null

  return (
    <section aria-labelledby="t-mensuel" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 id="t-mensuel" className="text-sm font-semibold text-slate-900">
        Ce mois-ci vs mois précédent
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        {court(cmp.bornes.courant[0])} → {court(cmp.bornes.courant[1])} comparé à{' '}
        {court(cmp.bornes.precedentMemeJours[0])} → {court(cmp.bornes.precedentMemeJours[1])}
      </p>

      <div className={`mt-4 grid gap-4 ${beneficeDispo ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <CarteIndicateur
          icon={Banknote}
          label="Chiffre d'affaires"
          valeur={formatFcfa(courant.ca)}
          variation={<Variation value={variations.ca} />}
        />
        <CarteIndicateur
          icon={Receipt}
          label="Ventes"
          valeur={courant.nbVentes}
          variation={<Variation value={variations.nbVentes} />}
        />
        {beneficeDispo ? (
          <CarteIndicateur
            icon={Percent}
            label="Bénéfice"
            valeur={formatFcfa(courant.benefice)}
            variation={<Variation value={variations.benefice} />}
          />
        ) : null}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Total du mois précédent complet : <strong>{formatFcfa(precedentComplet.ca)}</strong> (
        {precedentComplet.nbVentes} vente{precedentComplet.nbVentes > 1 ? 's' : ''}) · même période
        le mois dernier : <strong>{formatFcfa(precedentMemeJours.ca)}</strong>
      </p>

      <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-900">Top 5 produits du mois (unités de base)</h3>
      {top.length === 0 ? (
        <div className="py-4">
          <EmptyState
            icon={AlertTriangle}
            title="Aucune vente ce mois-ci"
            message="Les produits vendus depuis le 1er du mois apparaîtront ici."
          />
        </div>
      ) : (
        <ol className="space-y-2">
          {top.map((t, i) => (
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
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">
                  {t.qte} unité{t.qte > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-slate-500">{formatFcfa(t.ca)}</p>
              </div>
              <div className="w-28 text-right">
                <Variation value={t.variation} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
