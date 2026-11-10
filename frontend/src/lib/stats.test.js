import { describe, expect, it } from 'vitest'
import { agregerPeriode, bornesMois, comparerMois, topProduits, variationPct } from './stats.js'

/** Vente-test : date AAAA-MM-JJ, total, lignes [{produit, quantite, prix}]. */
const vente = (date, total, lignes = []) => ({
  date_vente: `${date}T12:00:00+00:00`,
  montant_total: total,
  lignes: lignes.map((l, i) => ({
    id: i + 1,
    produit: l.p,
    produit_nom: l.nom ?? `P${l.p}`,
    produit_code: l.code ?? `C${l.p}`,
    quantite: l.q,
    prix_unitaire: l.px ?? 100,
    montant_ligne: (l.px ?? 100) * l.q,
  })),
})

describe('bornesMois', () => {
  it('janvier : le mois précédent est décembre de l’année précédente', () => {
    const b = bornesMois('2027-01-15')
    expect(b.courant).toEqual(['2027-01-01', '2027-01-15'])
    expect(b.precedentMemeJours).toEqual(['2026-12-01', '2026-12-15'])
    expect(b.precedentComplet).toEqual(['2026-12-01', '2026-12-31'])
  })

  it('mois de 28 jours (février non bissextile)', () => {
    const b = bornesMois('2026-03-05')
    expect(b.precedentComplet).toEqual(['2026-02-01', '2026-02-28'])
    expect(b.precedentMemeJours[1]).toBe('2026-02-05')
  })

  it('février bissextile : 29 jours', () => {
    expect(bornesMois('2028-03-10').precedentComplet).toEqual(['2028-02-01', '2028-02-29'])
  })

  it('mois de 30 et 31 jours', () => {
    expect(bornesMois('2026-05-04').precedentComplet).toEqual(['2026-04-01', '2026-04-30'])
    expect(bornesMois('2026-04-04').precedentComplet).toEqual(['2026-03-01', '2026-03-31'])
  })

  it('jour de référence borné au nombre de jours du mois précédent', () => {
    // 31 mars → février n'a que 28 jours : comparaison sur 28 jours.
    expect(bornesMois('2026-03-31').precedentMemeJours).toEqual(['2026-02-01', '2026-02-28'])
  })
})

describe('agregerPeriode / variationPct', () => {
  it('agrège CA et ventes sur les bornes inclusives', () => {
    const ventes = [vente('2026-11-01', 1000), vente('2026-11-10', 2500), vente('2026-10-31', 9999)]
    expect(agregerPeriode(ventes, ['2026-11-01', '2026-11-10'])).toEqual({
      ca: 3500,
      nbVentes: 2,
      benefice: null, // pas de prix d'achat
    })
  })

  it('bénéfice calculé si prix d’achat disponible partout', () => {
    const v = vente('2026-11-05', 300, [{ p: 1, q: 3, px: 100 }])
    v.lignes[0].prix_achat = 60
    expect(agregerPeriode([v], ['2026-11-01', '2026-11-30']).benefice).toBe(120)
  })

  it('variationPct : division par zéro → null', () => {
    expect(variationPct(10, 0)).toBeNull()
    expect(variationPct(0, 0)).toBeNull()
    expect(variationPct(150, 100)).toBe(50)
    expect(variationPct(50, 100)).toBe(-50)
    expect(variationPct(1, 3)).toBe(-66.7)
  })
})

describe('comparerMois', () => {
  const ventesJanvier = [
    // Janvier (mois en cours, ref 15/01) : 3 ventes
    vente('2027-01-02', 1000),
    vente('2027-01-08', 2000),
    vente('2027-01-14', 3000),
    // Décembre jours 1-15 : 2 ventes de 1000
    vente('2026-12-03', 1000),
    vente('2026-12-10', 1000),
    // Décembre jours 16-31 (mois complet) : 1 vente de 5000
    vente('2026-12-25', 5000),
    // Hors période
    vente('2026-11-20', 99999),
  ]

  it('compare au même nombre de jours + mois précédent complet (janvier → décembre)', () => {
    const r = comparerMois(ventesJanvier, '2027-01-15')
    expect(r.courant).toMatchObject({ ca: 6000, nbVentes: 3 })
    expect(r.precedentMemeJours).toMatchObject({ ca: 2000, nbVentes: 2 })
    expect(r.precedentComplet).toMatchObject({ ca: 7000, nbVentes: 3 })
    expect(r.variations.ca).toBe(200) // (6000−2000)/2000
    expect(r.variations.nbVentes).toBe(50)
    expect(r.variations.benefice).toBeNull() // prix d'achat absent
  })

  it('absence de ventes → zéros et variations « — » (null)', () => {
    const r = comparerMois([], '2027-01-15')
    expect(r.courant).toEqual({ ca: 0, nbVentes: 0, benefice: null })
    expect(r.precedentMemeJours).toEqual({ ca: 0, nbVentes: 0, benefice: null })
    expect(r.variations).toEqual({ ca: null, nbVentes: null, benefice: null })
  })

  it('mois précédent sans vente → variation null (pas de division par zéro)', () => {
    const r = comparerMois([vente('2027-01-05', 1000)], '2027-01-15')
    expect(r.variations.ca).toBeNull()
    expect(r.variations.nbVentes).toBeNull()
  })
})

describe('topProduits', () => {
  const ventes = [
    // Janvier (ref 15/01) : riz ×3 (600), huile ×1 (2000)
    vente('2027-01-03', 600, [{ p: 1, nom: 'Riz', q: 3, px: 200 }]),
    vente('2027-01-09', 2000, [{ p: 2, nom: 'Huile', q: 1, px: 2000 }]),
    // Décembre jours 1-15 : riz ×1
    vente('2026-12-05', 200, [{ p: 1, nom: 'Riz', q: 1, px: 200 }]),
    // Hors période
    vente('2026-11-01', 500, [{ p: 9, nom: 'Ancien', q: 50, px: 10 }]),
  ]

  it('top 5 du mois avec quantité, CA et variation vs mois précédent', () => {
    const top = topProduits(ventes, '2027-01-15', 5)
    expect(top).toHaveLength(2)
    expect(top[0]).toMatchObject({ produit: 1, nom: 'Riz', qte: 3, ca: 600, qtePrecedent: 1, variation: 200 })
    expect(top[1]).toMatchObject({ produit: 2, nom: 'Huile', qte: 1, ca: 2000, qtePrecedent: 0, variation: null })
  })

  it('borné à N entrées, tri par quantité puis CA', () => {
    const ventes2 = [
      vente('2027-01-02', 100, [{ p: 1, q: 5, px: 20 }]),
      vente('2027-01-03', 100, [{ p: 2, q: 5, px: 20 }]),
      vente('2027-01-04', 100, [{ p: 3, q: 2, px: 50 }]),
    ]
    const top = topProduits(ventes2, '2027-01-15', 2)
    expect(top).toHaveLength(2)
    expect(top.map((t) => t.produit)).toEqual([1, 2])
  })

  it('sans ventes → tableau vide', () => {
    expect(topProduits([], '2027-01-15')).toEqual([])
  })

  it('produit vendu uniquement le mois dernier → variation null', () => {
    const top = topProduits([vente('2026-12-10', 400, [{ p: 7, q: 4, px: 100 }])], '2027-01-15')
    expect(top).toHaveLength(0) // rien ce mois-ci
  })
})
