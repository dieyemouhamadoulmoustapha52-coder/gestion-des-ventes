import { describe, expect, it } from 'vitest'
import {
  BROUILLON_CLE,
  BROUILLON_VERSION,
  aDesLignes,
  ecrireBrouillon,
  effacerBrouillon,
  lireBrouillon,
  revaliderBrouillon,
} from './brouillon.js'
import { cleDeLigne } from './paniers.js'

/** Faux localStorage pour les tests (pas de jsdom dans ce projet). */
function fauxStorage(init = {}) {
  const map = new Map(Object.entries(init))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  }
}

const produit = (id, stock) => ({ id, stock, prix_unitaire: 100, nom: `P${id}`, code: `C${id}` })
const ligne = (id, qte) => ({ produit: { id, stock: 99, prix_unitaire: 1, nom: `P${id}` }, quantite: qte })

describe('brouillon — écriture / lecture', () => {
  it('écrit puis relit un état complet (version de schéma)', () => {
    const st = fauxStorage()
    const etat = { paniers: [{ id: 1, items: [ligne(1, 2)] }], actif: 0, seq: 1 }
    expect(ecrireBrouillon(etat, st)).toBe(true)
    expect(lireBrouillon(st)).toEqual(etat)
    expect(JSON.parse(st._map.get(BROUILLON_CLE)).version).toBe(BROUILLON_VERSION)
  })

  it('JSON cassé ou version inconnue → null', () => {
    expect(lireBrouillon(fauxStorage({ [BROUILLON_CLE]: '{oops' }))).toBeNull()
    expect(
      lireBrouillon(fauxStorage({ [BROUILLON_CLE]: JSON.stringify({ version: 99, paniers: [] }) })),
    ).toBeNull()
    expect(lireBrouillon(fauxStorage())).toBeNull()
  })

  it('stockage indisponible → null / false sans lever', () => {
    expect(lireBrouillon(null)).toBeNull()
    expect(ecrireBrouillon({ paniers: [] }, null)).toBe(false)
    expect(() => effacerBrouillon(null)).not.toThrow()
  })

  it('efface la clé', () => {
    const st = fauxStorage({ [BROUILLON_CLE]: '{}' })
    effacerBrouillon(st)
    expect(lireBrouillon(st)).toBeNull()
  })

  it('écriture en échec (quota) → false sans lever', () => {
    const st = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    }
    expect(ecrireBrouillon({ paniers: [] }, st)).toBe(false)
  })
})

describe('revaliderBrouillon', () => {
  it('supprime les lignes de produits inconnus', () => {
    const brut = { paniers: [{ id: 1, items: [ligne(1, 1), ligne(999, 1)] }], actif: 0, seq: 1 }
    const out = revaliderBrouillon(brut, [produit(1, 10)])
    expect(out.paniers[0].items).toHaveLength(1)
    expect(out.paniers[0].items[0].produit.id).toBe(1)
  })

  it('borne la quantité au stock courant', () => {
    const brut = { paniers: [{ id: 1, items: [ligne(1, 50)] }], actif: 0, seq: 1 }
    const out = revaliderBrouillon(brut, [produit(1, 3)])
    expect(out.paniers[0].items[0].quantite).toBe(3)
  })

  it('retire les lignes dont le stock est à 0', () => {
    const brut = { paniers: [{ id: 1, items: [ligne(1, 2)] }], actif: 0, seq: 1 }
    const out = revaliderBrouillon(brut, [produit(1, 0)])
    expect(out.paniers[0].items).toHaveLength(0)
  })

  it('remplace le snapshot produit par l’état courant', () => {
    const brut = { paniers: [{ id: 1, items: [ligne(1, 1)] }], actif: 0, seq: 1 }
    const out = revaliderBrouillon(brut, [{ ...produit(1, 7), prix_unitaire: 4200, nom: 'Renommé' }])
    expect(out.paniers[0].items[0].produit.prix_unitaire).toBe(4200)
    expect(out.paniers[0].items[0].produit.nom).toBe('Renommé')
  })

  it('corrige l’index actif hors bornes', () => {
    const brut = { paniers: [{ id: 1, items: [] }, { id: 2, items: [] }], actif: 9, seq: 2 }
    expect(revaliderBrouillon(brut, []).actif).toBe(0)
    const brut2 = { paniers: [{ id: 1, items: [] }], actif: 0, seq: 1 }
    expect(revaliderBrouillon(brut2, []).actif).toBe(0)
  })

  it('aucun panier → un panier vierge', () => {
    const out = revaliderBrouillon({ paniers: [], actif: 0, seq: 0 }, [])
    expect(out.paniers).toHaveLength(1)
    expect(out.paniers[0].items).toHaveLength(0)
  })
})

describe('aDesLignes', () => {
  it('détecte au moins une ligne', () => {
    expect(aDesLignes({ paniers: [{ id: 1, items: [] }] })).toBe(false)
    expect(aDesLignes({ paniers: [{ id: 1, items: [ligne(1, 1)] }] })).toBe(true)
    expect(aDesLignes(null)).toBe(false)
  })
})

