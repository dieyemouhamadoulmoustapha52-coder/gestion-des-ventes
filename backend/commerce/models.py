
"""
Modèles de données de l'application de gestion des ventes et des stocks.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


# ============================================================
# 1. CATEGORIE
# ============================================================

class Categorie(models.Model):

    nom = models.CharField(
        "Nom de la catégorie",
        max_length=100,
        unique=True
    )

    description = models.TextField(
        "Description",
        blank=True,
        default=""
    )

    class Meta:
        db_table = "categorie"
        ordering = ["nom"]
        verbose_name = "Catégorie"
        verbose_name_plural = "Catégories"

    def __str__(self):
        return self.nom


# ============================================================
# 2. PRODUIT
# ============================================================

class Produit(models.Model):

    code = models.CharField(
        "Code / SKU",
        max_length=50,
        unique=True,
        help_text="Référence unique du produit."
    )

    nom = models.CharField(
        "Nom du produit",
        max_length=200
    )

    categorie = models.ForeignKey(
        Categorie,
        on_delete=models.PROTECT,
        related_name="produits",
        verbose_name="Catégorie"
    )

    prix_unitaire = models.DecimalField(
        "Prix unitaire",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))]
    )

    stock = models.PositiveIntegerField(
        "Stock actuel",
        default=0,
        validators=[MinValueValidator(0)]
    )

    seuil_alerte = models.PositiveIntegerField(
        "Seuil d'alerte",
        default=0,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        db_table = "produit"
        ordering = ["nom"]
        verbose_name = "Produit"
        verbose_name_plural = "Produits"

        indexes = [
            models.Index(
                fields=["categorie"],
                name="idx_produit_categorie"
            ),
            models.Index(
                fields=["stock"],
                name="idx_produit_stock"
            ),
        ]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(prix_unitaire__gte=0),
                name="chk_produit_prix_positif"
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.nom}"

    @property
    def est_en_alerte(self):
        """Indique si le stock est inférieur ou égal au seuil."""
        return self.stock <= self.seuil_alerte


# ============================================================
# 3. MODES DE PAIEMENT
# ============================================================

class ModePaiement(models.TextChoices):

    ESPECES = "ESPECES", "Espèces"
    WAVE = "WAVE", "Wave"
    ORANGE_MONEY = "ORANGE_MONEY", "Orange Money"
    CARTE = "CARTE", "Carte"


# ============================================================
# 4. VENTE
# ============================================================

class Vente(models.Model):

    date_vente = models.DateTimeField(
        "Date et heure",
        default=timezone.now,
        db_index=True
    )

    client_nom = models.CharField(
        "Nom du client",
        max_length=200
    )

    mode_paiement = models.CharField(
        "Mode de paiement",
        max_length=20,
        choices=ModePaiement.choices,
        default=ModePaiement.ESPECES
    )

    montant_total = models.DecimalField(
        "Montant total",
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))]
    )

    class Meta:
        db_table = "vente"
        ordering = ["-date_vente"]
        verbose_name = "Vente"
        verbose_name_plural = "Ventes"

        indexes = [
            models.Index(
                fields=["date_vente"],
                name="idx_vente_date"
            ),
            models.Index(
                fields=["mode_paiement"],
                name="idx_vente_mode_paiement"
            ),
        ]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(montant_total__gte=0),
                name="chk_vente_total_positif"
            ),
        ]

    def __str__(self):
        return (
            f"Vente #{self.id} - {self.client_nom} - "
            f"{self.montant_total} "
            f"({self.get_mode_paiement_display()})"
        )

    @property
    def montant_recalcule(self):
        """Calcule le total à partir des lignes de vente."""
        return sum(
            (ligne.montant_ligne for ligne in self.lignes.all()),
            start=Decimal("0.00")
        )


# ============================================================
# 5. LIGNE DE VENTE
# ============================================================

class LigneVente(models.Model):

    vente = models.ForeignKey(
        Vente,
        on_delete=models.CASCADE,
        related_name="lignes",
        verbose_name="Vente"
    )

    produit = models.ForeignKey(
        Produit,
        on_delete=models.PROTECT,
        related_name="lignes_vente",
        verbose_name="Produit"
    )

    quantite = models.PositiveIntegerField(
        "Quantité vendue",
        validators=[MinValueValidator(1)]
    )

    prix_unitaire = models.DecimalField(
        "Prix unitaire au moment de la vente",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))]
    )

    class Meta:
        db_table = "ligne_vente"
        ordering = ["id"]
        verbose_name = "Ligne de vente"
        verbose_name_plural = "Lignes de vente"

        indexes = [
            models.Index(
                fields=["produit"],
                name="idx_ligne_vente_produit"
            ),
            models.Index(
                fields=["vente"],
                name="idx_ligne_vente_vente"
            ),
        ]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantite__gt=0),
                name="chk_ligne_vente_quantite_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(prix_unitaire__gte=0),
                name="chk_ligne_vente_prix_positif"
            ),
        ]

    def __str__(self):
        return (
            f"{self.quantite} x {self.produit.nom} "
            f"(vente n°{self.vente_id})"
        )

    @property
    def montant_ligne(self):
        """Montant de la ligne = quantité × prix unitaire."""
        return self.quantite * self.prix_unitaire
