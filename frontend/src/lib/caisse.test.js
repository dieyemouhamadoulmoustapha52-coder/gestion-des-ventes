import { describe, expect, it } from 'vitest'
import { calculerMonnaie, filtrerProduits, resoudreCodeMode, topVendus } from './caisse.js'

describe('calculerMonnaie', () => {
  it('champ vide → statut vide (encaissement autorisé)', () => {
    expect(calculerMonnaie(1500, '')).toEqual({ statut: 'vide', monnaie: 0, manque: 0 })
    expect(calculerMonnaie(1500, null)).toEqual({ statut: 'vide', monnaie: 0, manque: 0 })
    expect(calculerMonnaie(1500, undefined)).toEqual({ statut: 'vide', monnaie: 0, manque: 0 })
    expect(calculerMonnaie(1500, '   ')).toEqual({ statut: 'vide', monnaie: 0, manque: 0 })
  })

  it('montant reçu > total → monnaie à rendre', () => {
    expect(calculerMonnaie(1500, 2000)).toEqual({ statut: 'ok', monnaie: 500, manque: 0 })
    expect(calculerMonnaie(1500, '2000')).toEqual({ statut: 'ok', monnaie: 500, manque: 0 })
  })

  it('montant reçu exact → monnaie 0', () => {
    expect(calculerMonnaie(1500, 1500)).toEqual({ statut: 'ok', monnaie: 0, manque: 0 })
  })

  it('montant reçu insuffisant → manque', () => {
    expect(calculerMonnaie(1500, 1000)).toEqual({ statut: 'insuffisant', monnaie: 0, manque: 500 })
    expect(calculerMonnaie(1500, '1200')).toEqual({ statut: 'insuffisant', monnaie: 0, manque: 300 })
  })

  it('accepte les espaces et la virgule décimale', () => {
    expect(calculerMonnaie(1500, '2 000')).toEqual({ statut: 'ok', monnaie: 500, manque: 0 })
    expect(calculerMonnaie(1500, '1500,50')).toEqual({ statut: 'ok', monnaie: 0.5, manque: 0 })
  })

  it('valeur non numérique → vide', () => {
    expect(calculerMonnaie(1500, 'abc')).toEqual({ statut: 'vide', monnaie: 0, manque: 0 })
  })
})

describe('filtrerProduits', () => {
  const produits = [
    { id: 1, nom: 'Riz parfumé 25 kg', code: 'RIZ25' },
    { id: 2, nom: 'Huile 5 L', code: 'HUILE5' },
    { id: 3, nom: 'Jus d’orange 1 L', code: 'JUSOR' },
  ]

  it('terme vide → aucun résultat', () => {
    expect(filtrerProduits(produits, '')).toEqual([])
    expect(filtrerProduits(produits, '  ')).toEqual([])
  })

  it('filtre par nom, insensible casse et accents', () => {
    expect(filtrerProduits(produits, 'riz').map((p) => p.id)).toEqual([1])
    expect(filtrerProduits(produits, 'RIZ').map((p) => p.id)).toEqual([1])
    expect(filtrerProduits(produits, 'orange').map((p) => p.id)).toEqual([3])
    expect(filtrerProduits(produits, 'ORANGE').map((p) => p.id)).toEqual([3])
  })

  it('filtre par référence (code)', () => {
    expect(filtrerProduits(produits, 'huile5').map((p) => p.id)).toEqual([2])
    expect(filtrerProduits(produits, 'JUSOR').map((p) => p.id)).toEqual([3])
  })

  it('conserve l’ordre d’origine et gère le tableau vide', () => {
    expect(filtrerProduits([], 'riz')).toEqual([])
    expect(filtrerProduits(produits, 'l').map((p) => p.id)).toEqual([2, 3])
  })

  it('filtre aussi sur les codes de mode (COLA12 remonte le produit)', () => {
    const cola = {
      id: 10,
      nom: 'Coca-Cola 1,5 L',
      code: 'COLA',
      conditionnements: [
        { id: 1, libelle: 'Détail', code: '', facteur: 1 },
        { id: 6, libelle: 'Demi-carton', code: 'COLA6', facteur: 6 },
        { id: 3, libelle: 'Carton', code: 'COLA12', facteur: 12 },
      ],
    }
    const eau = { id: 11, nom: 'Eau minérale', code: 'EAU', conditionnements: [] }
    expect(filtrerProduits([cola, eau], 'cola12').map((p) => p.id)).toEqual([10])
    expect(filtrerProduits([cola, eau], 'COLA6').map((p) => p.id)).toEqual([10])
    // produit sans conditionnements : pas d'erreur, filtrage nominal
    expect(filtrerProduits([eau], 'EAU').map((p) => p.id)).toEqual([11])
    expect(filtrerProduits([{ id: 1, nom: 'X', code: 'X' }], 'COLA12')).toEqual([])
  })
})

