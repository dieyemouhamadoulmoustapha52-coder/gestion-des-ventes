# Checklist d'intégration — Brancher le vrai backend au frontend

> **Quand l'utiliser** : dès que l'API Django est prête, avant de dire « c'est branché ».
> **Principe** : le frontend **ne doit subir aucune modification de code**. Si une modif est nécessaire, c'est le contrat qui doit évoluer (ou le backend qui doit se corriger).

---

## Comment ça fonctionne en réalité

### Le schéma complet

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│   FRONTEND (React)      │         │   BACKEND (Django + DRF)     │
│                         │         │                              │
│  pages/  ← affichage    │         │  views/    ← logique HTTP    │
│    ↓                    │         │    ↓                        │
│  hooks/  ← React Query  │         │  serializers/ ← format JSON  │
│    ↓                    │         │    ↓                        │
│  api/*.js ← endpoints   │         │  services/ ← métier (atomic) │
│    ↓                    │         │    ↓                        │
│  client.js ← fetch      │         │  models.py ← MySQL          │
│    ↓                    │         │                              │
│  VITE_API_URL=/api      │         │  127.0.0.1:8000              │
└───────────┬─────────────┘         └──────────────┬───────────────┘
            │                                      │
            │   En développement :                 │
            │   navigateur ──► Vite (:5173)        │
            │                 proxy /api ──────────┼──► Django (:8000)
            │                                      │
            │   Pas de CORS à gérer (le proxy      │
            │   fait la translation d'origine).    │
            └──────────────────────────────────────┘
```

### Les 3 modes de fonctionnement

| Mode | `VITE_USE_MOCK` | Source de données | Usage |
|---|---|---|---|
| **Démo** | `true` | Mocks MSW (`src/mocks/`) | Dev frontend seule, démos, tests UI |
| **Intégration** | `false` | Vrai Django via proxy | **Tu es ici** — validation du contrat |
| **Production** | `false` | Django servi (Gunicorn/nginx) | Déploiement final |

### Le flux d'une requête (exemple : créer une vente)

```
1. Utilisateur clique « Valider » sur /caisse
2. Caisse.jsx appelle useCreerVente()  (hooks/queries.js)
3. hooks/queries.js appelle creerVente(body)  (api/ventes.js)
4. creerVente appelle request('ventes/', {method:'POST', body})  (api/client.js)
5. client.js fait fetch('/api/ventes/', …)
6. Vite proxy redirige ──► http://127.0.0.1:8000/api/ventes/
7. DRF : serializer valide → service creer_vente (@transaction.atomic)
8. Si stock OK : 201 + JSON vente complète
   Si stock KO : 409 + {"code":"stock_insuffisant", …}
9. client.js normalise l'erreur (ApiError) OU retourne le payload
10. React Query met en cache + invalidation → l'UI se rafraîchit
11. Toast succès + ticket affiché
```

**Point clé** : si l'étape 7–8 renvoie le **bon format**, tout le reste marche sans modification.

---

## A. Côté backend (à faire par la developpeuse backend)

### A1. Configuration serveur

- [ ] `python manage.py runserver` démarre sans erreur
- [ ] MySQL 8 démarré, base `gestion_ventes` créée, `migrate` OK
- [ ] `.env` renseigné (modèle : `backend/.env.example`)
- [ ] `TIME_ZONE = "Africa/Dakar"` · `USE_TZ = True`
- [ ] `REST_FRAMEWORK["PAGE_SIZE"] = 10`
- [ ] Routes montées sous le préfixe `/api/` (ex. `path('api/', include(router.urls))`)
- [ ] **Slash final** présent sur toutes les routes DRF

### A2. Conformité contrat — endpoints

Teste chaque ligne avec `curl` ou navigateur :

- [ ] `GET /api/categories/` → paginé `{count,next,previous,results}`, tri `nom`
- [ ] `POST /api/categories/` → **201** · doublon nom → **400** `{nom: […]}`
- [ ] `PUT/DELETE /api/categories/{id}/` → **204** · catégorie utilisée → **409** `{detail}`
- [ ] `GET /api/produits/?search=&categorie=&stock_bas=true&page=` → filtres OK, objet avec `categorie_nom` + `est_en_alerte`
- [ ] `POST /api/produits/` → **201** · code doublon → **400** `{code: […]}`
- [ ] `PATCH /api/produits/{id}/` → mise à jour partielle OK
- [ ] `DELETE /api/produits/{id}/` → **204** · produit en vente → **409** `{detail}`
- [ ] `POST /api/produits/{id}/reapprovisionner/` :
  - [ ] `{"quantite": 12}` → **200**, stock augmenté
  - [ ] `{"quantite": 0}` ou absent → **400** `{quantite: ["Entier strictement positif attendu."]}`
  - [ ] id inexistant → **404** `{detail}`
- [ ] `GET /api/ventes/` → liste **sans** `lignes`, tri `-date_vente`, filtres `?date=` `?mode_paiement=`
- [ ] `POST /api/ventes/` → **201** vente complète **avec** `lignes`
- [ ] `GET /api/ventes/{id}/` → détail **avec** `lignes` · inconnu → **404**
- [ ] `GET /api/rapports/jour/?date=` → agrégats du jour + `produits_a_racheter`
- [ ] `GET /api/rapports/tableau-de-bord/` → **un seul objet** complet (voir JSON du contrat)

### A3. Formats de données

- [ ] Tous les `DecimalField` sortent en **chaîne** `"15500.00"` (pas `15500`, pas `15500.0`)
- [ ] `date_vente` en ISO 8601 : `"2026-11-03T15:30:00+00:00"`
- [ ] Pagination : `{count, next, previous, results}` avec `page_size = 10`
- [ ] Enum modes : exactement `ESPECES` / `WAVE` / `ORANGE_MONEY` / `CARTE`
- [ ] `est_en_alerte` recalculé à chaque lecture (`stock <= seuil_alerte`), jamais stocké
- [ ] `montant_total` figé à la création de la vente

### A4. Erreurs

- [ ] Validation → **400** `{"champ": ["message", …]}` (forme DRF)
- [ ] Stock insuffisant → **409** `{"code": "stock_insuffisant", "detail": "…", "produit": N, "stock_disponible": N}`
- [ ] Non trouvé → **404** `{"detail": "…"}`
- [ ] PROTECT (suppression refusée) → **409** `{"detail": "…"}`
- [ ] Date invalide rapports → **400** `{"date": ["Format attendu : AAAA-MM-JJ."]}`

### A5. Métier / intégrité

- [ ] `creer_vente` dans `@transaction.atomic` (tout ou rien)
- [ ] Décrément de stock atomique (`F('stock') - quantite`)
- [ ] Prix **figé** dans `ligne_vente` (copie du prix produit)
- [ ] `reapproisionner` : `stock += quantite` en une seule écriture
- [ ] Aucune vente avec stock négatif possible

---

## B. Côté frontend (configuration seule)

- [ ] Backend joignable : `curl http://127.0.0.1:8000/api/categories/` répond
- [ ] `frontend/.env` :
  ```env
  VITE_USE_MOCK=false
  VITE_API_URL=/api
  ```
- [ ] Redémarrer Vite après changement de `.env` (`Ctrl+C` puis `npm run dev`)
- [ ] Proxy actif : dans le DevTools Network, les appels passent par `/api/…` (pas `localhost:8000` en direct, pas de CORS error)

---

## C. Tests manuels de bout en bout

Chaque test = un écran du front. Coche au fur et à mesure.

### C1. Smoke test API

- [ ] `GET /api/categories/` dans le navigateur → JSON paginé
- [ ] `GET /api/produits/` → liste réelle (pas les produits de démo MSW)

### C2. Catalogue (`/produits`)

- [ ] Liste affiche les produits **de la base MySQL**
- [ ] Recherche par nom/code fonctionne
- [ ] Filtre catégorie fonctionne
- [ ] Badge « Stock bas » / « Rupture » cohérent avec la DB
- [ ] Créer un produit → visible après rafraîchissement
- [ ] Éditer un produit → persistance OK
- [ ] Supprimer un produit jamais vendu → OK
- [ ] Supprimer un produit en vente → message métier (409)

### C3. Caisse (`/caisse`)

- [ ] Recherche produit → ajout panier
- [ ] **Vente valide** → 201, stock décrémenté dans MySQL, ticket affiché
- [ ] **Stock insuffisant** → toast/message métier (pas une erreur brute)
- [ ] Rafraîchir `/produits` → le stock a bien baissé
- [ ] Réimpression ticket depuis l'historique OK

### C4. Historique (`/ventes`)

- [ ] Liste des ventes réelles, pagination (10/page)
- [ ] Filtre par date + mode de paiement
- [ ] Détail (tiroir) avec lignes
- [ ] Ticket réimprimable

### C5. Rapport (`/rapport`)

- [ ] CA du jour, nb ventes, panier moyen cohérents
- [ ] Répartition par mode de paiement / catégorie
- [ ] Top 3 produits du jour
- [ ] Liste produits à racheter = stocks réels ≤ seuil

### C6. Tableau de bord (`/`)

- [ ] 1 seul appel réseau `rapports/tableau-de-bord/`
- [ ] CA jour / hier / série 7 jours cohérents
- [ ] Top produits semaine, compteurs stock, dernières ventes
- [ ] Après une nouvelle vente → le dashboard se rafraîchit

### C7. Reprise démo

- [ ] Remettre `VITE_USE_MOCK=true` + redémarrer → l'app fonctionne en démo
- [ ] Remettre `false` → retour sur le vrai backend

---

## D. Critères de « prêt pour merge »

- [ ] Tous les points **A** validés (backend conforme)
- [ ] Tous les points **C1 → C6** validés (scénarios réels)
- [ ] Aucune erreur console JS bloquante
- [ ] Aucune erreur 500 dans le log Django
- [ ] Tests frontend OK : `cd frontend && npm run test` (4/4)
- [ ] Build OK : `npm run build`
- [ ] Checklist du contrat (`API_CONTRACT.md` § Checklist) entièrement cochée
- [ ] PR ouverte avec résumé des écarts éventuels + comment les tester

---

## E. En cas d'écart détecté

| Situation | Action |
|---|---|
| Le backend ne respecte pas le contrat | Elle corrige côté DRF — le contrat fait foi |
| Le contrat était ambigu / faux | Ouvrir une issue → modifier `API_CONTRACT.md` **d'abord** → corriger front **et** back |
| Nouveau besoin non prévu | Discuter en issue/PR **avant** d'implémenter des deux côtés |
| Petit écosystème de tests | rejouer `frontend/src/mocks/handlers.js` comme référence exécutable |

---

## F. Raccourci de vérification (à exécuter le jour J)

```bash
# 1. Backend en marche ?
curl -s http://127.0.0.1:8000/api/categories/ | head -c 200

# 2. Pagination bien à 10 ?
curl -s "http://127.0.0.1:8000/api/produits/?page=1" | python3 -c "import sys,json; d=json.load(sys.stdin); print('count', d['count'], 'results', len(d['results']))"

# 3. Décimaux en chaînes ?
curl -s http://127.0.0.1:8000/api/produits/ | python3 -c "import sys,json; r=json.load(sys.stdin)['results'][0]; print(type(r['prix_unitaire']), r['prix_unitaire'])"
# attendu : <class 'str'> 6200.00

# 4. Stock insuffisant → 409 ?
curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8000/api/ventes/ \
  -H "Content-Type: application/json" \
  -d '{"mode_paiement":"ESPECES","lignes":[{"produit":1,"quantite":999999}]}'
# attendu : 409

# 5. Basculer le front
cd frontend && sed -i 's/VITE_USE_MOCK=.*/VITE_USE_MOCK=false/' .env && npm run dev
```

Si les 4 premiers points passent → ouvre `http://localhost:5173` et déroule la section **C**.
