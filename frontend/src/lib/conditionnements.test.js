import { describe, expect, it } from 'vitest'
import {
  besoinParProduit,
  coutParUnite,
  disponibleEnMode,
  formaterStock,
  libelleLigneMode,
  optionModeLabel,
  margeMode,
  maxQuantiteLigne,
  normaliserProduit,
  prixParUnite,
  quantiteBase,
  remiseVsDetail,
  validerConditionnements,
} from './conditionnements.js'

/** Boisson gazeuse de l'exemple de référence : carton ×12 à 15 000. */
const carton = { id: 3, libelle: 'Carton', facteur: 12, prix_vente: 15000, code: 'COLA12', est_detail: false, actif: true, ordre: 2 }
const demi = { id: 2, libelle: 'Demi-carton', facteur: 6, prix_vente: 8000, code: 'COLA6', est_detail: false, actif: true, ordre: 1 }
const detail = { id: 1, libelle: 'Détail', facteur: 1, prix_vente: 1500, code: '', est_detail: true, actif: true, ordre: 0 }

describe('calculs de base', () => {
  it('quantiteBase cumule en unités de base', () => {
    expect(quantiteBase(2, 12)).toBe(24)
    expect(quantiteBase(3, 1)).toBe(3)
    expect(quantiteBase(0, 12)).toBe(0)
  })

  it('prixParUnite divise par le facteur (non arrondi)', () => {
    expect(prixParUnite(15000, 12)).toBe(1250)
    expect(prixParUnite(1900, 6)).toBeCloseTo(316.67, 2)
  })

  it('remiseVsDetail : positif = remise, négatif = plus cher que le détail', () => {
    // Carton 12 × 1 500 = 18 000 → 15 000 : remise de 3 000
    expect(remiseVsDetail(15000, 12, 1500)).toBe(3000)
    expect(remiseVsDetail(20000, 12, 1500)).toBe(-2000)
  })

  it('coutParUnite arrondit à 2 décimales', () => {
    expect(coutParUnite(13000, 12)).toBe(1083.33)
    expect(coutParUnite(13000, 1)).toBe(13000)
    expect(coutParUnite(6000, 6)).toBe(1000)
  })

  it('margeMode = prix du mode − coût des unités consommées', () => {
    expect(margeMode(15000, 12, 1083.33)).toBe(2000.04)
    expect(margeMode(1000, 1, 1500)).toBe(-500) // vente à perte
  })

  it('disponibleEnMode plafonne au mode entier', () => {
    expect(disponibleEnMode(30, 12)).toBe(2)
    expect(disponibleEnMode(11, 12)).toBe(0)
    expect(disponibleEnMode(0, 12)).toBe(0)
  })
})

describe('formaterStock', () => {
  it('« 30 · 2 cartons + 6 unités » de l’exemple de référence', () => {
    expect(formaterStock(30, [detail, demi, carton])).toBe('30 · 2 cartons + 6 unités')
  })

  it('stock exactement divisible → pas de reste', () => {
    expect(formaterStock(24, [detail, carton])).toBe('24 · 2 cartons')
  })

  it('singulier quand la quantité vaut 1', () => {
    expect(formaterStock(18, [detail, carton])).toBe('18 · 1 carton + 6 unités')
  })

  it('choisit le plus gros mode vendable (reste exprimé en unités)', () => {
    // 66 = 5 × 12 + 6 (aperçu du réapprovisionnement de l’énoncé)
    expect(formaterStock(66, [detail, demi, carton])).toBe('66 · 5 cartons + 6 unités')
    // 6 < carton → le demi-carton (×6) devient le plus gros mode vendable
    expect(formaterStock(6, [detail, demi, carton])).toBe('6 · 1 demi-carton')
  })

  it('sans mode (facteur ≥ 2) → unités seules', () => {
    expect(formaterStock(6, [detail])).toBe('6 unités')
    expect(formaterStock(1, [detail])).toBe('1 unité')
    expect(formaterStock(0, [detail])).toBe('0 unité')
  })

  it('ignore les modes inactifs', () => {
    expect(formaterStock(30, [detail, { ...carton, actif: false }])).toBe('30 unités')
  })
})

