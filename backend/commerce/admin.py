
from django.contrib import admin
from .models import Categorie, Produit, Vente, LigneVente


# =====================================================
# GESTION DES CATÉGORIES
# =====================================================

@admin.register(Categorie)
class CategorieAdmin(admin.ModelAdmin):
    list_display = ("id", "nom", "description")
    search_fields = ("nom",)
    ordering = ("nom",)


# =====================================================
# GESTION DES PRODUITS
# =====================================================

@admin.register(Produit)
class ProduitAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "code",
        "nom",
        "categorie",
        "prix_unitaire",
        "stock",
        "seuil_alerte",
        "est_en_alerte",
    )

    list_filter = ("categorie",)
    search_fields = ("code", "nom")
    ordering = ("nom",)

    readonly_fields = ()


# =====================================================
# LIGNES DE VENTE DANS UNE VENTE
# =====================================================

class LigneVenteInline(admin.TabularInline):
    model = LigneVente
    extra = 1


# =====================================================
# GESTION DES VENTES
# =====================================================

@admin.register(Vente)
class VenteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "date_vente",
        "client_nom",
        "mode_paiement",
        "montant_total",
    )

    list_filter = ("mode_paiement", "date_vente")
    search_fields = ("client_nom",)
    ordering = ("-date_vente",)

    inlines = [LigneVenteInline]


# =====================================================
# GESTION DES LIGNES DE VENTE
# =====================================================

@admin.register(LigneVente)
class LigneVenteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "vente",
        "produit",
        "quantite",
        "prix_unitaire",
        "montant_ligne",
    )

    list_filter = ("produit",)
    search_fields = ("produit__nom",)
