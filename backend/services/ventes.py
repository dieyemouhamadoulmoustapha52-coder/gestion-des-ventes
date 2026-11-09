
"""
Service de création de vente — conforme à docs/API_CONTRACT.md.

- fige le prix_unitaire au moment de la vente ;
- décrémente le stock (opération atomique, tout-ou-rien) ;
- lève StockInsuffisant (409) quand le stock est insuffisant.
"""

from decimal import Decimal

from django.db import transaction

from commerce.models import (
    Produit,
    Vente,
    LigneVente,
    ModePaiement,
)


class StockInsuffisant(Exception):
    """Erreur métier traduite en 409 par la vue."""

    def __init__(self, produit, quantite_demandee):
        self.produit = produit
        self.stock_disponible = produit.stock
        self.quantite_demandee = quantite_demandee
        self.code = "stock_insuffisant"
        self.detail = (
            f"Stock insuffisant pour {produit.nom} "
            f"(disponible : {produit.stock}, demandé : {quantite_demandee})."
        )
        super().__init__(self.detail)


@transaction.atomic
def creer_vente(mode_paiement, lignes, client_nom=""):
    """
    Crée une vente et diminue automatiquement les stocks.

    lignes : [{"produit": <id>, "quantite": <int>}, ...]
    Retourne l'objet Vente créé (avec lignes pré-chargées).
    """

    # 1. Validation du mode de paiement
    modes_valides = [choix[0] for choix in ModePaiement.choices]

    if mode_paiement not in modes_valides:
        raise ValueError("Mode de paiement invalide.")

    if not lignes:
        raise ValueError("La vente doit contenir au moins un produit.")

    # 2. Regrouper les quantités des produits identiques
    quantites = {}

    for ligne in lignes:
        produit_id = ligne["produit"]
        quantite = ligne["quantite"]

        if produit_id <= 0 or quantite <= 0:
            raise ValueError(
                "L'identifiant du produit et la quantité doivent être positifs."
            )

        quantites[produit_id] = quantites.get(produit_id, 0) + quantite

    # 3. Verrouiller les produits (ventes concurrentes)
    produits = {}

    for produit_id in sorted(quantites):
        try:
            produits[produit_id] = Produit.objects.select_for_update().get(
                id=produit_id
            )
        except Produit.DoesNotExist:
            raise ValueError(
                f"Le produit numéro {produit_id} n'existe pas."
            )

    # 4. Contrôle du stock
    for produit_id, quantite in quantites.items():
        produit = produits[produit_id]

        if produit.stock < quantite:
            raise StockInsuffisant(produit, quantite)

    # 5. Création de la vente
    vente = Vente.objects.create(
        client_nom=(client_nom or "").strip(),
        mode_paiement=mode_paiement,
        montant_total=Decimal("0.00"),
    )

    montant_total = Decimal("0.00")

    # 6. Lignes + décrément du stock
    for produit_id, quantite in quantites.items():
        produit = produits[produit_id]

        LigneVente.objects.create(
            vente=vente,
            produit=produit,
            quantite=quantite,
            prix_unitaire=produit.prix_unitaire,
        )

        montant_total += produit.prix_unitaire * quantite

        produit.stock -= quantite
        produit.save(update_fields=["stock"])

    # 7. Total
    vente.montant_total = montant_total
    vente.save(update_fields=["montant_total"])

    return vente
