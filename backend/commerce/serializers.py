from rest_framework import serializers

from .models import Categorie, Produit, Vente, LigneVente, ModePaiement


# ============================================================
# CATÉGORIE
# ============================================================

class CategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categorie
        fields = ["id", "nom", "description"]


# ============================================================
# PRODUIT
# ============================================================

class ProduitSerializer(serializers.ModelSerializer):
    categorie_nom = serializers.CharField(
        source="categorie.nom",
        read_only=True
    )
    # Propriété du modèle : doit être exposée explicitement
    est_en_alerte = serializers.BooleanField(read_only=True)

    class Meta:
        model = Produit
        fields = "__all__"


# ============================================================
# LIGNE DE VENTE
# ============================================================

class LigneVenteSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(
        source="produit.nom",
        read_only=True
    )
    produit_code = serializers.CharField(
        source="produit.code",
        read_only=True
    )
    montant_ligne = serializers.DecimalField(
        max_digits=13,
        decimal_places=2,
        read_only=True
    )

    class Meta:
        model = LigneVente
        fields = [
            "id", "vente", "produit", "produit_nom", "produit_code",
            "quantite", "prix_unitaire", "montant_ligne",
        ]


# ============================================================
# VENTE — lecture
# ============================================================

class VenteResumeSerializer(serializers.ModelSerializer):
    """Liste légère : sans lignes (contrat GET ventes/)."""

    class Meta:
        model = Vente
        fields = ["id", "date_vente", "client_nom", "mode_paiement",
                  "montant_total"]


class VenteDetailSerializer(serializers.ModelSerializer):
    """Détail : avec lignes (contrat GET ventes/{id}/ et POST 201)."""

    lignes = LigneVenteSerializer(many=True, read_only=True)

    class Meta:
        model = Vente
        fields = ["id", "date_vente", "client_nom", "mode_paiement",
                  "montant_total", "lignes"]


class VenteDashboardSerializer(serializers.ModelSerializer):
    """dernieres_ventes du tableau de bord : 4 champs, sans client_nom."""

    class Meta:
        model = Vente
        fields = ["id", "date_vente", "montant_total", "mode_paiement"]


# ============================================================
# VENTE — création (contrat POST ventes/)
# ============================================================

class LigneVenteCreateSerializer(serializers.Serializer):
    produit = serializers.IntegerField(min_value=1)
    quantite = serializers.IntegerField(min_value=1)


class VenteCreateSerializer(serializers.Serializer):
    mode_paiement = serializers.ChoiceField(choices=ModePaiement.choices)
    client_nom = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
        default=""
    )
    lignes = LigneVenteCreateSerializer(many=True, allow_empty=False)


# ============================================================
# RÉAPPROVISIONNEMENT (contrat POST produits/{id}/reapprovisionner/)
# ============================================================

class ReapprovisionnementSerializer(serializers.Serializer):
    # Message d'erreur imposé par le contrat pour TOUS les cas
    # (absent, non entier, ≤ 0).
    quantite = serializers.IntegerField(
        min_value=1,
        error_messages={
            "required": "Entier strictement positif attendu.",
            "null": "Entier strictement positif attendu.",
            "invalid": "Entier strictement positif attendu.",
            "min_value": "Entier strictement positif attendu.",
        },
    )
