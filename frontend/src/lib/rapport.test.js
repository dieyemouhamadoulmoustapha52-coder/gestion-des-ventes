import { describe, expect, it } from 'vitest'
import {
  beneficePeriode,
  formatPart,
  grouperCategories,
  limiter,
  partPourcent,
  topProduitsJour,
  trierStock,
  variationAffichable,
} from './rapport.js'

// ── parts ────────────────────────────────────────────────────────

describe('partPourcent / formatPart', () => {
  it('calcule la part par rapport au total fourni', () => {
    expect(partPourcent(370000, 1267800)).toBeCloseTo(29.184, 2)
  })

  it('total nul → 0 % (jamais NaN)', () => {
    expect(partPourcent(100, 0)).toBe(0)
    expect(partPourcent(100, null)).toBe(0)
  })

  it('format français à 1 décimale (virgule)', () => {
    expect(formatPart(29.184)).toBe('29,2')
    expect(formatPart(0)).toBe('0,0')
    expect(formatPart(8.06)).toBe('8,1')
  })

  it('le format est IDENTIQUE à l’affichage d’avant (1 décimale)', () => {
    const ancien = (v, t) =>
      ((v / t) * 100).toLocaleString('fr-FR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    for (const [v, t] of [[370000, 1267800], [17500, 1267800], [34950, 1267800]]) {
      expect(formatPart(partPourcent(v, t))).toBe(ancien(v, t))
    }
  })
})

// ── grouperCategories ────────────────────────────────────────────

