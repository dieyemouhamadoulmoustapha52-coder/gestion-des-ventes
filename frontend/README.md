# Frontend — Gestion des ventes (React 19 + Vite 6)

## Lancer en mode mock (aucun backend requis)

```bash
cd frontend
npm install
cp .env.example .env      # VITE_USE_MOCK=true par défaut
npm run dev               # → http://localhost:5173
```

Les données viennent des mocks MSW (`src/mocks/`), fidèles à `docs/API_CONTRACT.md` :
ventes simulées, stocks qui baissent, vraie erreur `stock_insuffisant`.

## Passer au vrai backend

1. Backend Django démarré sur `http://127.0.0.1:8000` (contrat : `docs/API_CONTRACT.md`).
2. Dans `.env` : `VITE_USE_MOCK=false` (et `VITE_API_URL=/api`).
3. `npm run dev` — le proxy de `vite.config.js` redirige `/api` vers `:8000` (pas de CORS en dev).

**Aucune ligne des écrans ne change** : tout passe par `src/api/client.js`.

## Structure de `src/`

```
src/
├── api/          client fetch (ApiError, timeout15 s) + un module par ressource + types JSDoc
├── mocks/        handlers MSW (uniquement si VITE_USE_MOCK=true)
├── components/   Button, Modal, Drawer, Badge, Skeleton, EmptyState, ErrorState,
│                 Toast, Layout, Ticket, Pagination, ConfirmDialog…
├── context/      CartContext — panier en useReducer, survit à la navigation
├── hooks/        hooks React Query (listes filtrées, mutations + invalidations)
├── lib/          money.js (FCFA / Intl), constants.js, useDebounce.js
└── pages/        Caisse, Produits, Ventes, Rapport (routes lazy)
```

## Commandes & raccourcis

- `npm run dev` · `npm run build` (JS initial ≈ 97 Ko gzip) · `npm run preview`
- **Caisse** : `/` recherche · `Entrée` ajoute le 1ᵉʳ résultat · `Ctrl+Entrée` valide
- **Ticket** : impression `window.print()` en80 mm (`@media print` dans `src/index.css`)
