/**
 * Dates du projet — fuseau Africa/Dakar (UTC toute l'année, pas d'heure d'été).
 * Utilisé par les mocks (historique 30 jours) et par le tableau de bord.
 * Les `date_vente` des mocks sont en UTC = heure de Dakar : `slice(0, 10)`
 * donne donc directement la date de Dakar.
 */

export const FUSEAU = 'Africa/Dakar'

const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSEAU,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const FMT_DT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * Date du jour au format AAAA-MM-JJ (fuseau Dakar).
 * @param {Date} [d]
 * @returns {string}
 */
export const dateDakar = (d = new Date()) => FMT.format(d)

/**
 * Date-heure exacte au format `DD/MM/YYYY HH:mm` en fuseau Dakar.
 * @param {Date} [d]
 * @returns {string}
 */
export const dateHeureDakar = (d = new Date()) => FMT_DT.format(d)

/**
 * Alias pour la date du jour en fuseau Dakar utilisée dans les sélecteurs.
 * @param {Date} [d]
 * @returns {string}
 */
export const isoDateDakar = (d = new Date()) => dateDakar(d)

/**
 * Décale une date AAAA-MM-JJ de `jours` (arithmétique UTC, sans effet de fuseau).
 * @param {string} iso 'YYYY-MM-DD'
 * @param {number} jours entier relatif (ex. -1 = hier)
 * @returns {string} 'YYYY-MM-DD'
 */
export function decaleJours(iso, jours) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + jours * 86_400_000).toISOString().slice(0, 10)
}
