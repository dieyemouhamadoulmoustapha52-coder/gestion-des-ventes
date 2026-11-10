# Contrat d'API — Gestion des ventes (frontend ↔ backend)

> Document de référence pour la dev backend (Django 5 + DRF). Base : `/api/`.
> Frontend : `VITE_API_URL` (défaut `/api`). Chaque ligne de ce contrat est implémentée dans `frontend/src/api/` et rejouée par les mocks MSW.

## Conventions

- JSON, UTF-8, **slash final obligatoire** : `/api/produits/` (jamais `/api/produits`).
- Dates ISO 8601 : `date_vente: "2026-11-03T15:30:00+00:00"` ; filtre jour : `?date=YYYY-MM-DD`.
- **DecimalField sérialisés en chaînes** : `"15500.00"` (le frontend convertit et formate en FCFA).
- Pagination DRF : `{count, next, previous, results}`, `page_size = 10`, paramètre `?page=N`.
- Modes de paiement : `ESPECES` · `WAVE` · `ORANGE_MONEY` · `CARTE` (l'écran de caisse n'envoie que les 3 premiers).

## Ressources

### `categories/`
- `GET /api/categories/` → paginé : `{id, nom, description}` (tri sur `nom`).
- `POST /api/categories/` — corps `{nom, description?}` → **201**.
- `GET` · `PUT /api/categories/{id}/` ; `DELETE` → **204**, **409** `{detail}` si catégorie utilisée (PROTECT).

### `produits/`
- `GET /api/produits/?search=&categorie=<id>&stock_bas=true&page=` → paginé, objet :
  `{id, code, nom, categorie (id), categorie_nom, prix_unitaire "6200.00", stock, seuil_alerte, est_en_alerte}`
  — `search` cible `code` + `nom` ; `stock_bas=true` ⇔ `stock <= seuil_alerte` ; tri sur `nom`.
- `POST` — corps `{code, nom, categorie, prix_unitaire, stock, seuil_alerte}` → **201**
  (`stock`/`seuil_alerte` optionnels, défaut `0`) ; doublon → **400** `{"code": ["produit avec ce code existe déjà."]}`.
- `GET` · `PATCH` (partiel, édition) · `PUT` · `DELETE produits/{id}/`
  → DELETE **204**, **409** `{detail}` si le produit figure dans des ventes (PROTECT).
- `POST /api/produits/{id}/reapprovisionner/` — **réapprovisionnement** : corps `{"quantite": 12}`
  (entier **> 0**, chaînes numériques acceptées — DRF les convertit) → **200** produit à jour
  (même forme que `GET /api/produits/{id}/`, `stock` et `est_en_alerte` recalculés) :
  - `quantite` absente, **≤ 0** ou non entière → **400** `{"quantite": ["Entier strictement positif attendu."]}` ;
  - produit inconnu → **404** `{"detail": "Non trouvé."}` ;
  - opération **atomique** côté serveur : `stock += quantite` en une seule écriture
    (pas de lecture-modification-écriture concurrente), aucun autre champ touché.

### `ventes/`
- `GET /api/ventes/?date=YYYY-MM-DD&mode_paiement=ESPECES&page=` → paginé, **sans lignes** (léger) :
  `{id, date_vente, client_nom, mode_paiement, montant_total "15500.00"}` (tri `-date_vente`).
- `POST /api/ventes/` — corps `{mode_paiement, lignes: [{produit, quantite}]}`, `client_nom` optionnel (défaut `""`)
  → **201** vente complète :
  `{id, date_vente, client_nom, mode_paiement, montant_total, lignes: [{id, produit, produit_nom, produit_code, quantite, prix_unitaire, montant_ligne}]}`
  — le serveur **fige** `prix_unitaire`, **décrémente** `stock` (service `creer_vente`, tout-ou-rien).
- `GET /api/ventes/{id}/` → détail **avec** `lignes` ; inconnue → **404** `{detail}`.

### `rapports/jour/`
- `GET /api/rapports/jour/?date=YYYY-MM-DD` → :
  `{date, ca_total "…", nb_ventes, panier_moyen "…",
    encaissements_par_mode: [{mode_paiement, total, nb_ventes}],   // du jour, trié -total
    ca_par_categorie: [{categorie, ca}],                           // nom de catégorie, du jour
    top_produits: [{produit, code, nom, qte}],                     // max 3, quantités du jour
    produits_a_racheter: [{produit, code, nom, stock, seuil_alerte, en_rupture}]}`
  — agrégats **du jour**, sauf `produits_a_racheter` = état **instantané** des stocks (`stock <= seuil_alerte`).
  - date absente/invalide → **400** `{"date": ["Format attendu : AAAA-MM-JJ."]}`.

### `rapports/tableau-de-bord/`
- `GET /api/rapports/tableau-de-bord/?date=YYYY-MM-DD` — **date optionnelle** (défaut : aujourd'hui,
  fuseau **Africa/Dakar**) → un seul objet complet :

