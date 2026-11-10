
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CategorieViewSet,
    ProduitViewSet,
    VenteViewSet,
    RapportJourView,
    TableauDeBordView,
)

router = DefaultRouter()

router.register("categories", CategorieViewSet, basename="categorie")
router.register("produits", ProduitViewSet, basename="produit")
router.register("ventes", VenteViewSet, basename="vente")

urlpatterns = [
    path("rapports/jour/", RapportJourView.as_view(), name="rapport-jour"),
    path(
        "rapports/tableau-de-bord/",
        TableauDeBordView.as_view(),
        name="rapport-tableau-de-bord",
    ),
] + router.urls
