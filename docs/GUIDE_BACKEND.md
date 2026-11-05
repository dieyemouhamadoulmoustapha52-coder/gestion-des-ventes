# Guide backend — Construire l'API conforme au contrat

> **Destiné à** : la developpeuse backend (`bineta-Kane`)
> **Objectif** : livrer une API Django + DRF qui respecte **exactement** [`API_CONTRACT.md`](./API_CONTRACT.md), pour que le frontend se branche **sans aucune modification de code**.
> **Règle d'or** : le contrat fait foi. Si un doute, on lit le contrat — on ne l'invente pas.

---

## 1. Pourquoi ce document ?

Le frontend est **terminé** et tourne en mode démo (mocks MSW). Chaque écran appelle déjà les endpoints du contrat via `frontend/src/api/`.

Si ton API renvoie la **bonne route**, le **bon format de données** et les **bons codes HTTP**, le front bascule sur ton backend en changeant **2 lignes** de configuration (`.env`) — zéro changement dans les écrans.

```bash
# frontend/.env — seul fichier à toucher au branchement
VITE_USE_MOCK=false    # true = démo · false = vrai backend
VITE_API_URL=/api
```

---

## 2. Stack attendue

| Élément | Choix imposé |
|---|---|
| Framework | Django ≥ 5.1 + Django REST Framework ≥ 3.15 |
| SGBD | MySQL 8 (InnoDB, utf8mb4) |
| Config | `django-environ` via `backend/.env` (modèle : `backend/.env.example`) |
| Serveur dev | `python manage.py runserver` → `http://127.0.0.1:8000` |
| Base URL API | `/api/` |
| Code métier | services transactionnels dans `backend/services/` |

Déjà prévu dans `backend/requirements.txt` — rien à ajouter pour le MVP.

---

## 3. Démarrage (une seule fois)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Projet Django (si pas encore fait)
django-admin startproject config .
python manage.py startapp commerce

# Configuration
cp .env.example .env
# → renseigner DB_NAME, DB_USER, DB_PASSWORD (MySQL local démarré)

python manage.py migrate
python manage.py runserver
```

Vérification rapide :

```bash
curl http://127.0.0.1:8000/api/categories/ -H "Accept: application/json"
# doit renvoyer : {"count": …, "next": …, "previous": …, "results": […]}
```

---

## 4. Les 10 règles non négociables

Ces points font **échouer** l'intégration s'ils sont faux. Relis-les avant chaque PR.

| # | Règle | Mauvais ✗ | Bon ✓ |
|---|---|---|---|
| 1 | **Slash final** sur toutes les routes | `/api/produits` | `/api/produits/` |
| 2 | **Pagination** | format libre | `{count, next, previous, results}` + `page_size = 10` |
| 3 | **Décimaux en chaînes** | `15500` ou `15500.0` | `"15500.00"` |
| 4 | **Dates en ISO 8601** | `03/11/2026 15:30` | `"2026-11-03T15:30:00+00:00"` |
| 5 | **Filtre jour** | paramètre libre | `?date=YYYY-MM-DD` |
| 6 | **Enum modes** | `especes` / `Espèces` | `ESPECES`, `WAVE`, `ORANGE_MONEY`, `CARTE` |
| 7 | **Erreur validation** | `{"detail": "…"}` | `{"prix_unitaire": ["Ce champ est requis."]}` |
| 8 | **Erreur stock** | `400` générique | `409` + `{code: "stock_insuffisant", detail, produit, stock_disponible}` |
| 9 | **Erreur PROTECT** | `404` ou `500` | `409` + `{detail: "…"}` |
| 10 | **Fuseau** | UTC partout | `TIME_ZONE = "Africa/Dakar"` (filètres rapports = aujourd'hui à Dakar) |

---

## 5. Périmètre des endpoints

```
/api/
├── categories/                          GET POST
│   └── {id}/                            GET PUT DELETE
├── produits/                            GET POST  (?search &categorie stock_bas page)
│   └── {id}/                            GET PATCH PUT DELETE
│   └── {id}/reapprovisionner/           POST   ← action, pas CRUD
├── ventes/                              GET POST  (?date mode_paiement page)
│   └── {id}/                            GET     ← détail AVEC lignes
└── rapports/
    ├── jour/?date=YYYY-MM-DD            GET
    └── tableau-de-bord/?date=YYYY-MM-DD GET     ← un SEUL objet complet
