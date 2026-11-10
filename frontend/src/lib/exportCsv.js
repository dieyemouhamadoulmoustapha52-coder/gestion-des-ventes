/**
 * Export CSV des ventes — @audience patron.
 * Fonctions pures (aucun DOM, testées par Vitest) : format Excel FR
 * (séparateur `;`, BOM UTF-8, fins de ligne CRLF), protection anti-injection
 * de formules, échappement des guillemets. Aucune bibliothèque.
 */
import { dateHeureDakar, FUSEAU } from './dates.js'
import { toNumber } from './money.js'

/** Colonnes du fichier (ordre imposé par le cahier des charges). */
export const COLONNES_CSV = [
  'N° vente',
  'Date',
  'Heure',
  'Client',
  'Articles',
  'Total',
  'Moyen de paiement',
]

/**
 * Échappe une cellule CSV : protection contre les formules Excel
 * (préfixe `'` si la valeur commence par = + - @) puis guillemetage
 * si la valeur contient `;`, `"`, ou un retour à la ligne.
 * @param {unknown} valeur
 * @returns {string}
 */
export function echapperCellule(valeur) {
  let s = String(valeur ?? '')
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  if (/[;"\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

/** Date JJ/MM/AAAA en fuseau Africa/Dakar. */
function dateFr(iso) {
  const dh = dateHeureDakar(new Date(iso))
  return dh.split(' ')[0] ?? ''
}

/** Heure HH:MM en fuseau Africa/Dakar. */
function heureFr(iso) {
  const dh = dateHeureDakar(new Date(iso))
  return dh.split(' ')[1] ?? ''
}

/**
 * Construit le contenu complet du CSV (BOM inclus, lignes CRLF).
 * @param {Array<{id: number, date_vente: string, client_nom?: string,
 *                mode_paiement?: string, montant_total: number|string,
 *                lignes?: Array<{produit_nom: string, quantite: number}>}>} ventes
 *   jeu filtré COMPLET (pas seulement une page)
 * @param {Record<string, string>} [modeLabels] libellés des moyens de paiement
 * @returns {string}
 */
export function genererCsvVentes(ventes, modeLabels = {}) {
  const lignes = [COLONNES_CSV.map(echapperCellule).join(';')]
  for (const v of ventes ?? []) {
    const articles = (v.lignes ?? [])
      .map((l) => `${l.produit_nom} ×${Number(l.quantite) || 0}`)
      .join(' ; ')
    const cells = [
      String(v.id ?? ''),
      dateFr(v.date_vente),
      heureFr(v.date_vente),
      v.client_nom || '',
      articles,
      String(toNumber(v.montant_total)),
      (v.mode_paiement && modeLabels[v.mode_paiement]) || v.mode_paiement || '',
    ]
    lignes.push(cells.map(echapperCellule).join(';'))
  }
  return `﻿${lignes.join('\r\n')}\r\n`
}

/**
 * Nom de fichier `ventes_AAAA-MM-JJ_AAAA-MM-JJ.csv` (période fournie,
 * sinon déduite des ventes exportées).
 * @param {Array<{date_vente: string}>} ventes
 * @param {string|null|undefined} du 'YYYY-MM-DD'
 * @param {string|null|undefined} au 'YYYY-MM-DD'
 * @returns {string}
 */
export function nomFichierCsv(ventes, du, au) {
  const dates = (ventes ?? [])
    .map((v) => String(v.date_vente ?? '').slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
  const d1 = du || dates[0] || 'inconnu'
  const d2 = au || dates[dates.length - 1] || 'inconnu'
  return `ventes_${d1}_${d2}.csv`
}

/**
 * Déclenche le téléchargement d'un fichier texte (DOM — pas une fonction pure).
 * @param {string} contenu
 * @param {string} nomFichier
 */
export function telechargerCsv(contenu, nomFichier) {
  const blob = new Blob([contenu], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomFichier
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Fuseau exporté (documenté pour la dev backend). */
export const FUSEAU_EXPORT = FUSEAU
