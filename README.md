# 🛒 Gestion des Ventes & Stock — Monorepo

**MVP d'application web de gestion commerciale et de stock** (sans TVA, sans remises, sans journal d'anomalies).

| | |
|---|---|
| **Backend** | Django + Django REST Framework · services transactionnels · MySQL 8 |
| **Frontend** | React 19 + Vite · proxy `/api` en développement |
| **Base de données** | MySQL 8 — 4 tables : `categorie`, `produit`, `vente`, `ligne_vente` |

> 📄 **Modélisation complète** (schéma relationnel, DDL MySQL, `models.py`, requêtes ORM de reporting) : [`modelisation_base_de_donnees.md`](./modelisation_base_de_donnees.md)

---

## 📁 Structure du monorepo

```
Gestion_des_ventes/
├── backend/                        # API Django + DRF (Back-end)
│   ├── .env.example                #   modèle de configuration (Django + MySQL)
│   ├── requirements.txt            #   dépendances Python
│   └── services/                   #   services métier (ex. creer_vente @transaction.atomic)
├── frontend/                       # Interface React (Front-end)
│   ├── .env.example                #   modèle de configuration (URL de l'API)
│   ├── index.html                  #   page hôte Vite
│   ├── package.json                #   dépendances Node (React, Vite, Router)
│   ├── vite.config.js              #   plugin React + proxy /api → :8000
│   └── src/
│       ├── main.jsx                #   montage de l'application
│       └── App.jsx                 #   composant racine (squelette)
├── .gitignore                      #   exclusions globales (venv, node_modules, IDE, .env…)
├── README.md                       #   ce document
├── modelisation_base_de_donnees.md #   schéma, DDL, models.py, requêtes ORM
└── presentation_modelisation.pptx  #   présentation de la modélisation (5 slides)
```

Un **monorepo unique** pour les deux applications : un seul `git clone`, une seule vue des changements API + UI dans les Pull Requests, et le couplage contrat/API-interface visible en un coup d'œil.

---

## 👥 Rôles & responsabilités

### 🔧 Back-end — `backend/`
- Projet **Django** + **Django REST Framework** : modèles MySQL (4 tables), sérialiseurs, vues, routes `/api/…`.
- **Services métier transactionnels** (`backend/services/`) : `creer_vente` avec `@transaction.atomic`, contrôles de stock et décrément atomique `F('stock') - quantite`.
- **Reporting ORM** : CA global, top 3 des produits, CA par catégorie, encaissements par mode de paiement.
- Gestion des **migrations** MySQL et de la configuration (`.env` via `django-environ`).

### 🎨 Front-end — `frontend/`
- Application **React** (Vite, React Router) : catalogue produits, écran de vente, suivi des stocks et alertes (`stock <= seuil_alerte`).
- Appel de l'API via `VITE_API_BASE_URL` (proxifié vers `:8000` en développement — pas de CORS à gérer côté dev).
- Affichage des **tableaux de bord** alimentés par les vues de reporting du backend.

---

## 🔧 Prérequis

- **Python** ≥ 3.11 (+ `pip`, `venv`) et les en-têtes MySQL : `sudo dnf install python3-devel mysql-devel` (Fedora) ou `sudo apt install python3-dev default-libmysqlclient-dev` (Debian/Ubuntu)
- **Node.js** ≥ 18 (avec `npm`)
- **MySQL 8** démarré localement
- **Git**

---

## 🚀 Démarrage

### 1. Cloner le dépôt

```bash
git clone <url-du-depot>.git
cd Gestion_des_ventes
```

### 2. Back-end (API Django)

```bash
cd backend

# Environnement virtuel Python
python3 -m venv .venv
source .venv/bin/activate            # Windows : .venv\Scripts\activate

# Dépendances
pip install -r requirements.txt

# Création du projet Django (une seule fois, à la première mise en route)
django-admin startproject config .    # crée manage.py + config/
python manage.py startapp commerce    # app des modèles métier

# Configuration
cp .env.example .env                  # renseigner DB_NAME / DB_USER / DB_PASSWORD

# Base de données (après la création des modèles MySQL)
python manage.py migrate

# Démarrage de l'API
python manage.py runserver            # → http://127.0.0.1:8000/api/
```

### 3. Front-end (React)

```bash
cd frontend
npm install
npm run dev                           # → http://localhost:5173
```

Le proxy `vite.config.js` redirige `/api` vers `http://127.0.0.1:8000`.

---

## 🧾 Conventions Git — [Conventional Commits](https://www.conventionalcommits.org/)

```
<type>: <description courte en anglais ou français>
```

| Type | Usage | Exemple |
|---|---|---|
| `feat` | nouvelle fonctionnalité | `feat: endpoint de création de vente` |
| `fix` | correction de bug | `fix: décrément de stock négatif` |
| `docs` | documentation | `docs: maj du modèle de données` |
| `chore` | outillage, structure | `chore: initialisation de la structure monorepo du projet` |
| `refactor` / `test` / `style` | refonte / tests / formatage | `refactor: service creer_vente` |

**Branche principale :** `main` (toujours stable). **Fonctionnalités :** `feat/…`, corrections : `fix/…`, merge via Pull Request.

---

## 🤝 Collaboration sur GitHub

### Connecter ce dépôt local à un dépôt distant (méthode recommandée ici — `gh` déjà authentifié)

```bash
# Créer le dépôt GitHub privé + brancher l'origine + pousser, en une commande :
gh repo create gestion-des-ventes --private --source=. --remote=origin --push
```

### Équivalent manuel (sans `gh`)

```bash
# 1. Créer un dépôt VIDE sur https://github.com/new (sans README ni .gitignore)
# 2. Le brancher :
git remote add origin https://github.com/<VOTRE_USER>/<NOM_DU_DEPOT>.git
git branch -M main
git push -u origin main
```

### Inviter un collaborateur

```bash
# En ligne de commande (droits de push) :
gh api -X POST repos/<VOTRE_USER>/<NOM_DU_DEPOT>/collaborators/<USER_DU_COLLABORATEUR> -f permission=push
```

_Ou sur GitHub :_ `Settings` → `Collaborators and teams` → `Add people`.

### Flux de travail quotidien

```bash
git checkout main
git pull                              # toujours synchroniser avant de démarrer
git checkout -b feat/api-ventes       # branche dédiée à la fonctionnalité
git add .
git commit -m "feat: endpoint de création de vente"
git push -u origin feat/api-ventes
# Puis ouvrir une Pull Request sur GitHub (revue croisée Back-end ↔ Front-end)
```

---

## 🗺️ Étapes suivantes (roadmap MVP)

1. **Backend** — projet Django + DRF, modèles des 4 tables (voir `modelisation_base_de_donnees.md`), service transactionnel `creer_vente`, vues de reporting.
2. **Frontend** — dashboard (CA, top produits, alertes stock), catalogue, écran de vente.
3. **Intégration** — authentification, déploiement (Gunicorn + MySQL managé), CI.
