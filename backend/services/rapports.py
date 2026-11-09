
"""
Agrégats de reporting — rapports/jour/ et rapports/tableau-de-bord/.

Tous les montants sont rendus en chaînes décimales à 2 décimales
("15500.00"), conformément à docs/API_CONTRACT.md.
"""

from datetime import datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Count, DecimalField, F, Q, Sum
from django.utils import timezone

from commerce.models import LigneVente, Produit, Vente


CHAMP_MONTANT = DecimalField(max_digits=13, decimal_places=2)


class DateInvalide(ValueError):
    """Date absente ou au format invalide → 400 DRF {date: [...]}."""

    message = "Format attendu : AAAA-MM-JJ."

    def __init__(self, message=None):
        super().__init__(message or self.message)


def parse_date(raw, obligatoire=True):
    """
    'YYYY-MM-DD' → date. Retourne aujourd'hui (fuseau du projet) si
    absent et non obligatoire ; lève DateInvalide sinon.
    """
    if not raw:
        if obligatoire:
            raise DateInvalide()
        return timezone.localdate()

    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise DateInvalide()


def plage_depuis(premier_jour, dernier_jour):
    """
    Bornes aware [premier 00:00, dernier+1j 00:00) dans le fuseau courant.

    Utilisé plutôt que le lookup `__date`, qui déclenche CONVERT_TZ côté
    MySQL/MariaDB — et renvoie NULL quand les tables de fuseaux ne sont
    pas installées (tous les filtres par jour tomberaient alors à vide).
    """
    debut = timezone.make_aware(datetime.combine(premier_jour, time.min))
    fin = timezone.make_aware(datetime.combine(dernier_jour, time.min))
    return debut, fin + timedelta(days=1)


def plage_du_jour(date):
    """Bornes d'une journée complète."""
    return plage_depuis(date, date)


def _fmt(montant):
    """Decimal|int → chaîne décimale à 2 chiffres ("0.00" si vide)."""
    if montant is None:
        montant = Decimal("0.00")
    if not isinstance(montant, Decimal):
        montant = Decimal(str(montant))
    return f"{montant.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}"


def _stats_jour(date):
    """(ca_total: Decimal, nb_ventes: int) pour une date donnée."""
    debut, fin = plage_du_jour(date)
    ventes = Vente.objects.filter(date_vente__gte=debut, date_vente__lt=fin)
    ca = ventes.aggregate(total=Sum("montant_total"))["total"] or Decimal("0.00")
    nb = ventes.count()
    return ca, nb


def _panier_moyen(ca, nb):
    if not nb:
        return Decimal("0.00")
    return (ca / nb).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# ============================================================
# GET /api/rapports/jour/
# ============================================================

def rapport_jour(date):
    debut, fin = plage_du_jour(date)
    ventes = Vente.objects.filter(date_vente__gte=debut, date_vente__lt=fin)
    ca_total, nb_ventes = _stats_jour(date)

    encaissements = (
        ventes.values("mode_paiement")
        .annotate(total=Sum("montant_total"), nb_ventes=Count("id"))
        .order_by("-total")
    )

    lignes = LigneVente.objects.filter(
        vente__date_vente__gte=debut, vente__date_vente__lt=fin
    )

    ca_par_categorie = (
        lignes.values("produit__categorie__nom")
        .annotate(ca=Sum(F("quantite") * F("prix_unitaire"),
                         output_field=CHAMP_MONTANT))
        .order_by("-ca")
    )

    top_produits = (
        lignes.values("produit", "produit__code", "produit__nom")
        .annotate(qte=Sum("quantite"))
        .order_by("-qte")[:3]
    )

    a_racheter = (
        Produit.objects.filter(stock__lte=F("seuil_alerte")).order_by("nom")
    )

    return {
        "date": date.isoformat(),
        "ca_total": _fmt(ca_total),
        "nb_ventes": nb_ventes,
        "panier_moyen": _fmt(_panier_moyen(ca_total, nb_ventes)),
        "encaissements_par_mode": [
            {
                "mode_paiement": e["mode_paiement"],
                "total": _fmt(e["total"]),
                "nb_ventes": e["nb_ventes"],
            }
            for e in encaissements
        ],
        "ca_par_categorie": [
            {"categorie": c["produit__categorie__nom"], "ca": _fmt(c["ca"])}
            for c in ca_par_categorie
        ],
        "top_produits": [
            {
                "produit": t["produit"],
                "code": t["produit__code"],
                "nom": t["produit__nom"],
                "qte": t["qte"],
            }
            for t in top_produits
        ],
        "produits_a_racheter": [
            {
                "produit": p.id,
                "code": p.code,
                "nom": p.nom,
                "stock": p.stock,
                "seuil_alerte": p.seuil_alerte,
                "en_rupture": p.stock == 0,
            }
            for p in a_racheter
        ],
    }


# ============================================================
# GET /api/rapports/tableau-de-bord/
# ============================================================

def tableau_de_bord(date):
    debut_semaine = date - timedelta(days=6)
    debut, fin_semaine = plage_depuis(debut_semaine, date)

    auj_ca, auj_nb = _stats_jour(date)
    hier_ca, hier_nb = _stats_jour(date - timedelta(days=1))

    serie = []
    for i in range(7):
        jour = debut_semaine + timedelta(days=i)
        ca, nb = _stats_jour(jour)
        serie.append({
            "date": jour.isoformat(),
            "ca": _fmt(ca),
            "nb_ventes": nb,
        })

    top_semaine = (
        LigneVente.objects.filter(
            vente__date_vente__gte=debut, vente__date_vente__lt=fin_semaine
        )
        .values("produit", "produit__code", "produit__nom")
        .annotate(qte=Sum("quantite"))
        .order_by("-qte")[:5]
    )

    stock = Produit.objects.aggregate(
        nb_produits=Count("id"),
        nb_en_alerte=Count("id", filter=Q(stock__lte=F("seuil_alerte"))),
        nb_en_rupture=Count("id", filter=Q(stock=0)),
        valeur_stock=Sum(
            F("prix_unitaire") * F("stock"), output_field=CHAMP_MONTANT
        ),
    )

    dernieres = Vente.objects.order_by("-date_vente")[:5]

    return {
        "date": date.isoformat(),
        "aujourdhui": {
            "ca": _fmt(auj_ca),
            "nb_ventes": auj_nb,
            "panier_moyen": _fmt(_panier_moyen(auj_ca, auj_nb)),
        },
        "hier": {
            "ca": _fmt(hier_ca),
            "nb_ventes": hier_nb,
        },
        "serie_7_jours": serie,
        "top_produits_semaine": [
            {
                "produit": t["produit"],
                "code": t["produit__code"],
                "nom": t["produit__nom"],
                "qte": t["qte"],
            }
            for t in top_semaine
        ],
        "stock": {
            "nb_produits": stock["nb_produits"],
            "nb_en_alerte": stock["nb_en_alerte"],
            "nb_en_rupture": stock["nb_en_rupture"],
            "valeur_stock": _fmt(stock["valeur_stock"]),
        },
        "dernieres_ventes": [
            {
                "id": v.id,
                "date_vente": v.date_vente.isoformat(),
                "montant_total": _fmt(v.montant_total),
                "mode_paiement": v.mode_paiement,
            }
            for v in dernieres
        ],
    }
