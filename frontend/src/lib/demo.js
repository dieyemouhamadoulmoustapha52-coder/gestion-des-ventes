/**
 * État du mode démo (MSW) — écrit par main.jsx AVANT le rendu,
 * lu par la bannière <DemoBanner />.
 * Aucune dépendance à msw : importable partout, y compris en production.
 */
export const demoState = {
  /** true si le worker MSW a démarré correctement */
  actif: false,
  /** true si le démarrage a échoué (service worker bloqué : navigation privée…) */
  indisponible: false,
}
