# Contrat d'API — Gestion des ventes (frontend ↔ backend)

> Document de référence pour la dev backend (Django 5 + DRF). Base : `/api/`.
> Frontend : `VITE_API_URL` (défaut `/api`). Chaque ligne de ce contrat est implémentée dans `frontend/src/api/` et rejouée par les mocks MSW (`frontend/src/mocks/`).

## Conventions

- JSON, UTF-8, **slash final obligatoire** : `/api/produits/` (jamais `/api/produits`).
- Dates ISO 8601 : `date_vente: "2026-11-03T15:30:00+00:00"` ; filtre jour : `?date=YYYY-MM-DD`.
- **DecimalField sérialisés en chaînes** : `"15500.00"` (le frontend convertit et formate en FCFA).
- Pagination DRF : `{count, next, previous, results}`, `page_size = 10`, paramètre `?page=N`.
- Modes de paiement : `ESPECES` · `WAVE` · `ORANGE_MONEY` · `CARTE` (l'écran de caisse n'envoie que les 3 premiers).
- **Modes de vente (conditionnements)** — UN seul stock par produit, toujours en **unités de base**
  (`quantite`) ; chaque mode indique combien d'unités de base il contient (`facteur`, entier ≥ 2
  sauf le **Détail** : `facteur = 1`) et son propre prix (`prix_vente`). Phase 1 : **quantités
  entières** uniquement (aucune décimale, aucun demi-unité).
- **Alias acceptés en entrée** (anciens noms, pour rétro-compatibilité) : `prix_unitaire` → `prix`,
  `stock` → `quantite`, `seuil` → `seuil_alerte`, `montant_total` → `total`, `mode_paiement` →
  `moyen_paiement`. Côté front, la traduction vit UNIQUEMENT dans `frontend/src/api/adaptateur.js`.
