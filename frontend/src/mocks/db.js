/**
 * Base de données factice (état en mémoire) — MSW.
 * Fidèle à docs/API_CONTRACT.md et à modelisation_base_de_donnees.md :
 * les ventes baissent réellement les stocks, prix figés à la création.
 */

const now = new Date()
/** Date ISO du jour J+offset à H:M (heure locales) */
const isoAt = (dayOffset, h, m) => {
  const d = new Date(now)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export const MODES = ['ESPECES', 'WAVE', 'ORANGE_MONEY', 'CARTE']
export const MODE_LABELS = {
  ESPECES: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  CARTE: 'Carte',
}

/** Sérialiseur DecimalField → chaîne DRF ("15500.00") */
export const money = (n) => Number(n).toFixed(2)

export const state = {
  seq: { categorie: 4, produit: 10, vente: 7, ligne: 12 },
  categories: [
    { id: 1, nom: 'Épicerie', description: 'Alimentation de base' },
    { id: 2, nom: 'Boissons', description: 'Eaux, jus et rafraîchissements' },
    { id: 3, nom: 'Hygiène', description: 'Entretien et hygiène corporelle' },
  ],
  /** prix en FCFA entiers ; seuils_alerte choisis pour couvrir alerte + rupture */
  produits: [
    { id: 1, code: 'RIZ25', nom: 'Riz parfumé 25 kg', categorie: 1, prix: 15500, stock: 8, seuil: 4 },
    { id: 2, code: 'HUILE5', nom: 'Huile 5 L', categorie: 1, prix: 6200, stock: 4, seuil: 5 },
    { id: 3, code: 'SUCRE1', nom: 'Sucre 1 kg', categorie: 1, prix: 750, stock: 30, seuil: 10 },
    { id: 4, code: 'LAIT400', nom: 'Lait en poudre 400 g', categorie: 1, prix: 2750, stock: 10, seuil: 5 },
    { id: 5, code: 'CAFE', nom: 'Café Touba 250 g', categorie: 1, prix: 1200, stock: 15, seuil: 6 },
    { id: 6, code: 'BISSAP', nom: 'Jus de bissap 1 L', categorie: 2, prix: 1000, stock: 6, seuil: 4 },
    { id: 7, code: 'EAU15', nom: 'Eau minérale 1,5 L', categorie: 2, prix: 350, stock: 40, seuil: 10 },
    { id: 8, code: 'SAVON', nom: 'Savon de Marseille', categorie: 3, prix: 400, stock: 20, seuil: 5 },
    { id: 9, code: 'JAVEL', nom: 'Eau de Javel 1 L', categorie: 3, prix: 600, stock: 0, seuil: 3 },
  ],
  /** Historique fictif : ventes d'hier + d'aujourd'hui (pour historique & rapport) */
  ventes: [
    { id: 1, date_vente: isoAt(-1, 10, 12), client_nom: 'Fatou Ndiaye', mode_paiement: 'ESPECES', total: 1450 },
    { id: 2, date_vente: isoAt(-1, 16, 40), client_nom: 'Amina Fall', mode_paiement: 'WAVE', total: 16700 },
    { id: 3, date_vente: isoAt(0, 8, 5), client_nom: 'Moussa Ba', mode_paiement: 'ORANGE_MONEY', total: 6400 },
    { id: 4, date_vente: isoAt(0, 9, 47), client_nom: 'Awa Diop', mode_paiement: 'ESPECES', total: 6200 },
    { id: 5, date_vente: isoAt(0, 11, 20), client_nom: 'Cheikh Sarr', mode_paiement: 'ESPECES', total: 6250 },
    { id: 6, date_vente: isoAt(0, 12, 58), client_nom: 'Khady Mbaye', mode_paiement: 'WAVE', total: 4550 },
  ],
  lignes: [
    { id: 1, vente: 1, produit: 7, quantite: 2, prix: 350 },
    { id: 2, vente: 1, produit: 3, quantite: 1, prix: 750 },
    { id: 3, vente: 2, produit: 1, quantite: 1, prix: 15500 },
    { id: 4, vente: 2, produit: 8, quantite: 3, prix: 400 },
    { id: 5, vente: 3, produit: 6, quantite: 4, prix: 1000 },
    { id: 6, vente: 3, produit: 5, quantite: 2, prix: 1200 },
    { id: 7, vente: 4, produit: 2, quantite: 1, prix: 6200 },
    { id: 8, vente: 5, produit: 7, quantite: 10, prix: 350 },
    { id: 9, vente: 5, produit: 4, quantite: 1, prix: 2750 },
    { id: 10, vente: 6, produit: 3, quantite: 5, prix: 750 },
    { id: 11, vente: 6, produit: 8, quantite: 2, prix: 400 },
  ],
}

export const findCategorie = (id) => state.categories.find((c) => c.id === Number(id))
export const findProduit = (id) => state.produits.find((p) => p.id === Number(id))

export const serializeCategorie = (c) => ({
  id: c.id,
  nom: c.nom,
  description: c.description ?? '',
})

export const serializeProduit = (p) => ({
  id: p.id,
  code: p.code,
  nom: p.nom,
  categorie: p.categorie,
  categorie_nom: findCategorie(p.categorie)?.nom ?? '',
  prix_unitaire: money(p.prix),
  stock: p.stock,
  seuil_alerte: p.seuil,
  est_en_alerte: p.stock <= p.seuil,
})

export const serializeVente = (v) => ({
  id: v.id,
  date_vente: v.date_vente,
  client_nom: v.client_nom,
  mode_paiement: v.mode_paiement,
  montant_total: money(v.total),
})

export const serializeLigne = (l) => {
  const pr = findProduit(l.produit)
  return {
    id: l.id,
    produit: l.produit,
    produit_nom: pr?.nom ?? '',
    produit_code: pr?.code ?? '',
    quantite: l.quantite,
    prix_unitaire: money(l.prix),
    montant_ligne: money(l.quantite * l.prix),
  }
}

export const serializeVenteDetail = (v) => ({
  ...serializeVente(v),
  lignes: state.lignes.filter((l) => l.vente === v.id).map(serializeLigne),
})
