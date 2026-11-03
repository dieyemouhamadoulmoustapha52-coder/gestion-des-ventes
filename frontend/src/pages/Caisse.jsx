/**
 * Écran principal — Caisse.
 * Grille produits + recherche (focus auto) + puces catégories ;
 * panier (useReducer via contexte) ; encaissement ; ticket imprimable80 mm.
 * Raccourcis : / recherche · Entrée ajoute le 1er résultat · Ctrl+Entrée valide.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Package, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import Badge from '../components/Badge.jsx'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import Ticket from '../components/Ticket.jsx'
import { useToast } from '../components/Toast.jsx'
import { isStockError } from '../api/client.js'
import { useCart } from '../context/CartContext.jsx'
import { useCategories, useCreerVente, useProduitsGrille } from '../hooks/queries.js'
import { MODES_CAISSE, MODE_LABELS, STOCK_BAS_SEUIL } from '../lib/constants.js'
import { formatFcfa } from '../lib/money.js'
import { useDebounce } from '../lib/useDebounce.js'

export default function Caisse() {
  const [search, setSearch] = useState('')
  const [categorie, setCategorie] = useState('')
  const [mode, setMode] = useState('ESPECES')
  const [lineError, setLineError] = useState(null) // {produit, stock_disponible}
  const [ticket, setTicket] = useState(null)

  const debouncedSearch = useDebounce(search, 250)
  const searchRef = useRef(null)
  const submitRef = useRef(() => {})

  const categories = useCategories()
  const produits = useProduitsGrille({
    search: debouncedSearch || undefined,
    categorie: categorie || undefined,
  })
  const cart = useCart()
  const creer = useCreerVente()
  const toast = useToast()

  const list = useMemo(() => produits.data?.results ?? [], [produits.data])
  const catList = categories.data?.results ?? []

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
    if (cart.items.length === 0 || creer.isPending) return
    setLineError(null)
    creer.mutate(
      {
        mode_paiement: mode,
        lignes: cart.items.map((i) => ({ produit: i.produit.id, quantite: i.quantite })),
      },
      {
        onSuccess: (vente) => {
          toast.success(`Vente n° ${vente.id} encaissée — ${formatFcfa(vente.montant_total)}.`)
          setTicket(vente)
          cart.clear()
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
      const first = list[0]
      if (first) addToCart(first)
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
          ajoute · <kbd className="font-mono">Ctrl+Entrée</kbd> valide
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
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Rechercher un produit… (puis Entrée pour ajouter)"
              className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm shadow-sm"
            />
          </div>

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
          ) : list.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Aucun produit"
              message="Aucun produit ne correspond à votre recherche."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {list.map((p) => {
                const rupture = p.stock <= 0
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
                      ) : p.stock <= STOCK_BAS_SEUIL ? (
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

              <Button
                className="w-full"
                onClick={validate}
                disabled={cart.items.length === 0 || creer.isPending}
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

      <Ticket vente={ticket} open={Boolean(ticket)} onClose={() => setTicket(null)} />
    </div>
  )
}
