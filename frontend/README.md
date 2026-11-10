# Frontend — Gestion des ventes (React 19 + Vite 6)

## Lancer en mode mock

```bash
cd frontend
npm install
cp .env.example .env      # VITE_USE_MOCK=true par défaut
npm run dev               # http://localhost:5173
```

Les données sont alimentées par MSW (`src/mocks/`) et respectent le contrat `docs/API_CONTRACT.md` : ventes, stocks, stock insuffisant, tableau de bord, réapprovisionnement, etc.

## Passer au vrai backend

1. Démarrer le backend Django sur `http://127.0.0.1:8000`.
2. Dans `.env`, utiliser : `VITE_USE_MOCK=false` et `VITE_API_URL=/api`.
3. Lancer `npm run dev` ; le proxy Vite redirige `/api` vers le backend sans CORS.

Aucun écran ne dépend directement du backend : tout passe par `src/api/client.js`.

## Fonctionnalités du frontend

- Accueil / tableau de bord avec CA du jour, série 7 jours, top produits, stock et dernières ventes.
- Caisse avec recherche, panier persistant, raccourcis clavier et ticket d'impression.
- Gestion des produits : filtres, CRUD, stock bas, réapprovisionnement, suppression avec message métier.
- Historique des ventes et rapport journalier.
- Personnalisation boutique (nom, sigle, couleur principale, devise, message de ticket) via `src/config/boutique.js`.
- Thèmes clair / sombre / auto persistant en `localStorage`.

## Structure de `src/`

```text
src/
├── api/          client HTTP + endpoints + types JSDoc
├── components/   boutons, modales, tickets, layout, toasts, badges, pagination
├── config/       boutique.js + theme.js (personnalisation & thème)
├── context/      CartContext (panier global)
├── hooks/        queries React Query + invalidations
├── lib/          money.js, constants.js, useDebounce.js
├── mocks/        handlers MSW (mock contract-first)
├── pages/        Accueil, Caisse, Produits, Ventes, Rapport
└── index.css     variables CSS et thème visuel
```

## Commandes & raccourcis

- `npm run dev`
- `npm run build`
- `npm run preview`
- Caisse : `/caisse`, recherche avec `/`, Entrée ajoute le premier résultat, `Ctrl+Entrée` valide.
- Impression de ticket : `window.print()` avec mise en page 80 mm dans `src/index.css`.

## API & personnalisation

Le frontend attend actuellement les endpoints de `docs/API_CONTRACT.md`. La personnalisation boutique est déjà prête côté UI et sera branchée au backend avec `GET /api/boutique/` plus tard ; pour l’instant, les valeurs par défaut sont exposées dans `src/config/boutique.js`.
