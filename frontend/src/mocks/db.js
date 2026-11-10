/**
 * Base de données factice (état en mémoire) — MSW.
 * Fidèle à docs/API_CONTRACT.md et à modelisation_base_de_donnees.md :
 * les ventes baissent réellement les stocks, prix figés à la création.
 *
 * Historique : 30 jours de ventes générées de façon déterministe (PRNG
 * mulberry32, graine fixe) à partir des produits du catalogue — cela alimente
 * le tableau de bord (série 7 jours, top semaine, dernières ventes).
 * Les stocks ci-dessous sont l'état COURANT : l'historique ne les modifie pas.
 */
import { dateDakar, decaleJours } from '../lib/dates.js'

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

/** Mode de paiement pondéré (Espèces majoritaire, comme en boutique). */
const pickMode = (rand) => {
  const r = rand()
  if (r < 0.45) return 'ESPECES'
  if (r < 0.75) return 'WAVE'
  if (r < 0.95) return 'ORANGE_MONEY'
  return 'CARTE'
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

export const MODES = ['ESPECES', 'WAVE', 'ORANGE_MONEY', 'CARTE']
export const MODE_LABELS = {
  ESPECES: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  CARTE: 'Carte',
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
 * Catalogue étendu orienté démonstration : mix alimentaire + matériels domestiques.
 * Les `seuil` permettent d’exercer plusieurs scénarios de stock bas/rupture
 * dans l’interface (alerte, rupture, dashboard, réapprovisionnement).
 */
const PRODUITS = [
  // Épicerie
  { id: 1, code: 'RIZ25', nom: 'Riz parfumé 25 kg', categorie: 1, prix: 15500, stock: 8, seuil: 5 },
  { id: 2, code: 'HUILE5', nom: 'Huile 5 L', categorie: 1, prix: 6200, stock: 4, seuil: 6 },
  { id: 3, code: 'SUCRE1', nom: 'Sucre 1 kg', categorie: 1, prix: 750, stock: 30, seuil: 12 },
  { id: 4, code: 'LAIT400', nom: 'Lait en poudre 400 g', categorie: 1, prix: 2750, stock: 10, seuil: 4 },
  { id: 5, code: 'CAFE', nom: 'Café Touba 250 g', categorie: 1, prix: 1200, stock: 15, seuil: 7 },
  { id: 6, code: 'GRAINS', nom: 'Grains de mil 5 kg', categorie: 1, prix: 3900, stock: 17, seuil: 8 },

  // Boissons
  { id: 7, code: 'BISSAP', nom: 'Jus de bissap 1 L', categorie: 2, prix: 1000, stock: 6, seuil: 8 },
  { id: 8, code: 'EAU15', nom: 'Eau minérale 1,5 L', categorie: 2, prix: 350, stock: 40, seuil: 15 },
  { id: 9, code: 'JUSOR', nom: 'Jus d’orange 1 L', categorie: 2, prix: 1200, stock: 23, seuil: 10 },
  { id: 10, code: 'COLA', nom: 'Boisson gazeuse 1,5 L', categorie: 2, prix: 1500, stock: 18, seuil: 9 },

  // Hygiène / entretien
  { id: 11, code: 'SAVON', nom: 'Savon de Marseille', categorie: 3, prix: 400, stock: 20, seuil: 9 },
  { id: 12, code: 'JAVEL', nom: 'Eau de Javel 1 L', categorie: 3, prix: 600, stock: 0, seuil: 3 },
  { id: 13, code: 'DETERG', nom: 'Détergent liquide 2 L', categorie: 3, prix: 1800, stock: 12, seuil: 5 },
  { id: 14, code: 'PAPIER', nom: 'Papier toilette 12 rouleaux', categorie: 3, prix: 2500, stock: 9, seuil: 4 },

  // Électroménager
  { id: 15, code: 'FAN', nom: 'Ventilateur de plafond', categorie: 4, prix: 24000, stock: 6, seuil: 3 },
  { id: 16, code: 'BLENDER', nom: 'Blender 1,5 L', categorie: 4, prix: 19500, stock: 9, seuil: 4 },
  { id: 17, code: 'PRESSE', nom: 'Cafetière électrique', categorie: 4, prix: 17500, stock: 5, seuil: 3 },
  { id: 18, code: 'LAMPE', nom: 'Lampe LED 9 W', categorie: 4, prix: 3200, stock: 14, seuil: 6 },

  // Bricolage
  { id: 19, code: 'VIS', nom: 'Lot de vis 100 pcs', categorie: 5, prix: 1200, stock: 25, seuil: 10 },
  { id: 20, code: 'SCIE', nom: 'Scie à métaux', categorie: 5, prix: 8500, stock: 7, seuil: 4 },
  { id: 21, code: 'CLAMP', nom: 'Pince universelle', categorie: 5, prix: 2800, stock: 13, seuil: 6 },
  { id: 22, code: 'NAS', nom: 'Nailon de fixation 3 mm', categorie: 5, prix: 1500, stock: 16, seuil: 8 },

  // Maison / décoration
  { id: 23, code: 'CADDY', nom: 'Caddy de rangement', categorie: 6, prix: 7500, stock: 8, seuil: 4 },
  { id: 24, code: 'TAPIS', nom: 'Tapis de salon 1,5 x 2 m', categorie: 6, prix: 32000, stock: 4, seuil: 2 },
  { id: 25, code: 'LAMPON', nom: 'Lampe de table', categorie: 6, prix: 6000, stock: 11, seuil: 5 },
  { id: 26, code: 'CORDE', nom: 'Corde à linge 20 m', categorie: 6, prix: 2100, stock: 18, seuil: 7 },
]

const HISTO = genererHistorique(PRODUITS)

export const state = {
  seq: { categorie: 7, produit: 27, vente: HISTO.seqVente, ligne: HISTO.seqLigne },
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