```

**Ce qui n'existe pas** (hors périmètre MVP) : TVA, remises, tiers, mouvements de stock, auth (pour l'instant).

---

## 6. Modèles & base de données

Utilise la modélisation complète de [`modelisation_base_de_donnees.md`](../modelisation_base_de_donnees.md) :

- **4 tables** : `categorie`, `produit`, `vente`, `ligne_vente`
- **DDL MySQL** section 2 · **`models.py`** section 3 · **requêtes ORM de reporting** section 5
- `est_en_alerte` = **propriété dérivée** (`stock <= seuil_alerte`), **jamais** un champ stocké
- `prix_unitaire` dans `ligne_vente` = **copie figée** au moment de la vente
- Suppressions : `PROTECT` catégorie/produit · `CASCADE` vente → lignes

---

## 7. Logique métier critique

### 7.1 `POST /api/ventes/` — service `creer_vente`

C'est le **cœur** du backend. Tout dans une transaction :

```
@transaction.atomic
1. Valider corps : mode_paiement (enum), lignes non vides, quantite > 0
2. Pour chaque ligne :
   a. Charger le produit (select_for_update si souhaité)
   b. Si stock < quantite → lever ValidationError code=stock_insuffisant (409)
   c. Figé prix_unitaire = produit.prix_unitaire
   d. Décrémenter : produit.stock = F('stock') - quantite   ← atomique
3. Créer vente + lignes, calculer montant_total = Σ (quantite × prix_unitaire figé)
4. Retourner 201 avec la vente COMPLETE (en-tête + lignes)
```

**Erreurs attendues** :

| Cas | Code | Corps |
|---|---|---|
| Stock insuffisant | **409** | `{"code": "stock_insuffisant", "detail": "Stock insuffisant pour … (disponible : 2, demandé : 5).", "produit": 1, "stock_disponible": 2}` |
| Corps invalide | **400** | `{"lignes": ["Ce champ est requis."]}` (forme DRF) |

### 7.2 `POST /api/produits/{id}/reapprovisionner/`

```
quantite absente / ≤ 0 / non entière → 400 {"quantite": ["Entier strictement positif attendu."]}
produit inconnu                      → 404 {"detail": "Non trouvé."}
sinon                                → 200, stock += quantite EN UNE ÉCRITURE (F() ou UPDATE SQL)
```

Pas de lecture-modification-écriture non atomique.

### 7.3 Rapports

| Endpoint | Règles clés |
|---|---|
| `rapports/jour/` | Agrégats **du jour `date`** uniquement · `produits_a_racheter` = état **instantané** des stocks · date invalide → **400** |
| `rapports/tableau-de-bord/` | **1 seul appel** renvoie tout · `serie_7_jours` = 7 jours **glissants** chronologiques (jour sans vente = `{"ca":"0.00","nb_ventes":0}`) · `dernieres_ventes` = 5 dernières **globales**, indépendantes de `date`, **sans** `client_nom` · date absente = aujourd'hui (Dakar) |

---

## 8. Sérialisation DRF — pièges fréquents

```python
# settings.py
REST_FRAMEWORK = {
    "PAGE_SIZE": 10,                          # ← le front suppose 10
    "DEFAULT_PAGINATION_CLASS":
        "rest_framework.pagination.PageNumberPagination",
}

# Chaque DecimalField DOIT sortir en chaîne "1234.56"
# → serializer : serializers.DecimalField(max_digits=12, decimal_places=2)
#   DRF renvoie déjà "15500.00" (str) — ne pas caster en float/int !

