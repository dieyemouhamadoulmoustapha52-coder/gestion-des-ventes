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
 * @typedef {'ESPECES'|'WAVE'|'ORANGE_MONEY'} ModePaiement
 */

/**
 * Mode de vente (conditionnement) — contrat « modes de vente ».
 * @typedef {Object} Conditionnement
 * @property {number|null} id `null` pour un Détail dérivé (produit sans mode enregistré)
 * @property {string} libelle unique par produit (insensible à la casse)
 * @property {number} facteur entier ≥ 1 — unités de base par mode (1 = Détail)
 * @property {number} prix_vente FCFA pour un mode entier, > 0
 * @property {string} code optionnel, sans espaces, MAJUSCULES, unique (aucun pour le Détail)
 * @property {boolean} est_detail exactement un mode de facteur 1
 * @property {boolean} actif mode retiré → false (jamais supprimé)
 * @property {number} ordre position dans la liste
 */

/**
 * @typedef {Object} Categorie
 * @property {number} id
 * @property {string} nom
 * @property {string} description
 */

/**
 * Produit normalisé (montants déjà convertis en number par l'adaptateur).
 * Champs du contrat + alias legacy des écrans non migrés.
 * @typedef {Object} Produit
 * @property {number} id
 * @property {string} code          SKU unique
 * @property {string} nom
 * @property {number} categorie     id de la catégorie
 * @property {string} categorie_nom libellé (dénormalisé, affichage)
 * @property {string} unite_base    ex. « bouteille » (30 caractères max)
 * @property {number} prix_achat    coût d'UNE unité de base (décimal, 2 chiffres)
 * @property {number} quantite      stock EN UNITÉS DE BASE
 * @property {number} seuil_alerte  en unités de base
 * @property {number} prix          prix du mode Détail (toujours synchronisé)
 * @property {Conditionnement[]} conditionnements
 * @property {boolean} est_en_alerte quantite <= seuil_alerte (dérivé)
 * @property {number} prix_unitaire @alias legacy = prix
 * @property {number} stock         @alias legacy = quantite
 * @property {number} seuil         @alias legacy = seuil_alerte
 */

/**
 * @typedef {Object} Vente       Version « légère » des listes (sans lignes)
 * @property {number} id
 * @property {string} date_vente  ISO 8601
 * @property {string} client_nom
 * @property {ModePaiement} mode_paiement
 * @property {number} montant_total normalisé
 * @property {number} total @alias legacy = montant_total (réponse POST du contrat)
 * @property {ModePaiement} moyen_paiement @alias legacy = mode_paiement
 */

/**
 * Ligne de vente : SNAPSHOT figé à la création (voir contrat).
 * Anciennes lignes : libellé « Détail », facteur 1, quantite_base = quantite.
 * @typedef {Object} LigneVente
 * @property {number} id
 * @property {number} produit
 * @property {string} produit_nom   dénormalisé (affichage)
 * @property {string} produit_code  dénormalisé (affichage)
 * @property {number|null} conditionnement id du mode (null = Détail)
 * @property {string} libelle       libellé du mode figé (« Carton », « Détail »)
 * @property {number} facteur       unités de base par mode figé
 * @property {number} prix_unitaire prix d'UN mode (figé)
 * @property {number} quantite      nombre de MODES vendus
 * @property {number} quantite_base quantite × facteur (unités de base)
 * @property {number|null} cout_unitaire_base coût d'unité de base figé
 * @property {number} total_ligne   prix_unitaire × quantite
 * @property {number} montant_ligne @alias legacy = total_ligne
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
 * @property {number} valeur_stock Σ prix_achat × quantite (stock immobilisé au coût), normalisé
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
