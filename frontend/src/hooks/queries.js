/**
 * Accès aux données via React Query — un hook par ressource.
 * Les mutations invalident proprement les listes concernées.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../api/categories.js'
import { createProduit, deleteProduit, listProduits, updateProduit } from '../api/produits.js'
import { creerVente, getVente, listVentes } from '../api/ventes.js'
import { getRapportJour, getTableauDeBord } from '../api/rapports.js'
import { reapprovisionnerProduit } from '../api/produits.js'

// ── Queries ─────────────────────────────────────────────────────

/** Récupère TOUTES les pages produits (grille de caisse sans coupure). */
async function fetchAllProduits(params) {
  const first = await listProduits({ ...params, page: 1 })
  let results = first.results
  let next = first.next
  let page = 1
  while (next && page < 20) {
    page += 1
    const p = await listProduits({ ...params, page })
    results = results.concat(p.results)
    next = p.next
  }
  return { ...first, results }
}

/** Grille produits de la caisse (toutes pages confondues). */
export function useProduitsGrille(params) {
  return useQuery({
    queryKey: ['produits', 'grille', params],
    queryFn: () => fetchAllProduits(params),
    placeholderData: keepPreviousData,
  })
}

/** @returns {import('@tanstack/react-query').UseQueryResult<import('../api/types.js').Page<import('../api/types.js').Categorie>>} */
export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: listCategories })
}

/**
 * Liste produits paginée (placeholderData → pas de saut lors du filtrage).
 * @param {{search?: string, categorie?: string|number|null, stock_bas?: boolean, page?: number}} params
 */
export function useProduits(params) {
  return useQuery({
    queryKey: ['produits', params],
    queryFn: () => listProduits(params),
    placeholderData: keepPreviousData,
  })
}

/** @param {{date?: string, mode_paiement?: string, page?: number}} params */
export function useVentes(params) {
  return useQuery({
    queryKey: ['ventes', params],
    queryFn: () => listVentes(params),
    placeholderData: keepPreviousData,
  })
}

/** Détail d'une vente (tiroir). @param {number|null} id */
export function useVente(id) {
  return useQuery({
    queryKey: ['ventes', 'detail', id],
    queryFn: () => getVente(id),
    enabled: id !== null && id !== undefined,
  })
}

/** Rapport du jour. @param {string} date 'YYYY-MM-DD' */
export function useRapport(date) {
  return useQuery({ queryKey: ['rapport', date], queryFn: () => getRapportJour(date) })
}

/**
 * Tableau de bord (page d'accueil) — UN SEUL appel, rafraîchi toutes les 60 s.
 * @param {string} [date] 'YYYY-MM-DD' — défaut serveur : aujourd'hui (Africa/Dakar)
 * @returns {import('@tanstack/react-query').UseQueryResult<import('../api/types.js').TableauDeBord>}
 */
export function useTableauDeBord(date) {
  return useQuery({
    queryKey: ['tableau-de-bord', date ?? 'aujourdhui'],
    queryFn: () => getTableauDeBord(date),
    refetchInterval: 60_000, // mise à jour automatique chaque minute
    refetchWindowInBackground: false,
  })
}

// ── Mutations ───────────────────────────────────────────────────

/**
 * Création de vente — invalide produits (stock), ventes et rapport.
 * @returns {import('@tanstack/react-query').UseMutationResult<import('../api/types.js').VenteComplete, import('../api/client.js').ApiError>}
 */
export function useCreerVente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => creerVente(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produits'] })
      qc.invalidateQueries({ queryKey: ['ventes'] })
      qc.invalidateQueries({ queryKey: ['rapport'] })
    },
  })
}

/** Création/édition produit. @param {{id?: number, data: object}} vars */
export function useSaveProduit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => (id ? updateProduit(id, data) : createProduit(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produits'] })
      qc.invalidateQueries({ queryKey: ['rapport'] }) // alertes de stock
    },
  })
}

/** @param {number} id */
export function useDeleteProduit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteProduit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produits'] })
      qc.invalidateQueries({ queryKey: ['rapport'] })
    },
  })
}

/** @param {{id?: number, data: {nom: string, description?: string}}} vars */
export function useSaveCategorie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => (id ? updateCategory(id, data) : createCategory(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['produits'] }) // categorie_nom affiché
    },
  })
}

/** @param {number} id */
export function useDeleteCategorie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['produits'] })
    },
  })
}
