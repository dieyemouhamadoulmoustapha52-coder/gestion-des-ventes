/**
 * Gestion des montants — DRF sérialise les DecimalField en chaînes ("15500.00").
 * Toute conversion se fait ici ; les écrans ne voient que des nombres.
 */

const NF = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/**
 * Convertit un montant DRF (chaîne Decimal, nombre ou nul) en nombre JS.
 * @param {string|number|null|undefined} value
 * @returns {number} 0 si valeur absente/invalide
 */
export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Formate un montant en FCFA entiers (locale fr-FR) : formatFcfa(15500) → "15 500 FCFA".
 * @param {string|number|null|undefined} value accepte la chaîne Decimal DRF
 * @returns {string}
 */
export function formatFcfa(value) {
  return `${NF.format(Math.round(toNumber(value)))} FCFA`
}
