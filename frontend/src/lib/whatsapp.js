/**
 * Partage WhatsApp — lien `wa.me` construit à partir d'une vente.
 * Fonctions pures testées (normalisation, troncature, encodage).
 */
import { libelleLigneMode } from './conditionnements.js'
import { dateHeureDakar } from './dates.js'
import { formatFcfa } from './money.js'

/** Limite de longueur du message (tronc proprement « … + N autres articles »). */
export const LIMITE_TEXTE = 1500

/**
 * Normalise un numéro de téléphone en format international, chiffres seuls.
 * - retire espaces, tirets, parenthèses et le « + » initial ;
 * - retire le préfixe « 00 » (indicatif international) ;
 * - un numéro à 9 chiffres est préfixé par 221 (Sénégal) ;
 * - tout autre contenu non numérique → '' (lien sans numéro).
 * @param {unknown} brut
 * @returns {string}
 */
export function normaliserNumero(brut) {
  if (brut === null || brut === undefined) return ''
  let s = String(brut).replace(/[\s\-().]/g, '')
  if (s.startsWith('+')) s = s.slice(1)
  if (s.startsWith('00')) s = s.slice(2)
  if (!/^\d+$/.test(s)) return ''
  if (s.length === 9) s = `221${s}`
  return s
}

/**
 * Numéro du client d'une vente : champ dédié si présent, sinon le nom du
 * client lorsqu'il ne contient que des caractères de numéro.
 * @param {{client_telephone?: string, telephone?: string, client_nom?: string}} vente
 * @returns {string}
 */
export function numeroClient(vente) {
  const direct = vente?.client_telephone ?? vente?.telephone
  if (direct) {
    const n = normaliserNumero(direct)
    if (n) return n
  }
  const nom = String(vente?.client_nom ?? '')
  if (nom && /^[\d\s+().-]+$/.test(nom)) return normaliserNumero(nom)
  return ''
}

/**
 * Message résumé : boutique, n° de vente, date, lignes, total — tronqué
 * proprement sous `limite` caractères.
 * @param {{id: number, date_vente: string, montant_total: number|string,
 *          lignes?: Array<{produit_nom: string, quantite: number,
 *                          montant_ligne: number|string, libelle?: string,
 *                          facteur?: number, est_detail?: boolean}>}} vente
 * @param {{nom?: string, telephone?: string}} [boutique]
 * @param {{limite?: number}} [opts]
 * @returns {string}
 */
export function construireTexte(vente, boutique = {}, opts = {}) {
  const limite = opts.limite ?? LIMITE_TEXTE
  const lignes = vente?.lignes ?? []
  const nomBoutique = boutique.nom || 'Boutique'

  const prefixe = [
    nomBoutique,
    `Vente n° ${vente?.id ?? ''}`,
    dateHeureDakar(new Date(vente?.date_vente)),
  ].join('\n')
  const suffixe = `\nTotal : ${formatFcfa(vente?.montant_total)}${
    boutique.telephone ? `\nTél. ${boutique.telephone}` : ''
  }`

  const corps = lignes.map((l) => {
    const mode = libelleLigneMode(l) // « Carton (12) », vide au Détail
    return `• ${l.produit_nom} ×${l.quantite}${mode ? ` ${mode}` : ''} — ${formatFcfa(l.montant_ligne)}`
  })

  // Ajoute les lignes une par une tant que la limite est respectée.
  const visibles = []
  let restantes = corps.length
  for (const ligne of corps) {
    const candidat = [prefixe, ...visibles, ligne].join('\n')
    if (candidat.length + suffixe.length <= limite) {
      visibles.push(ligne)
      restantes -= 1
    } else {
      break
    }
  }
  if (restantes > 0) {
    visibles.push(`… + ${restantes} autre${restantes > 1 ? 's' : ''} article${restantes > 1 ? 's' : ''}`)
  }

  return [prefixe, ...visibles, suffixe].join('\n').trimEnd()
}

/**
 * Lien WhatsApp complet (URL encodée avec encodeURIComponent).
 * Numéro connu → `https://wa.me/<numero>?text=…`, sinon `https://wa.me/?text=…`.
 * @param {Parameters<typeof construireTexte>[0]} vente
 * @param {Parameters<typeof construireTexte>[1]} [boutique]
 * @param {{limite?: number}} [opts]
 * @returns {string}
 */
export function buildWhatsAppLink(vente, boutique = {}, opts = {}) {
  const texte = construireTexte(vente, boutique, opts)
  const numero = numeroClient(vente)
  const base = numero ? `https://wa.me/${numero}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(texte)}`
}

/**
 * Ouvre le lien dans un nouvel onglet (jamais de popup bloquée par l'agent).
 * @param {string} lien
 */
export function ouvrirWhatsApp(lien) {
  window.open(lien, '_blank', 'noopener,noreferrer')
}
