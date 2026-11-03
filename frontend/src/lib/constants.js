/** Constantes métier partagées par les écrans. */

/** Seuil d'affichage du badge « Stock bas » (constante UI, cf. cahier des charges). */
export const STOCK_BAS_SEUIL = 5

/** Modes envoyés par l'écran de caisse (cf. docs/API_CONTRACT.md). */
export const MODES_CAISSE = ['ESPECES', 'WAVE', 'ORANGE_MONEY']

/** Libellés d'affichage — miroir de l'enum Django ModePaiement. */
export const MODE_LABELS = {
  ESPECES: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  CARTE: 'Carte',
}
