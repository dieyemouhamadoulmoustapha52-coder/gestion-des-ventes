/** Endpoint reporting — rapports/jour/?date=YYYY-MM-DD. */
import { request } from './client.js'
import { toNumber } from '../lib/money.js'

/**
 * Rapport du jour : CA, ventes, panier moyen, répartitions, top 3, alertes.
 * @param {string} date 'YYYY-MM-DD'
 * @returns {Promise<import('./types.js').RapportJour>} montants normalisés
 */
export async function getRapportJour(date) {
  const data = await request(`rapports/jour/?date=${encodeURIComponent(date)}`)
  return {
    ...data,
    ca_total: toNumber(data.ca_total),
    panier_moyen: toNumber(data.panier_moyen),
    encaissements_par_mode: (data.encaissements_par_mode || []).map((e) => ({
      ...e,
      total: toNumber(e.total),
    })),
    ca_par_categorie: (data.ca_par_categorie || []).map((c) => ({
      ...c,
      ca: toNumber(c.ca),
    })),
    top_produits: data.top_produits || [],
    produits_a_racheter: data.produits_a_racheter || [],
  }
}

/**
 * Tableau de bord : CA du jour, série 7 jours, top produits, stocks, dernières ventes.
 * @param {string} [date] 'YYYY-MM-DD' — défaut : aujourd'hui (Africa/Dakar)
 * @returns {Promise<import('./types.js').TableauDeBord>} montants normalisés
 */
export async function getTableauDeBord(date) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  const data = await request(`rapports/tableau-de-bord/${qs}`)
  return {
    ...data,
    aujourdhui: {
      ...data.aujourdhui,
      ca: toNumber(data.aujourdhui.ca),
      panier_moyen: toNumber(data.aujourdhui.panier_moyen),
    },
    hier: { ...data.hier, ca: toNumber(data.hier.ca) },
    serie_7_jours: (data.serie_7_jours || []).map((j) => ({ ...j, ca: toNumber(j.ca) })),
    top_produits_semaine: data.top_produits_semaine || [],
    stock: { ...data.stock, valeur_stock: toNumber(data.stock.valeur_stock) },
    dernieres_ventes: (data.dernieres_ventes || []).map((v) => ({
      ...v,
      montant_total: toNumber(v.montant_total),
    })),
  }
}