# dates : serializers.DateTimeField → ISO 8601 par défaut (OK)
# pour les filtres : ?date=YYYY-MM-DD → parser propre, erreur → 400
#   {"date": ["Format attendu : AAAA-MM-JJ."]}
```

**Route sans slash** : en DRF, si tu montes `router.register('produits', …)`, l'URL générée a le slash. Ne jamais appeler `/api/produits` côté client — le front envoie toujours le slash.

---

## 9. Erreurs — format exact attendu par le front

Le client (`frontend/src/api/client.js`) normalise **3 formats** uniquement :

```jsonc
// 400 validation (forme DRF standard)
{"prix_unitaire": ["Ce champ est requis."], "code": ["produit avec ce code existe déjà."]}

// 409 métier stock
{"code": "stock_insuffisant",
 "detail": "Stock insuffisant pour Riz parfumé 25 kg (disponible : 2, demandé : 5).",
 "produit": 1, "stock_disponible": 2}

// 404 / 409 PROTECT
{"detail": "Non trouvé."}
{"detail": "Impossible de supprimer : catégorie liée à des produits."}
```

Tout autre format → message générique « Erreur HTTP … » côté UI (pas d'effet crash, mais UX dégradée).

---

## 10. Plan de travail suggéré (ordre)

| Étape | Livrable | Vérif |
|---|---|---|
| 1 | Projet Django + settings MySQL + `.env` | `migrate` OK |
| 2 | `models.py` (4 tables) + migrations | `python manage.py shell` |
| 3 | Sérialiseurs + vues `categories/` (CRUD complet) | curl GET/POST/DELETE |
| 4 | `produits/` (filtres `search`, `categorie`, `stock_bas`) | curl avec query params |
| 5 | `reapprovisionner/` atomique | test quantite=0 → 400 |
| 6 | `ventes/` GET (sans lignes) + GET détail | pagination page_size=10 |
| 7 | **Service `creer_vente`** + POST | test stock insuffisant → 409 |
| 8 | `rapports/jour/` | curl `?date=` + date invalide |
| 9 | `rapports/tableau-de-bord/` | objet unique complet |
| 10 | Checklist ci-dessous + PR `feat/backend-api` | tous les points ✓ |

**Convention Git** : branche `feat/backend-…` → PR vers `main` · Conventional Commits · jamais de commit direct sur `main`.

---

## 11. Points d'attention partagés

1. **Proxy Vite** : en dev, le front appelle `/api/…` → proxy vers `:8000`. Tu n'as **pas** à configurer CORS tant qu'on reste en dev local. (Si tu veux quand même : origine `http://localhost:5173`.)
2. **Auth** : plus tard uniquement — le front ajoutera le header **uniquement** dans `client.js`. Ne rien prévoir dans les écrans.
3. **Doute sur le format** : ouvre `frontend/src/mocks/handlers.js` — c'est la **référence exécutable** du contrat (30+ scénarios rejoués par les tests de contrat).
4. **Tests** : ajoute des tests DRF sur `creer_vente` (succès, stock insuffisant, quantité 0) et sur la pagination.

---

## 12. Contact & docs

| Document | Usage |
|---|---|
| [`API_CONTRACT.md`](./API_CONTRACT.md) | **La loi** — chaque endpoint, chaque champ |
| [`modelisation_base_de_donnees.md`](../modelisation_base_de_donnees.md) | DDL, `models.py`, requêtes ORM prêtes à l'emploi |
| [`CHECKLIST_INTEGRATION.md`](./CHECKLIST_INTEGRATION.md) | Liste de vérification avant branchement |
| `frontend/src/mocks/handlers.js` | Exemples de réponses attendues |
| `frontend/src/api/*.js` | Ce que le front envoie exactement |

Une question ou un écart détecté dans le contrat ? **Ouvre une issue GitHub** avant d'implémenter une variante — on ajuste le contrat ensemble, puis les deux côtés.
