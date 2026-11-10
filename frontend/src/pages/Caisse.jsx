/**
 * Écran principal — Caisse — @audience caissier.
 * Grille produits + recherche (focus auto) + puces catégories ;
 * panier (useReducer via contexte) ; encaissement ; ticket imprimable 80 mm.
 * Raccourcis : / recherche · Entrée ajoute le 1er résultat · Ctrl+Entrée valide.
 */
import { useEffect, useDeferredValue, useMemo, useRef, useState } from 'react'
import { Minus, Package, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import Badge from '../components/Badge.jsx'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import Ticket from '../components/Ticket.jsx'
import { useToast } from '../components/Toast.jsx'
import { isStockError } from '../api/client.js'
import { useBoutique } from '../config/boutique.js'
import { useCart } from '../context/CartContext.jsx'
import { useMessages } from '../context/MessagesContext.jsx'
import { useCategories, useCreerVente, useProduitsGrille, useVentes30Jours } from '../hooks/queries.js'
import { MODES_CAISSE, MODE_LABELS } from '../lib/constants.js'
import { calculerMonnaie, filtrerProduits, topVendus } from '../lib/caisse.js'
import { formatFcfa, toNumber } from '../lib/money.js'

/** Billets rapides proposés au caissier (FCFA). */
const BILLETS = [500, 1000, 2000, 5000, 10000]

/** Nombre max de résultats surlignables dans la liste rapide. */
const MAX_RESULTATS = 8

export default function Caisse() {
  const [search, setSearch] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [categorie, setCategorie] = useState('')
  const [mode, setMode] = useState('ESPECES')
  const [montantRecu, setMontantRecu] = useState('') // saisie caissier, jamais envoyée à l'API
  const [lineError, setLineError] = useState(null) // {produit, stock_disponible}
  const [ticket, setTicket] = useState(null)

  const searchRef = useRef(null)
  const submitRef = useRef(() => {})

  const categories = useCategories()
  const produits = useProduitsGrille({}) // catalogue complet : filtrage local (pas de debounce)
  const cart = useCart()
  const boutique = useBoutique()
  const creer = useCreerVente()
  const toast = useToast()
  const { notifyVente } = useMessages()

  const catalogue = produits.data?.results ?? []
  const enCategorie = useMemo(
    () => (categorie ? catalogue.filter((p) => String(p.categorie) === categorie) : catalogue),
    [catalogue, categorie],
  )
  // Rendu du filtre en différé (reactivité), recalcul SYNCHRONE à Entrée.
  const termeDiffere = useDeferredValue(search)
  const list = useMemo(
    () => (termeDiffere.trim() ? filtrerProduits(enCategorie, termeDiffere) : enCategorie),
    [enCategorie, termeDiffere],
  )
  // Liste rapide surlignable : calculée sur la valeur courante (jamais périmée).
  const resultats = useMemo(
    () => (search.trim() ? filtrerProduits(enCategorie, search).slice(0, MAX_RESULTATS) : []),
    [enCategorie, search],
  )
  const catList = categories.data?.results ?? []

  // Les plus vendus : top 8 des 30 derniers jours — remontés en tête DE LA GRILLE
  // avec une mise en avant (pas de section à part).
  const ventes30 = useVentes30Jours()
  const topIds = useMemo(
    () => topVendus(ventes30.data ?? [], 8).map((r) => r.produit),
    [ventes30.data],
  )
  const grille = useMemo(() => {
    if (topIds.length === 0) return list
    const parId = new Map(list.map((p) => [p.id, p]))
    const enTete = topIds.map((id) => parId.get(id)).filter(Boolean)
    const idsVus = new Set(topIds)
    return [...enTete, ...list.filter((p) => !idsVus.has(p.id))]
  }, [list, topIds])

  // Monnaie à rendre — affichage + ticket uniquement (jamais dans le corps d'API).
  const monnaie = calculerMonnaie(cart.total, montantRecu)
  const monnaieBloquante = monnaie.statut === 'insuffisant'
  const voirMonnaie = mode === 'ESPECES' // le choix de paiement existe toujours ici

  const addToCart = (p) => {
    if (p.stock <= 0) {
      toast.error(`« ${p.nom} » est en rupture.`)
      return
    }
    const current = cart.items.find((i) => i.produit.id === p.id)?.quantite ?? 0
    if (current + 1 > p.stock) {
      toast.error(`Stock insuffisant pour ${p.nom} (disponible : ${p.stock}).`)
      return
    }
    setLineError(null)
    cart.add(p)
  }

  const validate = () => {
    if (cart.items.length === 0 || creer.isPending || monnaieBloquante) return
    setLineError(null)
    const panierVenduId = cart.actifId // la vente ne réinitialise QUE ce panier
    creer.mutate(
      {
        mode_paiement: mode,
        lignes: cart.items.map((i) => ({ produit: i.produit.id, quantite: i.quantite })),
      },
      {
        onSuccess: (vente) => {
          // Pas de toast : le succès de vente est porté par la barre de messages.
          notifyVente(formatFcfa(vente.montant_total))
          setTicket({
            ...vente,
            ...(monnaie.statut === 'ok'
              ? { montant_recu: toNumber(montantRecu), monnaie_rendue: monnaie.monnaie }
              : {}),
          })
          cart.vendu(panierVenduId)
          setMontantRecu('')
        },
        onError: (err) => {
          if (isStockError(err) && err.payload) {
            setLineError({ produit: err.payload.produit, stock_disponible: err.payload.stock_disponible })
            toast.error('Stock insuffisant — corrigez la ligne concernée.')
          } else if (err.fields?.lignes) {
            toast.error(err.fields.lignes[0])
          } else {
            toast.error(err.detail || 'Encaissement impossible.')
          }
        },
      },
    )
  }

  // La validation lit la dernière version du panier → via ref
  useEffect(() => {
    submitRef.current = validate
  })

  // Raccourcis clavier globaux
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === '/' && !inField) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'F2') {
        e.preventDefault()
        submitRef.current()
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        submitRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Toute modification du panier efface l'erreur de ligne
  useEffect(() => {
    setLineError(null)
  }, [cart.items])

  const onSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Calcul synchrone sur la valeur courante : pas de résultat périmé.
      const synchrones = search.trim() ? filtrerProduits(enCategorie, search) : []
      const cible = synchrones[Math.min(highlight, synchrones.length - 1)]
      if (cible) addToCart(cible)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, Math.max(0, resultats.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Escape') {
      setSearch('')
      setHighlight(0)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Caisse</h1>
          <p className="text-sm text-slate-500">Sélectionnez les produits, puis encaissez.</p>
        </div>
        <p className="hidden rounded-lg bg-white px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200 sm:block">
          <kbd className="font-mono">/</kbd> recherche · <kbd className="font-mono">Entrée</kbd>{' '}
          ajoute · <kbd className="font-mono">F2</kbd> encaisse ·{' '}
          <kbd className="font-mono">Ctrl+Entrée</kbd> valide
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* ── Catalogue ─────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="relative">
            <label htmlFor="caisse-search" className="sr-only">
              Rechercher un produit
            </label>
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="caisse-search"
              ref={searchRef}
              type="search"
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setHighlight(0)
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Rechercher un produit… (nom ou référence)"
              role="combobox"
              aria-expanded={resultats.length > 0}
              aria-controls="caisse-resultats"
              aria-activedescendant={resultats.length > 0 ? `caisse-res-${highlight}` : undefined}
              aria-autocomplete="list"
              className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm shadow-sm"
            />
          </div>

          {/* Résultats rapides navigables (↑/↓, Entrée ajoute) */}
          {resultats.length > 0 ? (
            <ul
              id="caisse-resultats"
              role="listbox"
              aria-label="Résultats de recherche"
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              {resultats.map((p, i) => {
                const rupture = p.stock <= 0
                return (
                  <li
                    key={p.id}
                    id={`caisse-res-${i}`}
                    role="option"
                    aria-selected={i === highlight}
                    aria-disabled={rupture || undefined}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => !rupture && addToCart(p)}
                    className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm ${
                      i === highlight ? 'bg-blue-50' : ''
                    } ${rupture ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{p.nom}</span>
                      <span className="font-mono text-xs text-slate-400">{p.code}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {rupture ? <Badge tone="red">Rupture</Badge> : null}
                      <span className="font-semibold text-slate-900">{formatFcfa(p.prix_unitaire)}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : null}

          <p className="text-xs text-slate-500">
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">↑</kbd>
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">↓</kbd>{' '}
            naviguer ·{' '}
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">Entrée</kbd>{' '}
            ajoute · <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">F2</kbd>{' '}
            encaisse ·{' '}
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">Échap</kbd>{' '}
            efface
          </p>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par catégorie">
            <button
              type="button"
              onClick={() => setCategorie('')}
              aria-pressed={categorie === ''}
              className={`min-h-11 rounded-full px-4 text-sm font-medium transition ${
                categorie === ''
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Toutes
            </button>
            {catList.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategorie(String(c.id) === categorie ? '' : String(c.id))}
                aria-pressed={categorie === String(c.id)}
                className={`min-h-11 rounded-full px-4 text-sm font-medium transition ${
                  categorie === String(c.id)
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.nom}
              </button>
            ))}
          </div>

          {produits.isError && !produits.data ? (
            <ErrorState message={produits.error.detail} onRetry={() => produits.refetch()} />
          ) : produits.isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : grille.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Aucun produit"
              message="Aucun produit ne correspond à votre recherche."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {grille.map((p) => {
                const rupture = p.stock === 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={rupture}
                    onClick={() => addToCart(p)}
                    aria-label={`Ajouter ${p.nom} au panier`}
                    className={`flex flex-col gap-1.5 rounded-xl border p-3 text-left transition ${
                      rupture
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-60'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-mono text-[11px] text-slate-400">{p.code}</span>
                      {rupture ? (
                        <Badge tone="red">Rupture</Badge>
                      ) : p.est_en_alerte ? (
                        <Badge tone="orange">{p.stock} restant{p.stock > 1 ? 's' : ''}</Badge>
                      ) : (
                        <span className="text-[11px] text-slate-400">{p.stock} en stock</span>
                      )}
                    </div>
                    <span className="line-clamp-2 text-sm font-medium text-slate-900">{p.nom}</span>
                    <span className="text-sm font-bold text-blue-700">
                      {formatFcfa(p.prix_unitaire)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Panier ────────────────────────────────────────── */}
        <aside aria-label="Panier" className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Onglets « Panier 1…5 » — jusqu'à 5 paniers en attente */}
            <div
              role="tablist"
              aria-label="Paniers en attente"
              className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-2"
            >
              {cart.paniers.map((p, i) => (
                <span
                  key={p.id}
                  className={`flex items-center rounded-lg border ${
                    p.actif ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={p.actif}
                    onClick={() => cart.activer(i)}
                    className={`min-h-9 rounded-lg px-2.5 text-xs font-medium ${
                      p.actif ? 'text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Panier {i + 1}
                    {p.count ? <span className="ml-1 font-bold">({p.count})</span> : null}
                  </button>
                  {p.vide && cart.paniers.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => cart.fermerPanier(p.id)}
                      aria-label={`Fermer Panier ${i + 1}`}
                      className="flex h-9 w-8 items-center justify-center rounded-r-lg text-slate-400 hover:text-slate-700"
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
              <button
                type="button"
                onClick={cart.ajouterPanier}
                disabled={cart.paniers.length >= 5}
                aria-label="Nouveau panier en attente"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm font-bold text-slate-500 hover:border-slate-400 hover:text-slate-700 disabled:opacity-40"
              >
                +
              </button>
            </div>

            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShoppingCart size={18} aria-hidden="true" />
                Panier
                <Badge tone={cart.count ? 'blue' : 'slate'}>{cart.count}</Badge>
              </h2>
              <Button
                variant="ghost"
                onClick={cart.clear}
                disabled={cart.items.length === 0}
                aria-label="Vider le panier"
              >
                Vider
              </Button>
            </header>

            <div className="max-h-[38vh] divide-y divide-slate-100 overflow-y-auto">
              {cart.items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  Le panier est vide — cliquez sur un produit pour l'ajouter.
                </p>
              ) : (
                cart.items.map((item) => {
                  const erreur = lineError && lineError.produit === item.produit.id
                  return (
                    <div key={item.produit.id} className="space-y-1.5 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {item.produit.nom}
                        </p>
                        <p className="whitespace-nowrap text-sm font-semibold text-slate-900">
                          {formatFcfa(item.produit.prix_unitaire * item.quantite)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => cart.dec(item.produit.id)}
                            aria-label={`Retirer une unité de ${item.produit.nom}`}
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                          >
                            <Minus size={14} aria-hidden="true" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold" aria-live="polite">
                            {item.quantite}
                          </span>
                          <button
                            type="button"
                            onClick={() => cart.inc(item.produit.id)}
                            disabled={item.quantite >= item.produit.stock}
                            aria-label={`Ajouter une unité de ${item.produit.nom}`}
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                          >
                            <Plus size={14} aria-hidden="true" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => cart.remove(item.produit.id)}
                          aria-label={`Supprimer ${item.produit.nom} du panier`}
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                      {erreur ? (
                        <p className="text-xs font-medium text-red-600" role="alert">
                          Stock insuffisant — disponible : {lineError.stock_disponible}
                        </p>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>

            <div className="space-y-3 border-t border-slate-200 px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Total</span>
                <span className="text-lg font-bold text-slate-900">{formatFcfa(cart.total)}</span>
              </div>

              <div role="group" aria-label="Mode de paiement" className="grid grid-cols-3 gap-2">
                {MODES_CAISSE.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={`min-h-11 rounded-lg border px-1 text-sm font-medium transition ${
                      mode === m
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>

              {voirMonnaie ? (
                <div className="space-y-2">
                  <label htmlFor="caisse-recu" className="block text-sm font-medium text-slate-700">
                    Montant reçu
                  </label>
                  <input
                    id="caisse-recu"
                    type="text"
                    inputMode="numeric"
                    value={montantRecu}
                    onChange={(e) => setMontantRecu(e.target.value)}
                    placeholder="0"
                    aria-describedby="caisse-monnaie"
                    aria-invalid={monnaieBloquante ? 'true' : undefined}
                    className={`h-11 w-full rounded-lg border bg-white px-3 text-sm ${
                      monnaieBloquante ? 'border-red-500' : 'border-slate-300'
                    }`}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {BILLETS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setMontantRecu(String(toNumber(montantRecu) + b))}
                        className="min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        +{b.toLocaleString('fr-FR')}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMontantRecu(String(cart.total))}
                      className="min-h-9 rounded-lg border border-blue-600 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      Compte juste
                    </button>
                  </div>
                  <p
                    id="caisse-monnaie"
                    aria-live="polite"
                    className={`text-sm font-medium ${
                      monnaieBloquante ? 'text-red-600' : 'text-slate-600'
                    }`}
                  >
                    {monnaie.statut === 'insuffisant'
                      ? `Il manque ${formatFcfa(monnaie.manque)}`
                      : monnaie.statut === 'ok'
                        ? `Monnaie à rendre : ${formatFcfa(monnaie.monnaie)}`
                        : 'Saisissez le montant reçu (facultatif).'}
                  </p>
                </div>
              ) : null}

              <Button
                className="w-full"
                onClick={validate}
                disabled={cart.items.length === 0 || creer.isPending || monnaieBloquante}
              >
                {creer.isPending
                  ? 'Encaissement…'
                  : cart.items.length
                    ? `Encaisser ${formatFcfa(cart.total)}`
                    : 'Encaisser'}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <Ticket vente={ticket} boutique={boutique} open={Boolean(ticket)} onClose={() => setTicket(null)} />
    </div>
  )
}
