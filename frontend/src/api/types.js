/**
 * Formes de données du contrat d'API — voir docs/API_CONTRACT.md.
 * Les champs « brut » (DRF) portent les montants en chaîne Decimal ;
 * les objets exposés par src/api/ sont normalisés (montants → number via lib/money).
 *
 * @module api/types
 */

/**
 * Mode de paiement (enum Django ModePaiement).
 * L'écran de caisse n'utilise que les 3 premiers.
 * @typedef {'ESPECES'|'WAVE'|'ORANGE_MONEY'|'CARTE'} ModePaiement
 */

/**
 * @typedef {Object} Categorie
 * @property {number} id
 * @property {string} nom
 * @property {string} description
 */

/**
 * Produit normalisé (prix_unitaire déjà converti en number).
 * @typedef {Object} Produit
 * @property {number} id
 * @property {string} code          SKU unique
 * @property {string} nom
 * @property {number} categorie     id de la catégorie
 * @property {string} categorie_nom libellé (dénormalisé, affichage)
 * @property {number} prix_unitaire FCFA (normalisé)
 * @property {number} stock
 * @property {number} seuil_alerte
 * @property {boolean} est_en_alerte stock <= seuil_alerte (dérivé côté serveur)
 */

/**
 * @typedef {Object} Vente       Version « légère » des listes (sans lignes)
 * @property {number} id
 * @property {string} date_vente  ISO 8601
 * @property {string} client_nom
 * @property {ModePaiement} mode_paiement
 * @property {number} montant_total normalisé
 */

/**
 * @typedef {Object} LigneVente
 * @property {number} id
 * @property {number} produit
 * @property {string} produit_nom
 * @property {string} produit_code
 * @property {number} quantite
 * @property {number} prix_unitaire figé au moment T, normalisé
 * @property {number} montant_ligne normalisé
 */

/**
 * @typedef {Vente & {lignes: LigneVente[]}} VenteComplete
 */

/**
 * @typedef {Object} EncaissementMode
 * @property {ModePaiement} mode_paiement
 * @property {number} total    normalisé
 * @property {number} nb_ventes
 */

/**
 * @typedef {Object} CaCategorie
 * @property {string} categorie nom
 * @property {number} ca        normalisé
 */

/**
 * @typedef {Object} TopProduit
 * @property {number} produit
 * @property {string} code
 * @property {string} nom
 * @property {number} qte
 */

/**
 * @typedef {Object} ProduitARacheter
 * @property {number} produit
 * @property {string} code
 * @property {string} nom
 * @property {number} stock
 * @property {number} seuil_alerte
 * @property {boolean} en_rupture stock === 0
 */

/**
 * @typedef {Object} RapportJour
 * @property {string} date YYYY-MM-DD
 * @property {number} ca_total
 * @property {number} nb_ventes
 * @property {number} panier_moyen
 * @property {EncaissementMode[]} encaissements_par_mode
 * @property {CaCategorie[]} ca_par_categorie
 * @property {TopProduit[]} top_produits
 * @property {ProduitARacheter[]} produits_a_racheter
 */

/**
 * Jour de la série glissante du tableau de bord.
 * @typedef {Object} JourSerie
 * @property {string} date YYYY-MM-DD
 * @property {number} ca normalisé
 * @property {number} nb_ventes
 */

/**
 * Vente résumée du tableau de bord (4 champs exactement, sans lignes).
 * @typedef {Object} VenteResume
 * @property {number} id
 * @property {string} date_vente ISO 8601
 * @property {number} montant_total normalisé
 * @property {ModePaiement} mode_paiement
 */

/**
 * État instantané des stocks (tableau de bord).
 * @typedef {Object} EtatStock
 * @property {number} nb_produits
 * @property {number} nb_en_alerte produits avec est_en_alerte (ruptures incluses)
 * @property {number} nb_en_rupture stock === 0 (sous-ensemble)
 * @property {number} valeur_stock Σ prix × stock, normalisé
 */

/**
 * @typedef {Object} TableauDeBord
 * @property {string} date YYYY-MM-DD interrogée
 * @property {{ca: number, nb_ventes: number, panier_moyen: number}} aujourdhui
 * @property {{ca: number, nb_ventes: number}} hier
 * @property {JourSerie[]} serie_7_jours 7 jours chronologiques finissant à date
 * @property {TopProduit[]} top_produits_semaine max 5, fenêtre 7 jours
 * @property {EtatStock} stock
 * @property {VenteResume[]} dernieres_ventes 5 dernières ventes globales (sans filtre date)
 */

/**
 * Enveloppe de pagination DRF.
 * @template T
 * @typedef {Object} Page
 * @property {number} count
 * @property {string|null} next
 * @property {string|null} previous
 * @property {T[]} results
 */

/**
 * Corps d'erreur 400 DRF : clé = champ, valeur = messages.
 * @typedef {Object} FieldErrors
 * @property {string[]} [champ] …
 */

export {}