describe('normaliserProduit', () => {
  it('sans conditionnements → unite_base « unité » et Détail issu de prix', () => {
    const p = normaliserProduit({ id: 1, nom: 'Riz', prix: 15500, quantite: 8, seuil_alerte: 5 })
    expect(p.unite_base).toBe('unité')
    expect(p.conditionnements).toHaveLength(1)
    expect(p.conditionnements[0]).toMatchObject({
      id: null,
      libelle: 'Détail',
      facteur: 1,
      prix_vente: 15500,
      est_detail: true,
      actif: true,
      ordre: 0,
    })
  })

  it('accepte l’ancien format (prix_unitaire / stock)', () => {
    const p = normaliserProduit({ id: 2, prix_unitaire: '6200.00', stock: 4, seuil: 6 })
    expect(p.prix).toBe(6200)
    expect(p.quantite).toBe(4)
    expect(p.seuil_alerte).toBe(6)
    expect(p.conditionnements[0].prix_vente).toBe(6200)
  })

  it('conserve les modes existants, normalisés et triés par facteur', () => {
    const p = normaliserProduit({
      id: 10,
      prix: 1500,
      quantite: 30,
      conditionnements: [carton, detail, demi],
    })
    expect(p.conditionnements.map((m) => m.facteur)).toEqual([1, 6, 12])
    expect(p.conditionnements[0].prix_vente).toBe(1500)
  })

  it('ne mute pas l’entrée', () => {
    const brut = { id: 3, prix: 100 }
    normaliserProduit(brut)
    expect(brut.conditionnements).toBeUndefined()
  })
})

describe('validerConditionnements', () => {
  const valide = [
    { libelle: 'Détail', facteur: 1, prix_vente: 1500, est_detail: true, code: '' },
    { libelle: 'Carton', facteur: 12, prix_vente: 15000, est_detail: false, code: 'COLA12' },
  ]

  it('liste conforme → aucune erreur', () => {
    const res = validerConditionnements(valide, { codesOccupes: ['COLA'] })
    expect(res.global).toEqual([])
    expect(res.modes).toEqual([{}, {}])
  })

  it('exactement un mode est_detail de facteur 1', () => {
    const sans = validerConditionnements([valide[1]])
    expect(sans.global.join(' ')).toMatch(/détail/i)

    const deux = validerConditionnements([
      valide[0],
      { libelle: 'Autre', facteur: 1, prix_vente: 500, est_detail: true },
    ])
    expect(deux.global.join(' ')).toMatch(/un seul/i)
  })

  it('autres modes : facteur entier ≥ 2', () => {
    const res = validerConditionnements([
      valide[0],
      { libelle: 'Lot', facteur: 1.5, prix_vente: 100, est_detail: false },
    ])
    expect(res.modes[1].facteur).toMatch(/entier/)
    const res2 = validerConditionnements([
      valide[0],
      { libelle: 'Lot', facteur: 1, prix_vente: 100, est_detail: false },
    ])
    expect(res2.modes[1].facteur).toMatch(/entier/)
  })

  it('libellé requis et unique par produit (insensible à la casse)', () => {
    const res = validerConditionnements([
      valide[0],
      { libelle: 'Carton', facteur: 12, prix_vente: 15000, est_detail: false },
      { libelle: 'carton', facteur: 6, prix_vente: 8000, est_detail: false },
      { libelle: '  ', facteur: 3, prix_vente: 4500, est_detail: false },
    ])
    expect(res.modes[2].libelle).toMatch(/déjà utilisé/i)
    expect(res.modes[3].libelle).toMatch(/requis/i)
  })

  it('prix_vente > 0', () => {
    const res = validerConditionnements([
      valide[0],
      { libelle: 'Carton', facteur: 12, prix_vente: 0, est_detail: false },
    ])
    expect(res.modes[1].prix_vente).toMatch(/supérieur à 0/)
  })

  it('code optionnel : sans espace, unique parmi produits et modes', () => {
    const res = validerConditionnements(
      [
        valide[0],
        { libelle: 'Carton', facteur: 12, prix_vente: 15000, est_detail: false, code: 'COL A' },
        { libelle: 'Pack', facteur: 6, prix_vente: 8000, est_detail: false, code: 'cola' },
      ],
      // codes déjà pris par un produit (« cola » replié = code produit « COLA »)
      { codesOccupes: ['COLA', 'RIZ25'] },
    )
    expect(res.modes[1].code).toMatch(/espace/)
    expect(res.modes[2].code).toMatch(/déjà utilisé/i)
    // sans code → aucune erreur, même si d’autres codes sont occupés
    const sansCode = validerConditionnements(valide, { codesOccupes: ['RIZ25'] })
    expect(sansCode.modes[1].code).toBeUndefined()
  })

  it('liste vide → erreur globale', () => {
    expect(validerConditionnements([]).global[0]).toMatch(/détail/i)
  })
})