- **Alias conservés en sortie** : `GET /ventes/` et `GET /ventes/{id}/` répondent encore
  `montant_total` + `mode_paiement` ; `POST /ventes/` répond `total` + `moyen_paiement`
  (les deux sont lus par l'adaptateur).

## Ressources

### `categories/`
- `GET /api/categories/` → paginé : `{id, nom, description}` (tri sur `nom`).
- `POST /api/categories/` — corps `{nom, description?}` → **201**.
- `GET` · `PUT /api/categories/{id}/` ; `DELETE` → **204**, **409** `{detail}` si catégorie utilisée (PROTECT).

### `produits/`

Objet produit (GET / POST / PUT / PATCH / réappro) :

```json
{"id": 10, "code": "COLA", "nom": "Boisson gazeuse 1,5 L",
 "categorie": 2, "categorie_nom": "Boissons",
 "unite_base": "bouteille", "prix_achat": "1083.33", "prix": "1500.00",
 "quantite": 30, "seuil_alerte": 9, "est_en_alerte": false,
 "conditionnements": [
   {"id": 1, "libelle": "Détail",     "facteur": 1,  "prix_vente": "1500.00",  "code": "",       "est_detail": true,  "actif": true, "ordre": 0},
   {"id": 2, "libelle": "Demi-carton","facteur": 6,  "prix_vente": "8000.00",  "code": "COLA6",  "est_detail": false, "actif": true, "ordre": 1},
   {"id": 3, "libelle": "Carton",     "facteur": 12, "prix_vente": "15000.00", "code": "COLA12", "est_detail": false, "actif": true, "ordre": 2}]}
```

- `GET /api/produits/?search=&categorie=<id>&stock_bas=true&page=` → paginé ; `search` cible
  `code` + `nom` ; `stock_bas=true` ⇔ `quantite <= seuil_alerte` ; tri sur `nom`.
- **Mode Détail obligatoire** : exactement un mode `est_detail = true`, `facteur = 1`, sans `code`.
  Un produit créé dans l'ancien format (sans `conditionnements`) reçoit un Détail dérivé de `prix`.
- `POST` — corps `{code, nom, categorie, prix, quantite?, seuil_alerte?, unite_base?, prix_achat?,
  conditionnements?}` → **201** (`quantite`/`seuil_alerte` optionnels, défaut `0`) ;
  doublon → **400** `{"code": ["produit avec ce code existe déjà."]}`.
- `PUT /produits/{id}/` — remplacement complet, y compris `conditionnements` (liste ordonnée ;
  `ordre` = index dans la liste). **Le Détail est toujours réécrit** : son `prix_vente` suit `prix`.
- `PATCH /produits/{id}/` — partiel (édition rapide) ; **refuse** `conditionnements`
  → **400** `{"conditionnements": ["Utilisez PUT pour remplacer la liste des modes de vente."]}`.
- `DELETE` → **204**, **409** `{detail}` si le produit figure dans des ventes (PROTECT).
- **Codes des modes** : `code` optionnel (sans espaces, MAJUSCULES), unique sur **tous** les
  produits du catalogue — un code déjà pris (produit ou autre mode) → **400**
  `{"conditionnements": ["…"]}`.
- `POST /api/produits/{id}/reapprovisionner/` — corps `{"quantite": 12, "conditionnement": 3?}`
  (entier **> 0**) → **200** produit à jour :
  - `conditionnement` **absent ou `null`** → `quantite += quantite` (unités de base) ;
  - `conditionnement` fourni → `quantite += quantite × facteur` du mode (ex. `2` cartons = +24) ;
  - mode étranger au produit ou `actif = false` → **400**
    `{"code": "conditionnement_invalide", "detail": "…", "produit": 10, "conditionnement": 99}` ;
  - `quantite` absente, **≤ 0** ou non entière → **400**
    `{"quantite": ["Entier strictement positif attendu."]}` ;
  - produit inconnu → **404** `{"detail": "Non trouvé."}` ; opération **atomique** côté serveur.

### `ventes/`
- `GET /api/ventes/?date=YYYY-MM-DD&date_debut=&date_fin=&produit=<id>&mode_paiement=&search=&page=`
  → paginé, **sans lignes** : `{id, date_vente, client_nom, mode_paiement, montant_total}` (tri `-date_vente`).
- `POST /api/ventes/` — corps :

```json
{"mode_paiement": "ESPECES", "client_nom": "Fatou Ndiaye",
 "lignes": [{"produit": 10, "conditionnement": 3, "quantite": 2},
            {"produit": 8,  "conditionnement": null, "quantite": 3}]}
```

  → **201** :

```json
{"id": 188, "date_vente": "2026-11-12T12:00:00+00:00", "client_nom": "Fatou Ndiaye",
 "total": "30000.00", "moyen_paiement": "ESPECES",
 "lignes": [{"id": 421, "vente": 188, "produit": 10, "produit_nom": "Boisson gazeuse 1,5 L",
   "produit_code": "COLA", "conditionnement": 3, "libelle": "Carton", "facteur": 12,
   "est_detail": false, "prix_unitaire": "15000.00", "quantite": 2, "quantite_base": 24,
   "cout_unitaire_base": "1083.33", "total_ligne": "30000.00", "montant_ligne": "30000.00"}],
 "produits_mis_a_jour": [{"id": 10, "quantite": 6}]}
```

  - **`conditionnement`** : id du mode ; **absent / `null` = Détail**. Un id de mode inactif ou
    étranger au produit → **400** `conditionnement_invalide` (voir plus bas).
  - **Snapshot figé** à la création : `libelle`, `facteur`, `est_detail`, `prix_unitaire`,
    `cout_unitaire_base`, `total_ligne` ne changent plus si le produit évolue ensuite
    (les lignes d'historique sans snapshot se lisent en « Détail », `facteur = 1`).
  - **Aucune écriture avant le contrôle** : toutes les lignes sont résolues, le besoin total en
    unités de base est cumulé par produit, puis le stock est vérifié **une fois** ;
    insuffisance → **409** et **zéro** décrément, **zéro** ligne créée.
  - Décrément en unités de base (`quantite × facteur`), réponse `produits_mis_a_jour` =
    `[{id, quantite}]` (nouveau stock) — le front l'applique aux paniers en attente.
  - `montant_total` / `mode_paiement` ne sont **pas** renvoyés sur POST (voir conventions).
- `GET /api/ventes/{id}/` → détail **avec** `lignes` (mêmes snapshots) ; inconnue → **404** `{detail}`.

### `rapports/jour/`
- `GET /api/rapports/jour/?date=YYYY-MM-DD` → :
  `{date, ca_total "…", nb_ventes, panier_moyen "…",
    encaissements_par_mode: [{mode_paiement, total, nb_ventes}],   // du jour, trié -total
    ca_par_categorie: [{categorie, ca}],                           // Σ total_ligne (prix × mode), du jour
    top_produits: [{produit, code, nom, qte}],                     // max 3, qte EN UNITÉS DE BASE
    produits_a_racheter: [{produit, code, nom, stock, seuil_alerte, en_rupture}]}`
  — agrégats **du jour**, sauf `produits_a_racheter` = état **instantané** des stocks
  (`quantite <= seuil_alerte`, `stock` en unités de base).
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
  - `top_produits_semaine` = **unités de base** vendues sur **la même fenêtre de 7 jours**
    (une vente de 2 cartons ×12 compte pour 24), triées décroissant, **max 5**.
  - `stock` = état **instantané** : `nb_produits` = produits au catalogue ;
    `nb_en_alerte` = produits avec `est_en_alerte` (**ruptures incluses**), `nb_en_rupture` = `quantite === 0`
    (sous-ensemble) ; `valeur_stock` = Σ `prix × quantite` = **prix de vente (Détail) × stock en
    unités de base** (chaîne décimale).
  - `dernieres_ventes` = **5 dernières ventes globales** (tri `-date_vente`),
    **indépendantes du paramètre `date`**, forme exacte ci-dessus (**sans** `client_nom`).
  - montants (`ca`, `panier_moyen`, `valeur_stock`, `montant_total`) en **chaînes décimales** ;
    `nb_ventes`, `qte`, `stock`, `seuil_alerte` et compteurs en **entiers**.
  - date absente → aujourd'hui (Dakar) ; date au format invalide → **400**
    `{"date": ["Format attendu : AAAA-MM-JJ."]}` (même forme que `rapports/jour/`).

## Erreurs

- Validation **400** : object à clé champ, valeurs tableaux — `{"champ": ["message", …]}` (forme DRF).
- Stock insuffisant **409** (cumulé sur TOUTES les lignes, en unités de base) :

```json
{"code": "stock_insuffisant",
 "detail": "Stock insuffisant pour Boisson gazeuse 1,5 L (disponible : 6, demandé : 36 unités).",
 "produit": 10, "demande_base": 36, "disponible_base": 6}
```

- Mode de vente invalide **400** :

```json
{"code": "conditionnement_invalide",
 "detail": "Mode de vente invalide pour Boisson gazeuse 1,5 L.",
 "produit": 10, "conditionnement": 99}
```

- Non trouvé **404** : `{"detail": "…"}` ; conflit PROTECT **409** : `{"detail": "…"}`.

## Checklist d'intégration (avant de brancher le vrai backend)

- [ ] **CORS** : origine du front (`http://localhost:5173`) autorisée — ou s'appuyer sur le proxy Vite `/api → :8000` (déjà configuré dans `frontend/vite.config.js`).
- [ ] **Slash final** sur toutes les routes DRF (`/api/produits/`, jamais `/api/produits`).
- [ ] **`page_size = 10`** configuré sur la pagination (le front suppose cette taille).
- [ ] **DecimalField en chaînes** : `prix`, `prix_vente`, `prix_achat`, `montant_total`, `total`, `ca_total`, `panier_moyen`, `ca`, `valeur_stock`, `total_ligne` → `"15500.00"` (normalisés côté front par `src/lib/money.js`).
- [ ] **Unités de base** : `quantite`, `stock`, `seuil_alerte`, `quantite_base`, `demande_base`, `disponible_base` en **entiers** ; `facteur` entier ≥ 1 ; un seul Détail (`facteur = 1`) par produit.
- [ ] **Erreurs** : 400 = `{champ: ["message"]}` ; 409 `stock_insuffisant` = `{code, detail, produit, demande_base, disponible_base}` ; 400 `conditionnement_invalide` = `{code, detail, produit, conditionnement}` ; 404/PROTECT = `{detail}`.
- [ ] **Atomicité des ventes** : résolution → cumul des besoins → contrôle unique → écriture (aucune écriture avant contrôle).
- [ ] **Dates** : `date_vente` en ISO 8601 ; filtres `?date=YYYY-MM-DD` sur `ventes/`, `rapports/jour/` et `rapports/tableau-de-bord/` (défaut = aujourd'hui, fuseau Africa/Dakar).
- [ ] **Enum modes** : `ESPECES | WAVE | ORANGE_MONEY | CARTE` (majuscules, sensibles à la casse).
- [ ] **Authentification (plus tard)** : header ajouté uniquement dans `src/api/client.js` — aucun écran à modifier.
