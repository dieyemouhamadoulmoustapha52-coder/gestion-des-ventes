/**
 * Accès aux données via React Query — un hook par ressource.
 * Les mutations invalident proprement les listes concernées.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../api/categories.js'
import { createProduit, deleteProduit, listProduits, updateProduit } from '../api/produits.js'
import { creerVente, getVente, listToutesVentes, listVentes, listVentesDetaillees } from '../api/ventes.js'
import { getRapportJour, getTableauDeBord } from '../api/rapports.js'
import { reapprovisionnerProduit } from '../api/produits.js'
import { dateDakar, decaleJours } from '../lib/dates.js'

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

/**
 * Liste des ventes paginée (Historique — @audience patron).
 * @param {{date?: string, date_debut?: string, date_fin?: string,
 *          produit?: number|string, mode_paiement?: string,
 *          page?: number, page_size?: number}} params
 */
export function useVentes(params) {
  return useQuery({
    queryKey: ['ventes', params],
    queryFn: () => listVentes(params),
    placeholderData: keepPreviousData,
  })
}

/**
 * Totaux du jeu FILTRÉ de l'Historique (nombre + montant FCFA) —
 * @audience patron. Invalide avec la clé ['ventes'].
 * @param {{date?: string, date_debut?: string, date_fin?: string,
 *          produit?: number|string, mode_paiement?: string,
 *          search?: string}} params
 * @returns {import('@tanstack/react-query').UseQueryResult<{count: number, total: number}>}
 */
export function useTotauxVentes(params) {
  return useQuery({
    queryKey: ['ventes', 'totaux', params],
    queryFn: async () => {
      const liste = await listToutesVentes(params)
      return {
        count: liste.length,
        total: liste.reduce((s, v) => s + (Number(v.montant_total) || 0), 0),
      }
    },
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

/**
 * Ventes des 30 derniers jours AVEC leurs lignes (plus vendus de la caisse).
 * @audience caissier
 * @returns {import('@tanstack/react-query').UseQueryResult<import('../api/types.js').VenteComplete[]>}
 */
export function useVentes30Jours() {
  const au = dateDakar()
  const du = decaleJours(au, -29)
  return useVentesPeriode(du, au)
}

/**
 * Ventes d'une période [du, au] AVEC leurs lignes (rapport mensuel).
 * @audience patron
 * @param {string} du 'YYYY-MM-DD' @param {string} au 'YYYY-MM-DD'
 * @returns {import('@tanstack/react-query').UseQueryResult<import('../api/types.js').VenteComplete[]>}
 */
export function useVentesPeriode(du, au) {
  return useQuery({
    queryKey: ['ventes', 'periode', du, au, 'lignes'],
    queryFn: () => listVentesDetaillees({ date_debut: du, date_fin: au }),
    staleTime: 120_000,
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
      qc.invalidateQueries({ queryKey: ['tableau-de-bord'] })
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
      qc.invalidateQueries({ queryKey: ['tableau-de-bord'] })
    },
  })
}

/** @param {{id: number, quantite: number}} vars */
export function useReapprovisionnerProduit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, quantite }) => reapprovisionnerProduit(id, quantite),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produits'] })
      qc.invalidateQueries({ queryKey: ['rapport'] })
      qc.invalidateQueries({ queryKey: ['tableau-de-bord'] })
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