describe('brouillon — migration v1 → v2', () => {
  it('lit encore un brouillon v1 (lignes sans mode)', () => {
    const v1 = {
      version: 1,
      paniers: [{ id: 1, items: [{ produit: { id: 1, stock: 10 }, quantite: 2 }] }],
      actif: 0,
      seq: 1,
    }
    const st = fauxStorage({ 'gv:paniers:v1': JSON.stringify(v1) })
    const lu = lireBrouillon(st)
    expect(lu).not.toBeNull()
    expect(lu.paniers[0].items[0].quantite).toBe(2)
    // la ligne migrée est un mode Détail après revalidation
    const out = revaliderBrouillon(lu, [produit(1, 10)])
    const l = out.paniers[0].items[0]
    // bascule en mode Détail : même clé de ligne qu’une ligne sans mode
    expect(l.conditionnement).toMatchObject({ est_detail: true, facteur: 1 })
    expect(cleDeLigne(l)).toBe('1:detail')
  })

  it('une écriture v2 efface l’ancienne clé v1', () => {
    const st = fauxStorage({ 'gv:paniers:v1': JSON.stringify({ version: 1, paniers: [] }) })
    ecrireBrouillon({ paniers: [{ id: 1, items: [] }], actif: 0, seq: 1 }, st)
    expect(st._map.has('gv:paniers:v1')).toBe(false)
    expect(st._map.has(BROUILLON_CLE)).toBe(true)
  })

  it('v2 présent → on lit v2, pas v1', () => {
    const v2 = { version: 2, paniers: [{ id: 1, items: [ligne(2, 1)] }], actif: 0, seq: 1 }
    const v1 = { version: 1, paniers: [{ id: 1, items: [ligne(1, 5)] }], actif: 0, seq: 1 }
    const st = fauxStorage({ [BROUILLON_CLE]: JSON.stringify(v2), 'gv:paniers:v1': JSON.stringify(v1) })
    expect(lireBrouillon(st).paniers[0].items[0].produit.id).toBe(2)
  })
})

describe('revaliderBrouillon — modes de vente', () => {
  const cola = (stock, modes) => ({
    id: 10,
    stock,
    prix_unitaire: 1500,
    nom: 'COLA',
    conditionnements: modes,
  })
  const detail = { id: 1, libelle: 'Détail', facteur: 1, prix_vente: 1500, est_detail: true, actif: true }
  const carton = { id: 3, libelle: 'Carton', facteur: 12, prix_vente: 15000, est_detail: false, actif: true }
  const cartonRetire = { ...carton, actif: false }

  it('conserve un mode actif et reprend l’objet courant du catalogue', () => {
    const brut = {
      paniers: [{ id: 1, items: [{ produit: { id: 10, stock: 99 }, conditionnement: { id: 3, prix_vente: 9999 }, quantite: 2 }] }],
      actif: 0,
      seq: 1,
    }
    const out = revaliderBrouillon(brut, [cola(30, [detail, carton])])
    const l = out.paniers[0].items[0]
    expect(l.conditionnement.id).toBe(3)
    expect(l.conditionnement.prix_vente).toBe(15000) // prix actualisé
    expect(l.quantite).toBe(2) // 24 ≤ 30
  })

  it('retire la ligne dont le mode a été retiré', () => {
    const brut = {
      paniers: [{ id: 1, items: [{ produit: { id: 10 }, conditionnement: { id: 3 }, quantite: 1 }] }],
      actif: 0,
      seq: 1,
    }
    const out = revaliderBrouillon(brut, [cola(30, [detail, cartonRetire])])
    expect(out.paniers[0].items).toHaveLength(0)
  })

  it('borne en unités de base avec cumul des lignes du produit', () => {
    const brut = {
      paniers: [
        {
          id: 1,
          items: [
            { produit: { id: 10 }, conditionnement: { id: 3 }, quantite: 5 }, // 60 > 30
            { produit: { id: 10 }, conditionnement: null, quantite: 30 }, // détail
          ],
        },
      ],
      actif: 0,
      seq: 1,
    }
    const out = revaliderBrouillon(brut, [cola(30, [detail, carton])])
    const items = out.paniers[0].items
    expect(items).toHaveLength(2)
    expect(items[0].quantite).toBe(2) // 2 × 12 = 24
    expect(items[1].quantite).toBe(6) // reste 30 − 24 = 6
  })

  it('fusionne deux lignes devenues identiques (produit + mode)', () => {
    const brut = {
      paniers: [
        {
          id: 1,
          items: [
            { produit: { id: 10 }, conditionnement: { id: 1 }, quantite: 2 },
            { produit: { id: 10 }, conditionnement: null, quantite: 3 }, // même clé « detail »
          ],
        },
      ],
      actif: 0,
      seq: 1,
    }
    const out = revaliderBrouillon(brut, [cola(30, [detail, carton])])
    expect(out.paniers[0].items).toHaveLength(1)
    expect(out.paniers[0].items[0].quantite).toBe(5)
  })
})
