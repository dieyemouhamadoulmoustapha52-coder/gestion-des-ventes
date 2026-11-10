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
