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