```json
{"date": "2026-11-04",
 "aujourdhui": {"ca": "23400.00", "nb_ventes": 7, "panier_moyen": "3342.86"},
 "hier":       {"ca": "16700.00", "nb_ventes": 5},
 "serie_7_jours": [
   {"date": "2026-10-29", "ca": "8100.00",  "nb_ventes": 3},
   {"date": "2026-10-30", "ca": "12400.00", "nb_ventes": 4},
   {"date": "2026-10-31", "ca": "9650.00",  "nb_ventes": 3},
   {"date": "2026-11-01", "ca": "5200.00",  "nb_ventes": 2},
   {"date": "2026-11-02", "ca": "14300.00", "nb_ventes": 5},
   {"date": "2026-11-03", "ca": "16700.00", "nb_ventes": 5},
   {"date": "2026-11-04", "ca": "23400.00", "nb_ventes": 7}],
 "top_produits_semaine": [{"produit": 7, "code": "EAU15", "nom": "Eau minérale 1,5 L", "qte": 42}],
 "stock": {"nb_produits": 9, "nb_en_alerte": 3, "nb_en_rupture": 1, "valeur_stock": "244800.00"},
 "dernieres_ventes": [{"id": 187, "date_vente": "2026-11-04T14:32:00+00:00",
                       "montant_total": "4550.00", "mode_paiement": "WAVE"}]}
```

  - `aujourdhui` = agrégats du jour `date` ; `hier` = jour `date − 1` (pas de `panier_moyen`).
  - `serie_7_jours` = **7 jours glissants** chronologiques finissant à `date`
    (`aujourdhui` = entrée `[6]`, `hier` = entrée `[5]`) ; jour sans vente → `{"ca": "0.00", "nb_ventes": 0}`.
  - `top_produits_semaine` = quantités vendues sur **la même fenêtre de 7 jours**,
    triées décroissant, **max 5** : `{produit, code, nom, qte}`.
  - `stock` = état **instantané** : `nb_produits` = produits au catalogue ;
    `nb_en_alerte` = produits avec `est_en_alerte` (**ruptures incluses**), `nb_en_rupture` = `stock === 0`
    (sous-ensemble) ; `valeur_stock` = Σ `prix_unitaire × stock` (chaîne décimale).
  - `dernieres_ventes` = **5 dernières ventes globales** (tri `-date_vente`),
    **indépendantes du paramètre `date`**, forme exacte ci-dessus (**sans** `client_nom`).
  - montants (`ca`, `panier_moyen`, `valeur_stock`, `montant_total`) en **chaînes décimales** ;
    `nb_ventes`, `qte` et compteurs en entiers.
  - date absente → aujourd'hui (Dakar) ; date au format invalide → **400**
    `{"date": ["Format attendu : AAAA-MM-JJ."]}` (même forme que `rapports/jour/`).

## Erreurs

- Validation **400** : object à clé champ, valeurs tableaux — `{"champ": ["message", …]}` (forme DRF).
- Stock insuffisant **409** :

```json
{"code": "stock_insuffisant",
 "detail": "Stock insuffisant pour Riz parfumé 25 kg (disponible : 2, demandé : 5).",
 "produit": 1, "stock_disponible": 2}
```

- Non trouvé **404** : `{"detail": "…"}` ; conflit PROTECT **409** : `{"detail": "…"}`.

## Checklist d'intégration (avant de brancher le vrai backend)

- [ ] **CORS** : origine du front (`http://localhost:5173`) autorisée — ou s'appuyer sur le proxy Vite `/api → :8000` (déjà configuré dans `frontend/vite.config.js`).
- [ ] **Slash final** sur toutes les routes DRF (`/api/produits/`, jamais `/api/produits`).
- [ ] **`page_size = 10`** configuré sur la pagination (le front suppose cette taille).
- [ ] **DecimalField en chaînes** : `prix_unitaire`, `montant_total`, `ca_total`, `panier_moyen`, `total`, `ca`, `valeur_stock` → `"15500.00"` (normalisés côté front par `src/lib/money.js`).
- [ ] **Erreurs** : 400 = `{champ: ["message"]}` ; 409 `stock_insuffisant` = `{code, detail, produit, stock_disponible}` ; 404/PROTECT = `{detail}`.
- [ ] **Dates** : `date_vente` en ISO 8601 ; filtres `?date=YYYY-MM-DD` sur `ventes/`, `rapports/jour/` et `rapports/tableau-de-bord/` (défaut = aujourd'hui, fuseau Africa/Dakar).
- [ ] **Enum modes** : `ESPECES | WAVE | ORANGE_MONEY | CARTE` (majuscules, sensibles à la casse).
- [ ] **Authentification (plus tard)** : header ajouté uniquement dans `src/api/client.js` — aucun écran à modifier.
