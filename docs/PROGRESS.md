# Progression du projet — Gestion des ventes

> Dernière mise à jour : 03/11/2026 · branche `feature/frontend-ui`

## Fait

- [x] Modélisation BDD + service `creer_vente` (`modelisation_base_de_donnees.md`)
- [x] Présentation projet (DeckCraft + PPTX)
- [x] Squelette monorepo `backend/` + `frontend/`, README, GUIDE_COLLABORATION, dépôt GitHub
- [x] Frontend Étape 1 — contrat d'API (`docs/API_CONTRACT.md`), couche API, mocks MSW (testé : 30/30)
- [x] Frontend Étape 2 — socle UI (layout responsive, routes lazy, composants communs)
- [x] Frontend Étape 3 — produits & catégories (recherche, filtres, CRUD)
- [x] Frontend Étape 4 — caisse (panier, raccourcis clavier, ticket 80 mm)
- [x] Frontend Étape 5 — historique des ventes (filtres, tiroir, réimpression)
- [x] Frontend Étape 6 — rapport du jour (indicateurs, répartitions, top 3, alertes)
- [x] README frontend + checklist d'intégration (JS initial ≈ 97 Ko gzip)
- [x] Correction seuil : badge « Stock bas » aligné sur `est_en_alerte` (API) — constante ≤ 5 retirée ;
      `seuil_alerte` distinct par produit dans les mocks (HUILE5 et BISSAP en alerte, JAVEL en rupture)
- [x] Correction Firefox : démarrage MSW entouré d'un try/catch dans `bootstrap()` (plus d'écran blanc
      si les service workers sont bloqués) + bannière « Mode démo indisponible » + favicon SVG

## Phase 2 — étapes 8 à 13 (frontend)

- [ ] Étape 8 — contrat + mocks contract-first : `GET /api/rapports/tableau-de-bord/`,
      `POST /api/produits/{id}/reapprovisionner/`, 30 jours de ventes simulées, suite de tests de contrat
- [ ] Étape 9 — tableau de bord (page d'accueil `/`, 1 seul appel API, 60 s, après chaque vente)
- [ ] Étape 10 — produits en mode gestion (validations, reapprovisionnement, suppression 409)
- [ ] Étape 11 — socle de personnalisation (`src/config/boutique.js` + `BoutiqueContext`, variable CSS)
- [ ] Étape 12 — thèmes clair / sombre doux / auto (variables CSS sémantiques, sans flash)
- [ ] Étape 13 — optimisation mesurée (JS gzip, avant/après, unités insécables)

## À faire

- [ ] Backend Django : projet + API conformes à `docs/API_CONTRACT.md` (voir checklist d'intégration)
- [ ] Brancher le frontend au vrai backend (`VITE_USE_MOCK=false`, backend sur :8000)
- [ ] Revue de PR `feature/frontend-ui` puis merge dans `main`

## Conventions rappelées

- Badge « Rupture » = `stock === 0` ; badge « Stock bas » = `est_en_alerte` (`stock <= seuil_alerte`, dérivé par l'API).
- `backend/` : périmètre de la dev backend (jamais modifié par le frontend).
- Workflow : branches `feat/*` + PR, Conventional Commits (voir `GUIDE_COLLABORATION.md`).