describe('grouperCategories', () => {
  const cats = [
    { categorie: 'A', ca: '500000.00' },
    { categorie: 'B', ca: '300000.00' },
    { categorie: 'C', ca: '200000.00' },
    { categorie: 'D', ca: '100000.00' },
    { categorie: 'E', ca: '80000.00' },
    { categorie: 'F', ca: '20000.00' },
    { categorie: 'G', ca: '10000.00' },
  ]

  it('garde les n premières et agrège le reste en « Autres »', () => {
    const g = grouperCategories(cats, 5, 1210000)
    expect(g.premieres.map((c) => c.categorie)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(g.autres).toEqual({ nb: 2, ca: 30000, part: expect.closeTo(2.479, 2) })
  })

  it('montant et part de « Autres » sont cohérents avec le total', () => {
    const g = grouperCategories(cats, 5, 1210000)
    const somme = g.premieres.reduce((s, c) => s + c.ca, 0) + g.autres.ca
    expect(somme).toBe(1210000)
    const parts = g.premieres.reduce((s, c) => s + c.part, 0) + g.autres.part
    expect(parts).toBeCloseTo(100, 5)
  })

  it('pas de ligne « Autres » quand tout est affiché', () => {
    const g = grouperCategories(cats, 5, 1210000)
    expect(g.autres).not.toBeNull()
    expect(grouperCategories(cats.slice(0, 5), 5, 1210000).autres).toBeNull()
  })

  it('sans total explicite, la somme des catégories sert de référence', () => {
    const g = grouperCategories(cats, 3)
    expect(g.total).toBe(1210000)
    expect(g.premieres[0].part).toBeCloseTo(41.32, 1)
  })

  it('liste vide → structures vides', () => {
    expect(grouperCategories([], 5)).toEqual({ premieres: [], autres: null, total: 0 })
    expect(grouperCategories(null, 5).premieres).toEqual([])
  })

  it('n négatif ou nul → tout dans « Autres »', () => {
    const g = grouperCategories(cats, 0, 1210000)
    expect(g.premieres).toEqual([])
    expect(g.autres.nb).toBe(7)
  })
})

// ── trierStock ───────────────────────────────────────────────────

describe('trierStock', () => {
  const p = (nom, stock, seuil, extra = {}) => ({
    nom,
    stock,
    seuil_alerte: seuil,
    en_rupture: stock === 0,
    ...extra,
  })

  it('ruptures d’abord, puis du plus critique au moins critique', () => {
    const produits = [
      p('Riz', 9, 5), // 1,8
      p('Lait', 5, 5), // 1,0
      p('Sel', 0, 2), // rupture
      p('Huile', 2, 6), // 0,33
      p('Café', 4, 4), // 1,0
    ]
    expect(trierStock(produits).map((x) => x.nom)).toEqual([
      'Sel',
      'Huile',
      'Café', // 1,0 mais stock 4 < 5
      'Lait',
      'Riz',
    ])
  })

  it('deux ruptures : partage puis nom', () => {
    const produits = [p('B', 0, 3), p('A', 0, 3)]
    expect(trierStock(produits).map((x) => x.nom)).toEqual(['A', 'B'])
  })

  it('ne modifie pas le tableau d’origine', () => {
    const produits = [p('Riz', 9, 5), p('Sel', 0, 2)]
    const copie = [...produits]
    trierStock(produits)
    expect(produits).toEqual(copie)
  })

  it('gère les listes vides / absentes', () => {
    expect(trierStock([])).toEqual([])
    expect(trierStock(undefined)).toEqual([])
  })
})

// ── limiter ──────────────────────────────────────────────────────

describe('limiter', () => {
  it('ne garde que n éléments', () => {
    expect(limiter([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3])
    expect(limiter([1, 2, 3], 8)).toEqual([1, 2, 3])
  })

  it('n ≤ 0 ou liste absente → vide', () => {
    expect(limiter([1, 2], 0)).toEqual([])
    expect(limiter(null, 5)).toEqual([])
    expect(limiter([1, 2], -1)).toEqual([])
  })

  it('ne tronque jamais la liste d’origine', () => {
    const liste = [1, 2, 3]
    expect(limiter(liste, 2)).toEqual([1, 2])
    expect(liste).toHaveLength(3)
  })
})

// ── variationAffichable ──────────────────────────────────────────

describe('variationAffichable', () => {
  const mois = { ca: 3252250, nbVentes: 300, benefice: null }

  it('période précédente sans vente → comparaison indisponible', () => {
    const v = variationAffichable(mois, { ca: 0, nbVentes: 0, benefice: null })
    expect(v).toEqual({ disponible: false, ca: null, nbVentes: null, benefice: null })
  })

  it('période précédente absente (null) → indisponible', () => {
    expect(variationAffichable(mois, null).disponible).toBe(false)
    expect(variationAffichable(mois, undefined).disponible).toBe(false)
  })

  it('période précédente avec ventes → variations calculées', () => {
    const v = variationAffichable(
      { ca: 200, nbVentes: 10, benefice: 50 },
      { ca: 100, nbVentes: 10, benefice: 25 },
    )
    expect(v).toEqual({ disponible: true, ca: 100, nbVentes: 0, benefice: 100 })
  })

  it('bénéfice absent de part et d’autre → null (pas de faux 0 %)', () => {
    const v = variationAffichable(
      { ca: 200, nbVentes: 10, benefice: null },
      { ca: 100, nbVentes: 5, benefice: 40 },
    )
    expect(v.disponible).toBe(true)
    expect(v.benefice).toBeNull()
    expect(v.ca).toBe(100)
  })

  it('précédent à 0 vente mais CA non nul → reste indisponible', () => {
    expect(
      variationAffichable(mois, { ca: 500, nbVentes: 0, benefice: null }).disponible,
    ).toBe(false)
  })
})

// ── beneficePeriode ──────────────────────────────────────────────

describe('beneficePeriode', () => {
  const ligne = (extra = {}) => ({
    quantite: 2,
    quantite_base: 2,
    facteur: 1,
    prix_unitaire: 1000,
    total_ligne: 2000,
    cout_unitaire_base: 600,
    ...extra,
  })

  it('marge = total_ligne − cout_unitaire_base × quantite_base', () => {
    const ventes = [
      { date_vente: '2026-11-27T10:00:00Z', lignes: [ligne(), ligne()] },
    ]
    expect(beneficePeriode(ventes, ['2026-11-27', '2026-11-27'])).toBe(1600)
  })

  it('repli sur prix_achat pour les anciennes lignes', () => {
    const ventes = [
      {
        date_vente: '2026-11-27T10:00:00Z',
        lignes: [ligne({ cout_unitaire_base: null, prix_achat: 750 })],
      },
    ]
    expect(beneficePeriode(ventes, ['2026-11-27', '2026-11-27'])).toBe(500)
  })

  it('coût introuvable sur une ligne → null (carte omise, jamais un 0)', () => {
    const ventes = [
      {
        date_vente: '2026-11-27T10:00:00Z',
        lignes: [ligne({ cout_unitaire_base: null, prix_achat: undefined })],
      },
    ]
    expect(beneficePeriode(ventes, ['2026-11-27', '2026-11-27'])).toBeNull()
  })

  it('vente sans ligne → null (comme agregerPeriode)', () => {
    const ventes = [{ date_vente: '2026-11-27T10:00:00Z', lignes: [] }]
    expect(beneficePeriode(ventes, ['2026-11-27', '2026-11-27'])).toBeNull()
  })

  it('hors période ignoré ; aucune vente → null', () => {
    const ventes = [
      { date_vente: '2026-11-26T10:00:00Z', lignes: [ligne()] },
    ]
    expect(beneficePeriode(ventes, ['2026-11-27', '2026-11-27'])).toBeNull()
    expect(beneficePeriode([], ['2026-11-27', '2026-11-27'])).toBeNull()
  })

  it('unités de base : quantite_base × facteur quand quantite_base est absent', () => {
    const ventes = [
      {
        date_vente: '2026-11-27T10:00:00Z',
        lignes: [
          ligne({
            quantite: 2,
            quantite_base: undefined,
            facteur: 12,
            total_ligne: 30000,
            cout_unitaire_base: 1000,
          }),
        ],
      },
    ]
    // 30 000 − 1 000 × (2 × 12) = 6 000
    expect(beneficePeriode(ventes, ['2026-11-27', '2026-11-27'])).toBe(6000)
  })
})

// ── topProduitsJour ──────────────────────────────────────────────

describe('topProduitsJour', () => {
  const vente = (date, lignes) => ({
    date_vente: `${date}T09:00:00Z`,
    lignes: lignes.map((l, i) => ({
      id: i + 1,
      produit: l.p,
      produit_nom: l.nom ?? `P${l.p}`,
      produit_code: l.code ?? `C${l.p}`,
      quantite: l.q,
      quantite_base: l.q,
      facteur: 1,
      prix_unitaire: l.px ?? 100,
      montant_ligne: (l.px ?? 100) * l.q,
    })),
  })

  const ventes = [
    vente('2026-11-27', [
      { p: 1, nom: 'Semoule', q: 10, px: 900 },
      { p: 2, nom: 'Beignet', q: 22, px: 100 },
    ]),
    vente('2026-11-27', [{ p: 1, nom: 'Semoule', q: 13, px: 900 }]),
    vente('2026-11-26', [{ p: 3, nom: 'Hier', q: 99, px: 10 }]),
  ]

  it('ne retient que la journée demandée, en unités de base', () => {
    const top = topProduitsJour(ventes, '2026-11-27', 5)
    expect(top.map((t) => [t.nom, t.qte, t.ca])).toEqual([
      ['Semoule', 23, 20700],
      ['Beignet', 22, 2200],
    ])
  })

  it('plafonne à n et ordonne par quantité puis CA', () => {
    expect(topProduitsJour(ventes, '2026-11-27', 1)).toHaveLength(1)
    expect(topProduitsJour(ventes, '2026-11-27', 1)[0].nom).toBe('Semoule')
  })

  it('journée sans vente → vide', () => {
    expect(topProduitsJour(ventes, '2026-11-20', 5)).toEqual([])
    expect(topProduitsJour([], '2026-11-27', 5)).toEqual([])
  })

  it('quantite_base en unités de base (facteur 12 ignoré du mode)', () => {
    const v = [
      {
        date_vente: '2026-11-27T09:00:00Z',
        lignes: [
          {
            produit: 9,
            produit_nom: 'Soda',
            produit_code: 'S1',
            quantite: 2,
            quantite_base: 24,
            facteur: 12,
            prix_unitaire: 1500,
            montant_ligne: 3000,
          },
        ],
      },
    ]
    expect(topProduitsJour(v, '2026-11-27', 5)[0]).toMatchObject({
      nom: 'Soda',
      qte: 24,
      ca: 3000,
    })
  })
})