describe('resoudreCodeMode', () => {
  const cola = {
    id: 10,
    nom: 'Coca-Cola 1,5 L',
    code: 'COLA',
    conditionnements: [
      { id: 1, libelle: 'Détail', code: '', facteur: 1 },
      { id: 6, libelle: 'Demi-carton', code: 'COLA6', facteur: 6 },
      { id: 3, libelle: 'Carton', code: 'COLA12', facteur: 12 },
    ],
  }
  const eau = { id: 11, nom: 'Eau minérale', code: 'EAU', conditionnements: [] }

  it('code exact → produit + mode correspondant (casse et espaces ignorés)', () => {
    const attendu = { produit: cola, mode: cola.conditionnements[2] }
    expect(resoudreCodeMode([cola, eau], 'COLA12')).toEqual(attendu)
    expect(resoudreCodeMode([cola], ' cola12 ')).toEqual(attendu)
    expect(resoudreCodeMode([cola], 'cola6')).toEqual({
      produit: cola,
      mode: cola.conditionnements[1],
    })
  })

  it('code partiel, vide ou inconnu → null (le code produit ne répond pas)', () => {
    expect(resoudreCodeMode([cola], 'COLA')).toBeNull()
    expect(resoudreCodeMode([cola], '')).toBeNull()
    expect(resoudreCodeMode([cola], '   ')).toBeNull()
    expect(resoudreCodeMode([cola], 'COLA24')).toBeNull()
    expect(resoudreCodeMode([], 'COLA12')).toBeNull()
  })

  it('le mode Détail (code vide) n’est jamais résolu par code', () => {
    expect(resoudreCodeMode([cola], 'detail')).toBeNull()
    expect(resoudreCodeMode([cola], '')).toBeNull()
  })

  it('produit sans conditionnements → null', () => {
    expect(resoudreCodeMode([eau], 'EAU')).toBeNull()
    expect(resoudreCodeMode([eau], 'COLA12')).toBeNull()
  })
})

describe('topVendus', () => {
  const ventes = [
    { lignes: [{ produit: 1, quantite: 2 }, { produit: 2, quantite: 1 }] },
    { lignes: [{ produit: 1, quantite: 3 }] },
    { lignes: [{ produit: 3, quantite: 5 }] },
    { lignes: [] },
    {},
  ]

  it('agrège les quantités par produit, tri décroissant', () => {
    expect(topVendus(ventes, 8)).toEqual([
      { produit: 1, quantite: 5 },
      { produit: 3, quantite: 5 },
      { produit: 2, quantite: 1 },
    ])
  })

  it('borne au top N (8 en caisse)', () => {
    const nombreux = Array.from({ length: 20 }, (_, i) => ({
      lignes: [{ produit: i + 1, quantite: 20 - i }],
    }))
    expect(topVendus(nombreux, 8)).toHaveLength(8)
    expect(topVendus(nombreux, 8)[0]).toEqual({ produit: 1, quantite: 20 })
  })

  it('classe en unités de base (2 cartons ×12 = 24)', () => {
    const ventesModes = [
      { lignes: [{ produit: 1, quantite: 2, facteur: 12, quantite_base: 24 }] },
      { lignes: [{ produit: 2, quantite: 3, facteur: 1 }] },
    ]
    expect(topVendus(ventesModes, 8)).toEqual([
      { produit: 1, quantite: 24 },
      { produit: 2, quantite: 3 },
    ])
  })

  it('sans ventes → tableau vide', () => {
    expect(topVendus([], 8)).toEqual([])
    expect(topVendus(null, 8)).toEqual([])
  })
})
