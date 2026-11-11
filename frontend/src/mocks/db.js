/**
 * Base de données factice (état en mémoire) — MSW.
 * Contrat « modes de vente » : UN stock par produit en unités de base
 * (`quantite`), prix du Détail dans `prix`, coût d'unité dans `prix_achat`,
 * modes dans `conditionnements[]`. Les ventes baissent réellement les stocks,
 * prix et mode figés à la création (snapshots).
 *
 * Historique : 30 jours de ventes générées de façon déterministe (PRNG
 * mulberry32, graine fixe) à partir des produits du catalogue — cela alimente
 * le tableau de bord (série 7 jours, top semaine, dernières ventes).
 * Les stocks ci-dessous sont l'état COURANT : l'historique ne les modifie pas.
 * Les lignes d'historique sont de l'ancien format (sans snapshot) : le
 * sérialiseur les normalise (« Détail », facteur 1, quantite_base = quantite).
 */
import { dateDakar, decaleJours } from '../lib/dates.js'
import { normaliserProduit } from '../lib/conditionnements.js'

/** PRNG déterministe (mulberry32) : même séquence à chaque chargement. */
function mulberry32(seed) {
  let a = seed
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Noms de clients pour l'historique (30 % des ventes sans nom). */
const CLIENTS = [
  'Fatou Ndiaye', 'Amina Fall', 'Moussa Ba', 'Awa Diop',
  'Cheikh Sarr', 'Khady Mbaye', 'Ibrahima Sow', 'Ndèye Gueye',
  'Mamadou Cissé', 'Aïssatou Diop', 'Ousmane Diallo', 'Mariama Sy',
]

/** Mode de paiement pondéré (Espèces majoritaire, comme en boutique).
 *  Pas de Carte : la caisse n'expose pas ce mode. */
const pickMode = (rand) => {
  const r = rand()
  if (r < 0.5) return 'ESPECES'
  if (r < 0.8) return 'WAVE'
  return 'ORANGE_MONEY'
}

/**
 * Génère 30 jours de ventes (du plus ancien à aujourd'hui) cohérentes avec
 * `produits` : prix du catalogue figés, quantités 1-3, heures d'ouverture
 * (8 h–19 h), **jamais de vente dans le futur** (aujourd'hui borné à l'heure
 * courante), dimanches plus calmes.
 * @param {Array} produits catalogue (ids uniques)
 * @returns {{ventes: Array, lignes: Array, seqVente: number, seqLigne: number}}
 */
function genererHistorique(produits) {
  const rand = mulberry32(0x20261104) // graine fixe → données déterministes
  const ventes = []
  const lignes = []
  let idVente = 1
  let idLigne = 1
  const todayStr = dateDakar()
  const nowMs = Date.now()

  for (let offset = -29; offset <= 0; offset++) {
    const jour = decaleJours(todayStr, offset)
    const [Y, M, D] = jour.split('-').map(Number)
    const dow = new Date(Date.UTC(Y, M - 1, D)).getUTCDay() // 0 = dimanche
    let nb = 4 + Math.floor(rand() * 5) // 4 à 8 ventes
    if (dow === 0) nb = 2 + Math.floor(rand() * 3) // dimanche : 2 à 4

    // Créneaux du jour (heure locale = UTC pour Dakar), triés chronologiquement
    const creneaux = []
    for (let i = 0; i < nb; i++) {
      const h = 8 + Math.floor(rand() * 12) // 8 h → 19 h
      const m = Math.floor(rand() * 60)
      const ts = Date.UTC(Y, M - 1, D, h, m)
      if (ts > nowMs) continue // aucune vente dans le futur
      creneaux.push(ts)
    }
    creneaux.sort((a, b) => a - b)

    for (const ts of creneaux) {
      const mode = pickMode(rand)
      const client = rand() < 0.3 ? '' : CLIENTS[Math.floor(rand() * CLIENTS.length)]
      const nbLignes = Math.min(1 + Math.floor(rand() * 3), produits.length) // 1 à 3 produits distincts
      const picks = new Set()
      while (picks.size < nbLignes) picks.add(produits[Math.floor(rand() * produits.length)])

      const vente = {
        id: idVente,
        date_vente: new Date(ts).toISOString(),
        client_nom: client,
        mode_paiement: mode,
        total: 0,
      }
      let total = 0
      for (const p of picks) {
        const qte = 1 + Math.floor(rand() * 3) // 1 à 3
        lignes.push({ id: idLigne++, vente: idVente, produit: p.id, quantite: qte, prix: p.prix })
        total += qte * p.prix
      }
      vente.total = total
      ventes.push(vente)
      idVente += 1
    }
  }
  return { ventes, lignes, seqVente: idVente, seqLigne: idLigne }
}

export const MODES = ['ESPECES', 'WAVE', 'ORANGE_MONEY']
export const MODE_LABELS = {
  ESPECES: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
}

/** Sérialiseur DecimalField → chaîne DRF ("15500.00") */
export const money = (n) => Number(n).toFixed(2)

const CATEGORIES = [
  { id: 1, nom: 'Épicerie', description: 'Alimentation de base et essentiels du foyer' },
  { id: 2, nom: 'Boissons', description: 'Eaux, jus et boissons de maison' },
  { id: 3, nom: 'Hygiène', description: 'Produits d’entretien et nettoyage' },
  { id: 4, nom: 'Électroménager', description: 'Petit électroménager pour la maison' },
  { id: 5, nom: 'Bricolage', description: 'Quincaillerie, outils et fixation' },
  { id: 6, nom: 'Maison', description: 'Décoration, rangement et confort domestique' },
]

/**
 * Catalogue orienté démonstration. Champs du contrat :
 * `unite_base`, `prix_achat` (coût d'UNE unité de base), `quantite` (stock en
 * unités de base), `seuil_alerte`, `prix` (mode Détail) et, pour la démo des
 * conditionnements, `conditionnements` sur COLA / EAU15 / SAVON. Les autres
 * produits n'ont pas de modes enregistrés : la lecture dérive un Détail de `prix`.
 * Les `seuil_alerte` permettent d’exercer stock bas / rupture dans l’interface.
 */
const PRODUITS = [
  // Épicerie
  { id: 1, code: 'RIZ25', nom: 'Riz parfumé 25 kg', categorie: 1, unite_base: 'sac', prix_achat: 13000, prix: 15500, quantite: 8, seuil_alerte: 5 },
  { id: 2, code: 'HUILE5', nom: 'Huile 5 L', categorie: 1, unite_base: 'unité', prix_achat: 5200, prix: 6200, quantite: 4, seuil_alerte: 6 },
  { id: 3, code: 'SUCRE1', nom: 'Sucre 1 kg', categorie: 1, unite_base: 'sachet', prix_achat: 620, prix: 750, quantite: 30, seuil_alerte: 12 },
  { id: 4, code: 'LAIT400', nom: 'Lait en poudre 400 g', categorie: 1, unite_base: 'boîte', prix_achat: 2300, prix: 2750, quantite: 10, seuil_alerte: 4 },
  { id: 5, code: 'CAFE', nom: 'Café Touba 250 g', categorie: 1, unite_base: 'boîte', prix_achat: 980, prix: 1200, quantite: 15, seuil_alerte: 7 },
  { id: 6, code: 'GRAINS', nom: 'Grains de mil 5 kg', categorie: 1, unite_base: 'sac', prix_achat: 3200, prix: 3900, quantite: 17, seuil_alerte: 8 },

  // Boissons
  { id: 7, code: 'BISSAP', nom: 'Jus de bissap 1 L', categorie: 2, unite_base: 'bouteille', prix_achat: 800, prix: 1000, quantite: 6, seuil_alerte: 8 },
  { id: 8, code: 'EAU15', nom: 'Eau minérale 1,5 L', categorie: 2, unite_base: 'bouteille', prix_achat: 250, prix: 350, quantite: 40, seuil_alerte: 15,
    conditionnements: [
      { id: 4, libelle: 'Détail', facteur: 1, prix_vente: 350, code: '', est_detail: true, actif: true, ordre: 0 },
      { id: 5, libelle: 'Pack', facteur: 6, prix_vente: 1900, code: 'EAU6', est_detail: false, actif: true, ordre: 1 },
    ] },
  { id: 9, code: 'JUSOR', nom: 'Jus d’orange 1 L', categorie: 2, unite_base: 'bouteille', prix_achat: 950, prix: 1200, quantite: 23, seuil_alerte: 10 },
  { id: 10, code: 'COLA', nom: 'Boisson gazeuse 1,5 L', categorie: 2, unite_base: 'bouteille', prix_achat: 1083.33, prix: 1500, quantite: 30, seuil_alerte: 9,
    conditionnements: [
      { id: 1, libelle: 'Détail', facteur: 1, prix_vente: 1500, code: '', est_detail: true, actif: true, ordre: 0 },
      { id: 2, libelle: 'Demi-carton', facteur: 6, prix_vente: 8000, code: 'COLA6', est_detail: false, actif: true, ordre: 1 },
      { id: 3, libelle: 'Carton', facteur: 12, prix_vente: 15000, code: 'COLA12', est_detail: false, actif: true, ordre: 2 },
    ] },

  // Hygiène / entretien
  { id: 11, code: 'SAVON', nom: 'Savon de Marseille', categorie: 3, unite_base: 'pièce', prix_achat: 300, prix: 400, quantite: 20, seuil_alerte: 9,
    conditionnements: [
      { id: 6, libelle: 'Détail', facteur: 1, prix_vente: 400, code: '', est_detail: true, actif: true, ordre: 0 },
      { id: 7, libelle: 'Carton', facteur: 24, prix_vente: 8500, code: 'SAVON24', est_detail: false, actif: true, ordre: 1 },
    ] },
  { id: 12, code: 'JAVEL', nom: 'Eau de Javel 1 L', categorie: 3, unite_base: 'bouteille', prix_achat: 480, prix: 600, quantite: 0, seuil_alerte: 3 },
  { id: 13, code: 'DETERG', nom: 'Détergent liquide 2 L', categorie: 3, unite_base: 'bouteille', prix_achat: 1450, prix: 1800, quantite: 12, seuil_alerte: 5 },
  { id: 14, code: 'PAPIER', nom: 'Papier toilette 12 rouleaux', categorie: 3, unite_base: 'paquet', prix_achat: 2000, prix: 2500, quantite: 9, seuil_alerte: 4 },

  // Électroménager
  { id: 15, code: 'FAN', nom: 'Ventilateur de plafond', categorie: 4, unite_base: 'pièce', prix_achat: 19500, prix: 24000, quantite: 6, seuil_alerte: 3 },
  { id: 16, code: 'BLENDER', nom: 'Blender 1,5 L', categorie: 4, unite_base: 'pièce', prix_achat: 16000, prix: 19500, quantite: 9, seuil_alerte: 4 },
  { id: 17, code: 'PRESSE', nom: 'Cafetière électrique', categorie: 4, unite_base: 'pièce', prix_achat: 14000, prix: 17500, quantite: 5, seuil_alerte: 3 },
  { id: 18, code: 'LAMPE', nom: 'Lampe LED 9 W', categorie: 4, unite_base: 'pièce', prix_achat: 2600, prix: 3200, quantite: 14, seuil_alerte: 6 },

  // Bricolage
  { id: 19, code: 'VIS', nom: 'Lot de vis 100 pcs', categorie: 5, unite_base: 'pièce', prix_achat: 950, prix: 1200, quantite: 25, seuil_alerte: 10 },
  { id: 20, code: 'SCIE', nom: 'Scie à métaux', categorie: 5, unite_base: 'pièce', prix_achat: 7000, prix: 8500, quantite: 7, seuil_alerte: 4 },
  { id: 21, code: 'CLAMP', nom: 'Pince universelle', categorie: 5, unite_base: 'pièce', prix_achat: 2250, prix: 2800, quantite: 13, seuil_alerte: 6 },
  { id: 22, code: 'NAS', nom: 'Nailon de fixation 3 mm', categorie: 5, unite_base: 'pièce', prix_achat: 1200, prix: 1500, quantite: 16, seuil_alerte: 8 },

  // Maison / décoration
  { id: 23, code: 'CADDY', nom: 'Caddy de rangement', categorie: 6, unite_base: 'pièce', prix_achat: 6100, prix: 7500, quantite: 8, seuil_alerte: 4 },
  { id: 24, code: 'TAPIS', nom: 'Tapis de salon 1,5 x 2 m', categorie: 6, unite_base: 'pièce', prix_achat: 26500, prix: 32000, quantite: 4, seuil_alerte: 2 },
  { id: 25, code: 'LAMPON', nom: 'Lampe de table', categorie: 6, unite_base: 'pièce', prix_achat: 4900, prix: 6000, quantite: 11, seuil_alerte: 5 },
  { id: 26, code: 'CORDE', nom: 'Corde à linge 20 m', categorie: 6, unite_base: 'pièce', prix_achat: 1700, prix: 2100, quantite: 18, seuil_alerte: 7 },
]

const HISTO = genererHistorique(PRODUITS)

export const state = {
  seq: { categorie: 7, produit: 27, vente: HISTO.seqVente, ligne: HISTO.seqLigne, conditionnement: 8 },
  categories: CATEGORIES,
  produits: PRODUITS,
  ventes: HISTO.ventes,
  lignes: HISTO.lignes,
}

export const findCategorie = (id) => state.categories.find((c) => c.id === Number(id))
export const findProduit = (id) => state.produits.find((p) => p.id === Number(id))

export const serializeCategorie = (c) => ({
  id: c.id,
  nom: c.nom,
  description: c.description ?? '',
})

/**
 * Mode de vente → contrat (DecimalField en chaîne, cf. `money`).
 * @param {import('../lib/conditionnements.js').Conditionnement} m
 */
export const serializeConditionnement = (m) => ({
  id: m.id ?? null,
  libelle: m.libelle,
  facteur: m.facteur,
  prix_vente: money(m.prix_vente),
  code: m.code ?? '',
  est_detail: m.est_detail === true,
  actif: m.actif !== false,
  ordre: m.ordre ?? 0,
})

/**
 * Produit → contrat : champs du contrat + dénormalisations d'affichage
 * (`categorie_nom`, `est_en_alerte`). Un produit sans `conditionnements`
 * reçoit un Détail dérivé de `prix` (normaliserProduit).
 * @param {any} p
 */
export const serializeProduit = (p) => {
  const n = normaliserProduit(p)
  return {
    id: n.id,
    code: n.code,
    nom: n.nom,
    categorie: n.categorie,
    categorie_nom: findCategorie(n.categorie)?.nom ?? '',
    unite_base: n.unite_base,
    prix_achat: money(n.prix_achat),
    quantite: n.quantite,
    seuil_alerte: n.seuil_alerte,
    prix: money(n.prix),
    conditionnements: n.conditionnements.map(serializeConditionnement),
    est_en_alerte: n.quantite <= n.seuil_alerte,
  }
}

export const serializeVente = (v) => ({
  id: v.id,
  date_vente: v.date_vente,
  client_nom: v.client_nom,
  mode_paiement: v.mode_paiement,
  montant_total: money(v.total),
})

/**
 * Ligne de vente → contrat avec SNAPSHOT complet.
 * Anciennes lignes (historique) : libellé « Détail », facteur 1,
 * `quantite_base = quantite`, coût d'achat courant du produit.
 * @param {any} l
 */
export const serializeLigne = (l) => {
  const pr = findProduit(l.produit)
  const facteur = Number.isInteger(l.facteur) ? l.facteur : 1
  const quantite = Number(l.quantite) || 0
  const prixVente = Number(l.prix) || 0
  const estDetail = l.est_detail ?? facteur === 1
  const total = Number.isFinite(Number(l.total_ligne))
    ? Number(l.total_ligne)
    : quantite * prixVente
  const cout =
    l.cout_unitaire_base !== undefined && l.cout_unitaire_base !== null
      ? Number(l.cout_unitaire_base)
      : pr?.prix_achat
  return {
    id: l.id,
    produit: l.produit,
    produit_nom: pr?.nom ?? '',
    produit_code: pr?.code ?? '',
    conditionnement: l.conditionnement ?? null,
    libelle: l.libelle ?? (estDetail ? 'Détail' : `×${facteur}`),
    facteur,
    est_detail: estDetail,
    prix_unitaire: money(prixVente),
    quantite,
    quantite_base: Number.isInteger(l.quantite_base) ? l.quantite_base : quantite * facteur,
    cout_unitaire_base: cout === undefined || cout === null || Number.isNaN(cout) ? null : money(cout),
    total_ligne: money(total),
    // @alias legacy (API historique)
    montant_ligne: money(total),
  }
}

export const serializeVenteDetail = (v) => ({
  ...serializeVente(v),
  lignes: state.lignes.filter((l) => l.vente === v.id).map(serializeLigne),
})

/**
 * Nouveau Détail (facteur 1, aucun code) — utilisé à la création de produit
 * et pour maintenir un Détail à partir de `prix` (ancien format).
 * @param {number} prix prix du mode Détail
 * @param {number|null} [id]
 */
export const nouveauDetail = (prix, id = null) => ({
  id,
  libelle: 'Détail',
  facteur: 1,
  prix_vente: Number(prix) || 0,
  code: '',
  est_detail: true,
  actif: true,
  ordre: 0,
})

/** Tous les modes de vente de tous les produits (id → {produit, mode}). */
export function tousLesModes() {
  const sortie = []
  for (const p of state.produits) {
    for (const m of p.conditionnements ?? []) sortie.push({ produit: p, mode: m })
  }
  return sortie
}