describe('besoinParProduit', () => {
  it('cumule les modes d’un même produit (1 carton + 3 détails = 15)', () => {
    const besoin = besoinParProduit([
      { produit: 10, conditionnement: carton, quantite: 1 },
      { produit: 10, conditionnement: detail, quantite: 3 },
      { produit: 8, conditionnement: null, quantite: 2 },
    ])
    expect(besoin.get(10)).toBe(15)
    expect(besoin.get(8)).toBe(2)
  })

  it('ligne sans facteur → détail (facteur 1)', () => {
    expect(besoinParProduit([{ produit: 1, quantite: 4 }]).get(1)).toBe(4)
  })
})

describe('maxQuantiteLigne', () => {
  it('borne la ligne au stock restant (cumul déduit)', () => {
    expect(maxQuantiteLigne(12, 30, 0)).toBe(2)
    expect(maxQuantiteLigne(12, 30, 6)).toBe(2) // 24 + 6 = 30
    expect(maxQuantiteLigne(12, 30, 7)).toBe(1)
    expect(maxQuantiteLigne(12, 14, 2)).toBe(1) // 1 carton + 2 reste → 12+2=14
    expect(maxQuantiteLigne(1, 14, 12)).toBe(2)
  })

  it('stock insuffisant → 0', () => {
    expect(maxQuantiteLigne(12, 11, 0)).toBe(0)
    expect(maxQuantiteLigne(1, 0, 0)).toBe(0)
    expect(maxQuantiteLigne(12, 30, 40)).toBe(0)
  })
})

describe('affichage des lignes', () => {
  it('libelleLigneMode : mode → « Carton (12) », détail → vide', () => {
    expect(libelleLigneMode({ libelle: 'Carton', facteur: 12, est_detail: false })).toBe('Carton (12)')
    expect(libelleLigneMode({ libelle: 'Détail', facteur: 1, est_detail: true })).toBe('')
    // anciennes lignes sans snapshot
    expect(libelleLigneMode({ quantite: 3, prix_unitaire: 750 })).toBe('')
    expect(libelleLigneMode(null)).toBe('')
  })
  it('optionModeLabel : « Détail · prix », « Carton ×12 · prix »', () => {
    expect(optionModeLabel({ id: 1, libelle: 'Détail', facteur: 1, est_detail: true, prix_vente: 1500 })).toBe(
      `Détail · ${new Intl.NumberFormat('fr-FR').format(1500)}`,
    )
    expect(optionModeLabel({ id: 3, libelle: 'Carton', facteur: 12, est_detail: false, prix_vente: 15000 })).toBe(
      `Carton ×12 · ${new Intl.NumberFormat('fr-FR').format(15000)}`,
    )
    expect(optionModeLabel(null, 750)).toBe(`Détail · ${new Intl.NumberFormat('fr-FR').format(750)}`)
  })

})
