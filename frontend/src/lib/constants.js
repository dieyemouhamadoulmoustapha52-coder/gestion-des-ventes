/** Constantes métier partagées par les écrans. */

/** Modes envoyés par l'écran de caisse (cf. docs/API_CONTRACT.md). */
export const MODES_CAISSE = ['ESPECES', 'WAVE', 'ORANGE_MONEY']

/** Libellés d'affichage — miroir de l'enum Django ModePaiement
 *  (hors Carte : mode absent de la caisse et de la boutique). */
export const MODE_LABELS = {
  ESPECES: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
}
