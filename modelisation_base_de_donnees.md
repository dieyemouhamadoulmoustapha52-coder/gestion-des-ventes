# Modélisation de la base de données — Application de gestion commerciale & stock (MVP)

> **Périmètre** : catalogue produits + catégories, stocks avec seuil d'alerte, ventes et lignes de vente.
> **Hors périmètre (volontairement)** : TVA, remises, journal des anomalies, gestion de tiers (fournisseurs/clients liés), mouvements de stock.
> **SGBD cible** : MySQL 8.x (InnoDB, `utf8mb4`), via Django 4.2/5.x.

---

## 1. Description textuelle du schéma

### 1.1 Table `categorie`

Regroupe les produits (Épicerie, Boissons, Hygiène…).

| Colonne | Type MySQL | Contrainte | Rôle |
|---|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | **PK** | Identifiant technique |
| `nom` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | Nom lisible de la catégorie |
| `description` | `TEXT` | nullable | Précision optionnelle |

- **Cardinalité** : une catégorie est liée à **0..N** produits ; un produit appartient à **exactement 1** catégorie.

### 1.2 Table `produit`

Article vendu, avec son stock et son seuil d'alerte.

| Colonne | Type MySQL | Contrainte | Rôle |
|---|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | **PK** | Identifiant technique |
| `code` | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` | **SKU** — code unique du produit (référence interne) |
| `nom` | `VARCHAR(200)` | `NOT NULL` | Libellé affiché |
| `categorie_id` | `BIGINT` | **FK → `categorie.id`**, `NOT NULL`, `ON DELETE RESTRICT` | Appartenance à une catégorie |
| `prix_unitaire` | `DECIMAL(12,2)` | `NOT NULL` | Prix de vente unitaire (sans TVA) |
| `stock` | `INT UNSIGNED` | `NOT NULL`, `DEFAULT 0` | Stock actuel (unités) |
| `seuil_alerte` | `INT UNSIGNED` | `NOT NULL`, `DEFAULT 0` | Seuil de réapprovisionnement |

- **Cardinalité** : un produit figure sur **0..N** lignes de vente.
- **Alerte** : *dérivée*, `stock <= seuil_alerte` → **pas de colonne stockée** (évite toute incohérence).

### 1.3 Table `vente`

En-tête d'une transaction de vente.

| Colonne | Type MySQL | Contrainte | Rôle |
|---|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | **PK** | Numéro de vente |
| `date_vente` | `DATETIME` | `NOT NULL`, index | Date/heure de l'encaissement |
| `client_nom` | `VARCHAR(200)` | `NOT NULL` | Nom du client (saisi librement, sans table tiers) |
| `mode_paiement` | `VARCHAR(20)` | `NOT NULL`, index | `ESPECES` / `WAVE` / `ORANGE_MONEY` / `CARTE` (choices Django) |
| `montant_total` | `DECIMAL(12,2)` | `NOT NULL`, `DEFAULT 0` | Total de la vente (somme des lignes, figé à la création) |

- **Cardinalité** : une vente possède **1..N** lignes de vente ; suppression en **cascade** des lignes si la vente est supprimée.

### 1.4 Table `ligne_vente`

Détail d'une vente : quel produit, combien, à quel prix.

| Colonne | Type MySQL | Contrainte | Rôle |
|---|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | **PK** | Identifiant technique |
| `vente_id` | `BIGINT` | **FK → `vente.id`**, `NOT NULL`, `ON DELETE CASCADE` | Vente parente |
| `produit_id` | `BIGINT` | **FK → `produit.id`**, `NOT NULL`, `ON DELETE RESTRICT` | Produit vendu |
| `quantite` | `INT UNSIGNED` | `NOT NULL`, `CHECK > 0` | Quantité vendue |
| `prix_unitaire` | `DECIMAL(12,2)` | `NOT NULL` | **Prix figé au moment de la vente** (copie du prix produit) |

- **Cardinalité** : une ligne appartient à **exactement 1** vente et **exactement 1** produit.
- Montant de la ligne = `quantite × prix_unitaire` → **calculé, jamais stocké**.

### 1.5 Relations et cardinalités (vue globale)

```
categorie                          vente
┌──────────────────┐               ┌─────────────────────────────┐
│ PK id            │               │ PK id                       │
│    nom  (UQ)     │               │    date_vente  (idx)        │
│    description   │               │    client_nom              │
└────────┬─────────┘               │    mode_paiement (idx)      │
         │ 1                       │    montant_total            │
         │                         └──────────────┬──────────────┘
         │ N                                      │ 1
         │                                        │ N
         │                         ┌──────────────┴──────────────┐
