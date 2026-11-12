/**
 * Écran Produits & catégories :
 * tableau paginé, recherche (debounce 250 ms), filtre catégorie,
 * badges stock bas / rupture, CRUD en modal, suppression confirmée.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Package, PackagePlus, Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react'
import Badge from '../components/Badge.jsx'
import Button from '../components/Button.jsx'
import CategorieManager from '../components/CategorieManager.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Modal from '../components/Modal.jsx'
import Pagination from '../components/Pagination.jsx'
import ProduitForm from '../components/ProduitForm.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { useToast } from '../components/Toast.jsx'
import { useCategories, useDeleteProduit, useProduits, useReapprovisionnerProduit } from '../hooks/queries.js'
import { formatFcfa } from '../lib/money.js'
import { formaterStock, modesActifs } from '../lib/conditionnements.js'
import { useDebouncedValue } from '../lib/useDebounce.js'

const PAGE_SIZE = 10 // convention de pagination DRF (docs/API_CONTRACT.md)

function RowSkeleton() {
  return (
    <tr>
      <td className="px-4 py-3" colSpan={8}>
        <Skeleton className="h-6 w-full" />
      </td>
    </tr>
  )
}

export default function Produits() {
  const [search, setSearch] = useState('')
  const [categorie, setCategorie] = useState('')
  const [stockBas, setStockBas] = useState(() =>
    new URLSearchParams(window.location.search).get('stock_bas') === 'true',
  )
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null) // 'create' | Produit | null
  const [toDelete, setToDelete] = useState(null)
  const [reappro, setReappro] = useState(null)
  const [reapproQte, setReapproQte] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 250)
  const location = useLocation()

  // Le filtre « stock critique » peut être poussé par la barre de messages
  // (/produits?stock_bas=true) : on resynchronise l'état à chaque changement d'URL.
  useEffect(() => {
    setStockBas(new URLSearchParams(location.search).get('stock_bas') === 'true')
    setPage(1)
  }, [location.search])


  const categories = useCategories()
  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      categorie: categorie || undefined,
      stock_bas: stockBas || undefined,
      page,
    }),
    [debouncedSearch, categorie, stockBas, page],
  )
  const produits = useProduits(params)
  const del = useDeleteProduit()
  const reapproMutation = useReapprovisionnerProduit()
  const toast = useToast()

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    if (stockBas) searchParams.set('stock_bas', 'true')
    else searchParams.delete('stock_bas')
    const next = searchParams.toString() ? `?${searchParams.toString()}` : ''
    const target = `${window.location.pathname}${next}`
    if (window.location.search !== next) {
      window.history.replaceState({}, '', target)
    }
  }, [stockBas])

  const count = produits.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const catList = categories.data?.results ?? []
  const hasFilters = Boolean(debouncedSearch || categorie || stockBas)

  const resetFilters = () => {
    setSearch('')
    setCategorie('')
    setStockBas(false)
    setPage(1)
  }

  const confirmDelete = () => {
    del.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success(`Produit « ${toDelete.nom} » supprimé.`)
        setToDelete(null)
      },
      onError: (err) => {
        const message = err.detail
          ? `${err.detail} Le stock peut être ramené à 0 pour retirer le produit sans l’effacer du catalogue.`
          : 'Suppression impossible.'
        toast.error(message)
        setToDelete(null)
      },
    })
  }

  const submitReappro = () => {
    const q = Number(reapproQte)
    if (!Number.isInteger(q) || q <= 0) {
      toast.error('La quantité doit être un entier strictement positif.')
      return
    }
    reapproMutation.mutate(
      { id: reappro.id, quantite: q },
      {
        onSuccess: () => {
          toast.success(`Stock de « ${reappro.nom} » mis à jour.`)
          setReappro(null)
          setReapproQte('')
        },
        onError: (err) => {
          toast.error(err.detail || 'Réapprovisionnement impossible.')
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produits</h1>
          <p className="text-sm text-slate-500">{count} produit{count > 1 ? 's' : ''} au catalogue</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setStockBas((v) => !v)}>
            {stockBas ? 'Tous les produits' : 'Stock bas'}
          </Button>
          <Button variant="secondary" onClick={() => setManagerOpen(true)}>
            <Tags size={16} aria-hidden="true" />
            Catégories
          </Button>
          <Button onClick={() => setModal('create')} disabled={modal !== null}>
            <Plus size={16} aria-hidden="true" />
            Nouveau produit
          </Button>
        </div>
      </div>

      {modal !== null ? (
        <ProduitForm
          produit={modal === 'create' ? null : modal}
          categories={catList}
          codesProduits={(produits.data?.results ?? []).map((p) => p.code)}
          onClose={() => setModal(null)}
        />
      ) : (
        <>
        {/* Filtres */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="prod-search" className="sr-only">
              Rechercher un produit
            </label>
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="prod-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Rechercher par nom ou code…"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="prod-cat" className="sr-only">
              Filtrer par catégorie
            </label>
            <select
              id="prod-cat"
              value={categorie}
              onChange={(e) => {
                setCategorie(e.target.value)
                setPage(1)
              }}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-56"
            >
              <option value="">Toutes les catégories</option>
              {catList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* États */}
        {produits.isError && !produits.data ? (
          <ErrorState message={produits.error.detail} onRetry={() => produits.refetch()} />
        ) : produits.isPending ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full">
              <tbody className="divide-y divide-slate-100">
                {[0, 1, 2, 3, 4].map((i) => (
                  <RowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : count === 0 ? (
          <EmptyState
            icon={Package}
            title={hasFilters ? 'Aucun résultat' : 'Aucun produit'}
            message={
              hasFilters
                ? 'Aucun produit ne correspond à votre recherche.'
                : 'Commencez par créer des catégories, puis vos premiers produits.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={resetFilters}>
                  Réinitialiser les filtres
                </Button>
              ) : (
                <Button onClick={() => setModal('create')}>
                  <Plus size={16} aria-hidden="true" />
                  Créer un produit
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Code</th>
                    <th scope="col" className="px-4 py-3">Nom</th>
                    <th scope="col" className="px-4 py-3">Catégorie</th>
                    <th scope="col" className="px-4 py-3">Prix détail</th>
                    <th scope="col" className="px-4 py-3">Modes de vente</th>
                    <th scope="col" className="px-4 py-3">Stock</th>
                    <th scope="col" className="px-4 py-3">Seuil</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {produits.data.results.map((p) => {
                    const modesVente = modesActifs(p).filter((m) => m.facteur > 1)
                    return (
                    <tr key={p.id} className="transition-colors duration-200 ease-in-out">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{p.nom}</td>
                      <td className="px-4 py-3 text-slate-600">{p.categorie_nom}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-900">
                        <span className="font-semibold">{formatFcfa(p.prix)}</span>
                        <span className="ml-1 text-xs font-normal text-slate-500">/ détail</span>
                      </td>
                      <td className="px-4 py-3">
                        {modesVente.length === 0 ? (
                          <span className="text-xs text-slate-400">Détail uniquement</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {modesVente.map((m) => (
                              <span
                                key={m.id ?? m.libelle}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                              >
                                {m.libelle}
                                <span className="font-semibold text-slate-900">×{m.facteur}</span>
                                <span className="text-slate-500">{formatFcfa(m.prix_vente)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {formaterStock(p.quantite, p.conditionnements)}
                          </span>
                          {p.quantite === 0 ? (
                            <Badge tone="red">Rupture</Badge>
                          ) : p.est_en_alerte ? (
                            <Badge tone="orange">Stock bas</Badge>
                          ) : null}
                        </div>
                        {modesVente.length > 0 ? (
                          <div className="text-xs text-slate-500">
                            {p.quantite} unité{p.quantite > 1 ? 's' : ''} de base
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.seuil_alerte}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setReappro(p)}
                            aria-label={`Réapprovisionner ${p.nom}`}
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                          >
                            <PackagePlus size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setModal(p)}
                            aria-label={`Modifier ${p.nom}`}
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setToDelete(p)}
                            aria-label={`Supprimer ${p.nom}`}
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              count={count}
              onChange={setPage}
            />
          </div>
        )}

        </>
      )}

      {/* Modales */}
      <Modal
        open={Boolean(reappro)}
        title={`Réapprovisionner — ${reappro?.nom ?? ''}`}
        onClose={() => {
          setReappro(null)
          setReapproQte('')
        }}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => {
              setReappro(null)
              setReapproQte('')
            }} disabled={reapproMutation.isPending}>
              Annuler
            </Button>
            <Button onClick={submitReappro} disabled={reapproMutation.isPending}>
              {reapproMutation.isPending ? 'Ajout…' : 'Ajouter au stock'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label htmlFor="reap-qty" className="block text-sm font-medium text-slate-700">
            Quantité à ajouter
          </label>
          <input
            id="reap-qty"
            type="number"
            min="1"
            step="1"
            value={reapproQte}
            onChange={(e) => setReapproQte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitReappro()
              }
            }}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            placeholder="12"
            autoFocus
          />
          <p className="text-xs text-slate-500">
            Stock actuel : <strong>{reappro?.stock ?? 0}</strong>
          </p>
        </div>
      </Modal>
      <CategorieManager open={managerOpen} onClose={() => setManagerOpen(false)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Supprimer le produit"
        message={`Supprimer « ${toDelete?.nom} » ? Impossible si le produit figure dans des ventes passées.`}
        confirmLabel="Supprimer"
        pending={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}
