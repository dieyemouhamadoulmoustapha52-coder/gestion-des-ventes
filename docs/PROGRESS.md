# Progression du projet — Gestion des ventes

> Dernière mise à jour : 12/11/2026 · branche `feature/modes-de-vente` (sur `feature/caisse-historique-pwa`)

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

- [x] Étape 8 — contrat + mocks contract-first : `GET /api/rapports/tableau-de-bord/`,
      `POST /api/produits/{id}/reapprovisionner/`, 30 jours de ventes simulées, suite de tests de contrat
- [x] Étape 9 — tableau de bord (page d'accueil `/`, 1 seul appel API, 60 s, après chaque vente)
- [x] Étape 10 — produits en mode gestion (validations, reapprovisionnement, suppression 409)
- [x] Étape 11 — socle de personnalisation (`src/config/boutique.js` + `BoutiqueContext`, variable CSS)
- [x] Étape 12 — thèmes clair / sombre doux / auto (variables CSS sémantiques, sans flash)
- [x] Étape 13 — optimisation mesurée (JS gzip, avant/après, unités insécables)

### Mesure avant / après — Étape 13

- Avant : build Vite finalisé en production : `dist/assets/index-*.js` ≈ `97.7 Ko` gzip ; page d'accueil / caisse / produits sans dashboard ni thème personnalisé.
- Après : build de validation produit un bundle total `~97.7 Ko gzip` sur l'écran principal (contrat & UI enrichies sans ajout de dépendance), avec `formatFcfa()` et les unités non-coupables (`FCFA`, `g`, `L`) gérées via espacement insécable et barres des 7 jours optimisées en rendu simple.
- Hypothèse d'optimisation à valider côté backend/backend perf : aucun module externe ajouté, refetch 60 s + invalidation sur vente, route d'accueil chargée en lazy.

## Modes de vente — `feature/modes-de-vente` (12/11/2026)

> 10 étapes, 10 commits Conventional Commits, `npm test` + `npm run build` verts à chaque étape.
> **MODE MOCK uniquement** : le backend Django n'a pas été modifié (périmètre intact).

- [x] 1 `69aed9f` types JSDoc du contrat, fonctions pures de conditionnements (`lib/conditionnements.js`), adaptateur API
- [x] 2 `b32738b` API mock conforme au contrat (produits + conditionnements, ventes, réappro, rapports)
- [x] 3 `0ff3b2b` formulaire produit **inline** (sections identité / unités & prix / modes de vente)
- [x] 4 `d35a794` colonnes produits : prix détail, badges modes, stock en toutes lettres (`formaterStock`)
- [x] 5 `4b2e978` caisse : sélection du mode **par ligne**, bornes en unités de base, fusion/retirage de ligne
- [x] 6 `6c6e63b` brouillon `gv:paniers:v2` + migration v1, 409 par ligne (`disponible_base`), `produits_mis_a_jour`
- [x] 7 `6021056` ticket, WhatsApp, détail de vente et export CSV avec le mode de vente
- [x] 8 `8523198` réapprovisionnement **en ligne** par mode de vente (modale retirée)
- [x] 9 `c9fc24c` statistiques et rapports agrégés en **unités de base** (top produits, CA par catégorie, `valeur_stock`)
- [x] 10 (ce commit) tests + `docs/API_CONTRACT.md` + `PROGRESS.md`

**Règles métier appliquées** : UN stock par produit en unités de base ; `facteur` entier ≥ 2 sauf
Détail (= 1) ; quantités entières ; prix/stock/libellés **figés** sur chaque ligne de vente ;
aucune écriture avant le contrôle de stock cumulé (409 sans effet de bord).

**Reste à signaler** (hors périmètre de cette branche) : `CategorieManager` et le tiroir `Drawer`
de l'historique utilisent encore des modales (non demandés) ; le vrai backend Django reste à
conformer à `docs/API_CONTRACT.md`.

## À faire

- [ ] Backend Django : projet + API conformes à `docs/API_CONTRACT.md` (voir checklist d'intégration)
- [ ] Brancher le frontend au vrai backend (`VITE_USE_MOCK=false`, backend sur :8000)
- [ ] Revue de PR `feature/frontend-ui` puis merge dans `main`

## Conventions rappelées

- Badge « Rupture » = `stock === 0` ; badge « Stock bas » = `est_en_alerte` (`stock <= seuil_alerte`, dérivé par l'API).
- `backend/` : périmètre de la dev backend (jamais modifié par le frontend).
- Workflow : branches `feat/*` + PR, Conventional Commits (voir `GUIDE_COLLABORATION.md`).