┌────────┴─────────┐               │ ligne_vente                 │
│ produit          │               │ PK id                       │
│ PK id            │◄──────────────┤ FK vente_id  (CASCADE)      │
│    code  (UQ/SKU)│      N        │ FK produit_id (RESTRICT)    │
│    nom           │               │    quantite  (CHECK > 0)    │
│ FK categorie_id  │               │    prix_unitaire (figé)     │
│    prix_unitaire │               └─────────────────────────────┘
│    stock         │
│    seuil_alerte  │
└──────────────────┘
```

| Relation | Cardinalité | Comportement de suppression |
|---|---|---|
| `categorie` → `produit` | 1 — N | **RESTRICT (`PROTECT`)** : on ne supprime pas une catégorie qui contient des produits |
| `vente` → `ligne_vente` | 1 — N | **CASCADE** : supprimer la vente supprime ses lignes |
| `produit` → `ligne_vente` | 1 — N | **RESTRICT (`PROTECT`)** : un produit ayant servi dans des ventes historiques n'est pas supprimable (intégrité du reporting CA) |

---

## 2. Script SQL MySQL (DDL équivalent)

```sql
-- ============================================================
-- Gestion des ventes & stocks — schéma MySQL 8 / InnoDB
-- ============================================================
CREATE TABLE categorie (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    nom         VARCHAR(100) NOT NULL,
    description TEXT         NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categorie_nom (nom)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE produit (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    code          VARCHAR(50)   NOT NULL,
    nom           VARCHAR(200)  NOT NULL,
    categorie_id  BIGINT        NOT NULL,
    prix_unitaire DECIMAL(12,2) NOT NULL,
    stock         INT UNSIGNED  NOT NULL DEFAULT 0,
    seuil_alerte  INT UNSIGNED  NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_produit_code (code),
    KEY idx_produit_categorie (categorie_id),
    CONSTRAINT fk_produit_categorie
        FOREIGN KEY (categorie_id) REFERENCES categorie (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_produit_prix_positif CHECK (prix_unitaire >= 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE vente (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    date_vente    DATETIME      NOT NULL,
    client_nom    VARCHAR(200)  NOT NULL,
    mode_paiement VARCHAR(20)   NOT NULL,
    montant_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (id),
    KEY idx_vente_date (date_vente),
    KEY idx_vente_mode_paiement (mode_paiement),
    CONSTRAINT chk_vente_mode_paiement
        CHECK (mode_paiement IN ('ESPECES', 'WAVE', 'ORANGE_MONEY', 'CARTE')),
    CONSTRAINT chk_vente_total_positif CHECK (montant_total >= 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE ligne_vente (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    vente_id      BIGINT        NOT NULL,
    produit_id    BIGINT        NOT NULL,
    quantite      INT UNSIGNED  NOT NULL,
    prix_unitaire DECIMAL(12,2) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_ligne_vente_vente (vente_id),
    KEY idx_ligne_vente_produit (produit_id),
    CONSTRAINT fk_ligne_vente_vente
        FOREIGN KEY (vente_id) REFERENCES vente (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ligne_vente_produit
        FOREIGN KEY (produit_id) REFERENCES produit (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_ligne_vente_quantite_positive CHECK (quantite > 0),
    CONSTRAINT chk_ligne_vente_prix_positif      CHECK (prix_unitaire >= 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
```

---

## 3. Code Django complet (`models.py`)

### 3.1 Extrait de `settings.py` (MySQL)

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": "gestion_ventes",
        "USER": "votre_user",
        "PASSWORD": "votre_mot_de_passe",
        "HOST": "127.0.0.1",
        "PORT": "3306",
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
        "CONN_MAX_AGE": 60,  # réutilisation des connexions
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"  # PK -> BIGINT
USE_TZ = True                                        # dates/heure timezone-aware
LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Dakar"                           # à adapter
```

### 3.2 `models.py`

```python
"""
Modèles de données — Application de gestion commerciale & stock (MVP).

Règles métier du périmètre :
  - pas de TVA, pas de remise  → les montants sont "TTC = HT" ;
  - pas de journal d'anomalies  → les alertes de stock sont dérivées (stock <= seuil) ;
  - MySQL / InnoDB / utf8mb4.
"""
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone


class Categorie(models.Model):
    """Regroupement logique des produits (Épicerie, Boissons, Hygiène...)."""

    nom = models.CharField("Nom de la catégorie", max_length=100, unique=True)
    description = models.TextField("Description", blank=True, default="")

    class Meta:
        db_table = "categorie"
        ordering = ["nom"]
        verbose_name = "Catégorie"
        verbose_name_plural = "Catégories"

    def __str__(self) -> str:
        return self.nom


class Produit(models.Model):
    """Produit du catalogue : identité, prix, stock et seuil d'alerte."""

    code = models.CharField(
        "Code / SKU",
        max_length=50,
        unique=True,
        help_text="Référence unique du produit (ex : 'BOI-COCA-33CL').",
    )
    nom = models.CharField("Nom du produit", max_length=200)
    categorie = models.ForeignKey(
        Categorie,
        on_delete=models.PROTECT,          # pas de suppression d'une catégorie utilisée
        related_name="produits",
        verbose_name="Catégorie",
    )
    prix_unitaire = models.DecimalField(
        "Prix unitaire",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    stock = models.PositiveIntegerField(
        "Stock actuel",
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Quantité disponible en rayon / entrepôt.",
    )
    seuil_alerte = models.PositiveIntegerField(
        "Seuil d'alerte",
        default=0,
        validators=[MinValueValidator(0)],
        help_text="En-dessous de ce stock, le produit doit être réapprovisionné.",
    )

    class Meta:
        db_table = "produit"
        ordering = ["nom"]
        verbose_name = "Produit"
        verbose_name_plural = "Produits"
        indexes = [
            models.Index(fields=["categorie"], name="idx_produit_categorie"),
            models.Index(fields=["stock"], name="idx_produit_stock"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(prix_unitaire__gte=0),
                name="chk_produit_prix_positif",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code} - {self.nom}"

    @property
    def est_en_alerte(self) -> bool:
        """Vrai si le stock est inférieur ou égal au seuil de réapprovisionnement."""
        return self.stock <= self.seuil_alerte


class ModePaiement(models.TextChoices):
    """Modes de paiement acceptés par le point de vente."""

    ESPECES = "ESPECES", "Espèces"
    WAVE = "WAVE", "Wave"
    ORANGE_MONEY = "ORANGE_MONEY", "Orange Money"
    CARTE = "CARTE", "Carte"


class Vente(models.Model):
    """En-tête d'une vente : quand, par qui encaissée, combien."""

    date_vente = models.DateTimeField(
        "Date et heure",
        default=timezone.now,
        db_index=True,
    )
    client_nom = models.CharField("Nom du client", max_length=200)
    mode_paiement = models.CharField(
        "Mode de paiement",
        max_length=20,
        choices=ModePaiement.choices,
        default=ModePaiement.ESPECES,
    )
    montant_total = models.DecimalField(
        "Montant total",
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Somme des lignes, figée à la création de la vente.",
    )

    class Meta:
        db_table = "vente"
        ordering = ["-date_vente"]
        verbose_name = "Vente"
        verbose_name_plural = "Ventes"
        indexes = [
            models.Index(fields=["date_vente"], name="idx_vente_date"),
            models.Index(fields=["mode_paiement"], name="idx_vente_mode_paiement"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(montant_total__gte=0),
                name="chk_vente_total_positif",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"Vente #{self.id} — {self.client_nom} — "
            f"{self.montant_total} F ({self.get_mode_paiement_display()})"
        )

    @property
    def montant_recalcule(self) -> Decimal:
        """Contrôle de cohérence : somme des lignes (à comparer à montant_total)."""
        return sum(
            (ligne.montant_ligne for ligne in self.lignes.all()),
            start=Decimal("0.00"),
        )


class LigneVente(models.Model):
    """Détail d'une vente : produit vendu, quantité, prix unitaire figé."""

    vente = models.ForeignKey(
        Vente,
        on_delete=models.CASCADE,         # supprimer la vente => supprimer ses lignes
        related_name="lignes",
        verbose_name="Vente",
    )
    produit = models.ForeignKey(
        Produit,
        on_delete=models.PROTECT,         # jamais de suppression d'un produit vendu
        related_name="lignes_vente",
        verbose_name="Produit",
    )
    quantite = models.PositiveIntegerField(
        "Quantité vendue",
        validators=[MinValueValidator(1)],
    )
    prix_unitaire = models.DecimalField(
        "Prix unitaire (au moment de la vente)",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Copie du prix du produit à l'instant de la vente.",
    )

    class Meta:
        db_table = "ligne_vente"
        ordering = ["id"]
        verbose_name = "Ligne de vente"
        verbose_name_plural = "Lignes de vente"
        indexes = [
            models.Index(fields=["produit"], name="idx_ligne_vente_produit"),
            models.Index(fields=["vente"], name="idx_ligne_vente_vente"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantite__gt=0),
                name="chk_ligne_vente_quantite_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(prix_unitaire__gte=0),
                name="chk_ligne_vente_prix_positif",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.quantite} x {self.produit.nom} (vente n°{self.vente_id})"

    @property
    def montant_ligne(self) -> Decimal:
        """Montant de la ligne = quantité × prix unitaire (non stocké)."""
        return self.quantite * self.prix_unitaire
```

> **Note de compatibilité** : `CheckConstraint(condition=...)` nécessite Django ≥ 5.1.
> Sur Django 4.2 LTS, remplacez `condition=` par `check=` (le nom historique).

### 3.3 Couche service : création atomique d'une vente (recommandée)

La cohérence **stock ↔ ventes** ne doit jamais être gérée dans les vues : elle vit dans un
service unique, exécuté dans une transaction.

```python
# services/ventes.py
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import LigneVente, ModePaiement, Produit, Vente


@transaction.atomic
def creer_vente(
    *,
    client_nom: str,
    mode_paiement: str,
    lignes: list[dict],          # [{"produit": <Produit>, "quantite": <int>}, ...]
) -> Vente:
    """
    Crée la vente, ses lignes (prix figé) et décrémente les stocks.
    Lève ValueError si quantité invalide ou stock insuffisant ;
    la transaction garantit un tout-ou-rien.
    """
    if mode_paiement not in ModePaiement.values:
        raise ValueError("Mode de paiement invalide.")
    if not lignes:
        raise ValueError("Une vente doit contenir au moins une ligne.")

    vente = Vente.objects.create(
        date_vente=timezone.now(),
        client_nom=client_nom.strip(),
        mode_paiement=mode_paiement,
        montant_total=Decimal("0.00"),
    )

    total = Decimal("0.00")
    for item in lignes:
        produit: Produit = item["produit"]
        quantite = int(item["quantite"])

        if quantite <= 0:
            raise ValueError(f"Quantité invalide pour {produit.nom}.")
        if produit.stock < quantite:
            raise ValueError(
                f"Stock insuffisant pour {produit.nom} "
                f"(disponible : {stock_reel}, demandé : {quantite})."
            )

        ligne = LigneVente.objects.create(
            vente=vente,
            produit=produit,
            quantite=quantite,
            prix_unitaire=produit.prix_unitaire,   # fige le prix au moment T
        )
        total += ligne.montant_ligne

        # Décrément atomique : évite les conditions de course (lecture/écriture)
        Produit.objects.filter(pk=produit.pk, stock__gte=quantite).update(
            stock=F("stock") - quantite
        )

    Vente.objects.filter(pk=vente.pk).update(montant_total=total)
    vente.montant_total = total
    return vente
```

*(Dans `creer_vente`, lisez le stock frais via `produit.stock` ou refaites un `refresh_from_db`
si nécessaire avant la vérification ; le `filter(stock__gte=...)` constitue la garde finale.)*

---

## 4. Choix de modélisation — justifications

### 4.1 Catégorie en table normalisée (et non `CharField` sur le produit)
- Le regroupement est un **objet métier** à part entière (libellés homogènes, CA par catégorie).
- Évite les doublons de saisie (`"Boisson"` vs `"boissons"`), permet de renommer une catégorie
  **en un seul endroit**.
- **`PROTECT`** à la suppression : supprimer une catégorie utilisée par des produits casserait
  le reporting historique du CA par catégorie. (Alternative : champ `actif` + soft delete.)

### 4.2 `code` unique = SKU natif
- `CharField(unique=True)` : on peut saisir des codes métier lisibles (`BOI-COCA-33CL`)
  au lieu d'un identifiant numérique opaque.
- L'unicité est garantie par l'**index unique MySQL**, donc aussi en base (pas seulement par la
  validation de formulaire). C'est aussi la clé de jointure naturelle avec d'éventuels
  imports CSV / lecteurs de code-barres.

### 4.3 `DecimalField` pour tous les montants — jamais `FloatField`
- `DECIMAL(12,2)` est exact : 0.1 + 0.2 == 0.3 en base comme en Python.
- Un `FloatField` produirait des arrondis parasites dans les agrégats de CA.
- `max_digits=12` laisse la place à des gros totaux (jusqu'à 10^10 unités monétaires).

### 4.4 `prix_unitaire` **figé** dans `ligne_vente` (snapshot)
- Le prix produit **évolue** dans le temps (révision, promotion future…). Sans copie,
  modifier le prix d'un produit **réécrirait l'historique** des ventes passées.
- La ligne de vente conserve donc le prix **tel qu'encaissé** → historique fidèle,
  réconciliation possible avec le total encaissé.
- C'est le choix standard des systèmes de caisse (ligne = preuve d'encaissement).

### 4.5 `montant_total` dénormalisé sur `vente`
- Le cahier des charges demande à ce que la vente **enregistre** le montant total :
  on le stocke (colonne `DECIMAL(12,2)`), figé à la création.
- **Gains** : les indicateurs (CA global, encaissements par mode de paiement) se lisent avec un
  simple `SUM(montant_total)` sans jointure sur les lignes.
- **Risque** : incohérence si quelqu'un modifie les lignes après coup. Deux parades déjà en place :
  la création se fait **uniquement via le service atomique**, et la property
  `montant_recalcule` permet de contrôler l'égalité `montant_total == Σ lignes`.
- Alternative (non retenue pour ce MVP) : ne stocker qu'une property → coût de calcul à chaque
  requête de reporting.

### 4.6 Cardinalités & règles de suppression réfléchies
| Relation | Choix | Pourquoi |
|---|---|---|
| `vente → ligne_vente` | `CASCADE` | Une ligne n'a aucun sens sans sa vente (entité faible) |
| `produit → ligne_vente` | `PROTECT` | Conserve l'intégrité référentielle du CA historique ; on **désactive** plutôt qu'on supprime (`is_active` à l'évolution) |
| `categorie → produit` | `PROTECT` | Idem : pas de rupture du regroupement des ventes |

### 4.7 Alertes de stock **dérivées**, pas stockées
- `stock <= seuil_alerte` est une **vue** : une colonne `en_alerte` deviendrait fausse dès qu'un
  stock change sans mise à jour du flag.
- `Produit.objects.filter(stock__lte=F("seuil_alerte"))` → la liste des produits à réapprovisionner
  est toujours exacte, sans maintenance supplémentaire (et sans journal d'anomalies, hors périmètre).

### 4.8 `stock` / `seuil_alerte` en `PositiveIntegerField`
- Les unités vendues en épicerie sont des **entiers** (bouteilles, boîtes, paquets).
- `PositiveIntegerField` → `INT UNSIGNED` en MySQL : impossible d'écrire un stock négatif par
  accident, plafond large (4 milliards).
- *Si pesée au kilo nécessaire plus tard* : basculer en `DecimalField(10,3)` (migration simple).

### 4.9 Mode de paiement en `TextChoices`
- Stocké en `VARCHAR(20)` avec valeurs **stables en code** (`WAVE`) et libellés d'affichage
  (`Wave`) via `get_mode_paiement_display()`.
- Ajouter un mode plus tard = 1 ligne dans l'enum + migration de choices, **aucune** modification
  de schéma (le `VARCHAR` absorbe la nouvelle valeur).
- Contrainte `CHECK` MySQL en miroir pour bloquer les valeurs hors liste.

### 4.10 Champs volontairement absents (cohérence avec le cahier des charges)
- **Pas de champ TVA** (`taux_tva`, `montant_tva`) : les prix sont directement nets.
- **Pas de champ remise** (`remise_pct`, `remise_montant`) : ni sur la vente, ni sur la ligne —
  le total est toujours `Σ (quantité × prix unitaire)`.
- **Pas de table client** : `client_nom` en texte libre suffit au MVP (pas d'historique client,
  pas de fidélité).
- **Pas de journal d'anomalies** : les alertes sont un simple filtre, pas des événements persistés.

### 4.11 Performance & MySQL
- **Index** : `date_vente` (reporting temporel), `mode_paiement` (encaissements), `categorie_id`
  et `produit_id` (jointures du reporting), `code` en unique.
- **`db_table` explicites** en minuscules singuliers → la base reste lisible par un DBA hors Django.
- **`utf8mb4` + `unicode_ci`** : accents français (`Épicerie`, `Hygiène`) correctement gérés,
  y compris dans les `UNIQUE`.
- **`BIGINT` PK** (`BigAutoField`) : marge de croissance, standard Django moderne.
- **`INNODB`** : les FK sont réellement respectées (MyISAM les ignorerait) + transactions `atomic`.

---

## 5. Indicateurs & reporting — requêtes ORM prêtes à l'emploi

```python
from django.db.models import Count, F, Sum, Q
from .models import LigneVente, Produit, Vente

# 1. Chiffre d'affaires global
ca_global = Vente.objects.aggregate(total=Sum("montant_total"))["total"] or Decimal("0.00")

# 2. CA par catégorie (jointure ligne -> produit -> categorie)
ca_par_categorie = (
    LigneVente.objects
    .values("produit__categorie__nom")
    .annotate(ca=Sum(F("quantite") * F("prix_unitaire")))
    .order_by("-ca")
)
# -> [{"produit__categorie__nom": "Boissons", "ca": Decimal("125000.00")}, ...]

# 3. Encaissements par mode de paiement (sur la période souhaitée)
encaissements = (
    Vente.objects
    .values("mode_paiement")
    .annotate(total=Sum("montant_total"), nb_ventes=Count("id"))
    .order_by("-total")
)

# 4. Produits sous le seuil d'alerte
produits_en_alerte = (
    Produit.objects
    .filter(stock__lte=F("seuil_alerte"))
    .order_by("stock")
)

# 5. Top 3 des produits les plus vendus (quantités)
top_produits = (
    LigneVente.objects
    .values("produit__code", "produit__nom")
    .annotate(qte_totale=Sum("quantite"))
    .order_by("-qte_totale")[:3]
)

# 6. CA mensuel (filtre temporel type)
from django.utils import timezone
debut_mois = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
ca_mensuel = (
    Vente.objects.filter(date_vente__gte=debut_mois)
    .aggregate(total=Sum("montant_total"))["total"] or Decimal("0.00")
)
```

Les colonnes indexées (`date_vente`, `mode_paiement`, `categorie_id`, `produit_id`) couvrent
exactement ces quatre familles de rapports.

---

## 6. Évolutions possibles (hors MVP, déjà prévues par la structure)

| Besoin futur | Extension minimale |
|---|---|
| Historique des prix | Contrainte d'unicité `(produit, date_debut)` sur une table `prix_produit` ; `prix_unitaire` de la ligne reste le snapshot |
| Désactivation d'un produit | Champ `actif BooleanField(default=True)` + filtre par défaut |
| Clients / fidélité | Table `client` + `ForeignKey(null=True)` sur `vente` (le `client_nom` devient le libellé dénormalisé) |
| Journal de stock | Table `mouvement_stock` (`produit`, `type`, `quantite`, `date`, `vente`) alimentée par le même service |
| TVA / remises | Colonnes `taux_tva`, `remise_*` — les totaux déjà en `DECIMAL(12,2)` supportent le calcul |
| Multi-utilisateur / caisse | `utilisateur = ForeignKey(User)` sur `vente` pour l'audit encaissements |
