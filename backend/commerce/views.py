
from django.db.models import F
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Categorie, Produit, Vente
from .serializers import (
    CategorieSerializer,
    ProduitSerializer,
    ReapprovisionnementSerializer,
    VenteCreateSerializer,
    VenteDetailSerializer,
    VenteResumeSerializer,
)
from services.ventes import StockInsuffisant, creer_vente
from services.rapports import (
    DateInvalide,
    parse_date,
    plage_du_jour,
    rapport_jour,
    tableau_de_bord,
)


def _conflit_protection(message):
    """409 PROTECT — forme {detail} du contrat."""
    return Response({"detail": message}, status=status.HTTP_409_CONFLICT)


# ============================================================
# /api/categories/
# ============================================================

class CategorieViewSet(viewsets.ModelViewSet):
    queryset = Categorie.objects.all()
    serializer_class = CategorieSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        nb_produits = instance.produits.count()

        if nb_produits:
            return _conflit_protection(
                "Impossible de supprimer cette catégorie : "
                f"{nb_produits} produit(s) lui sont rattachés."
            )

        return super().destroy(request, *args, **kwargs)


# ============================================================
# /api/produits/
# ============================================================

class ProduitViewSet(viewsets.ModelViewSet):
    serializer_class = ProduitSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["code", "nom"]

    def get_queryset(self):
        queryset = Produit.objects.select_related("categorie").all()
        params = self.request.query_params

        categorie = params.get("categorie")
        if categorie not in (None, ""):
            queryset = queryset.filter(categorie_id=categorie)

        stock_bas = params.get("stock_bas")
        if stock_bas and stock_bas.lower() in ("true", "1", "yes", "oui"):
            queryset = queryset.filter(stock__lte=F("seuil_alerte"))

        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        nb_ventes = instance.lignes_vente.count()

        if nb_ventes:
            return _conflit_protection(
                "Impossible de supprimer ce produit : "
                f"il figure dans {nb_ventes} vente(s)."
            )

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="reapprovisionner")
    def reapprovisionner(self, request, pk=None):
        """POST /api/produits/{id}/reapprovisionner/ — stock += quantite."""
        serializer = ReapprovisionnementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # get_object() → 404 {detail} si le produit n'existe pas
        produit = self.get_object()

        # Une seule écriture : pas de lecture-modification-écriture
        Produit.objects.filter(pk=produit.pk).update(
            stock=F("stock") + serializer.validated_data["quantite"]
        )
        produit.refresh_from_db()

        return Response(self.get_serializer(produit).data)


# ============================================================
# /api/ventes/
# ============================================================

class VenteViewSet(mixins.ListModelMixin,
                   mixins.RetrieveModelMixin,
                   mixins.CreateModelMixin,
                   viewsets.GenericViewSet):
    queryset = Vente.objects.all()

    def get_serializer_class(self):
        # Liste légère (sans lignes) ; détail et création = vente complète
        if self.action in ("create", "retrieve"):
            return VenteDetailSerializer
        return VenteResumeSerializer

    def get_queryset(self):
        queryset = Vente.objects.all()
        params = self.request.query_params

        date = params.get("date")
        if date:
            try:
                jour = parse_date(date, obligatoire=True)
            except DateInvalide as erreur:
                # 400 {date: ["Format attendu : AAAA-MM-JJ."]}
                raise DRFValidationError({"date": [str(erreur)]})
            debut, fin = plage_du_jour(jour)
            queryset = queryset.filter(
                date_vente__gte=debut, date_vente__lt=fin
            )

        mode = params.get("mode_paiement")
        if mode:
            queryset = queryset.filter(mode_paiement=mode)

        return queryset

    def create(self, request, *args, **kwargs):
        validation = VenteCreateSerializer(data=request.data)
        validation.is_valid(raise_exception=True)
        donnees = validation.validated_data

        try:
            vente = creer_vente(
                mode_paiement=donnees["mode_paiement"],
                lignes=donnees["lignes"],
                client_nom=donnees.get("client_nom", ""),
            )
        except StockInsuffisant as erreur:
            return Response(
                {
                    "code": erreur.code,
                    "detail": erreur.detail,
                    "produit": erreur.produit.id,
                    "stock_disponible": erreur.stock_disponible,
                },
                status=status.HTTP_409_CONFLICT,
            )
        except ValueError as erreur:
            return Response(
                {"lignes": [str(erreur)]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = VenteDetailSerializer(vente)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ============================================================
# /api/rapports/jour/  ·  /api/rapports/tableau-de-bord/
# ============================================================

class RapportJourView(APIView):
    def get(self, request):
        try:
            date = parse_date(request.query_params.get("date"), obligatoire=True)
        except DateInvalide as erreur:
            return Response(
                {"date": [str(erreur)]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(rapport_jour(date))


class TableauDeBordView(APIView):
    def get(self, request):
        try:
            date = parse_date(
                request.query_params.get("date"), obligatoire=False
            )
        except DateInvalide as erreur:
            return Response(
                {"date": [str(erreur)]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(tableau_de_bord(date))
