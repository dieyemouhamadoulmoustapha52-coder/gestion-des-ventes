import { describe, expect, it } from 'vitest'
import { PANIER_MAX, paniersEtatInitial, paniersReducer } from './paniers.js'

const produit = (id, stock = 10) => ({ id, stock, prix_unitaire: 100, nom: `P${id}` })
const vide = () => paniersEtatInitial()

describe('paniersReducer — panier actif', () => {
  it('add / inc / dec / remove / clear n’affectent que le panier actif', () => {
    let s = vide()
    s = paniersReducer(s, { type: 'ajouter' }) // panier 2 actif
    s = paniersReducer(s, { type: 'add', produit: produit(1) })
    expect(s.paniers[1].items).toHaveLength(1)
    expect(s.paniers[0].items).toHaveLength(0)

    s = paniersReducer(s, { type: 'clear' })
    expect(s.paniers[1].items).toHaveLength(0)
    expect(s.paniers).toHaveLength(2)
  })

  it('add borne la quantité au stock', () => {
    let s = vide()
    s = paniersReducer(s, { type: 'add', produit: produit(1, 2) })
    s = paniersReducer(s, { type: 'add', produit: produit(1, 2) })
    s = paniersReducer(s, { type: 'add', produit: produit(1, 2) })
    expect(s.paniers[0].items[0].quantite).toBe(2)
  })

  it('produit en rupture → pas d’ajout', () => {
    const s = paniersReducer(vide(), { type: 'add', produit: produit(1, 0) })
    expect(s.paniers[0].items).toHaveLength(0)
  })
})

describe('paniersReducer — onglets', () => {
  it('ajouter crée un panier et le rend actif (max PANIER_MAX)', () => {
    let s = vide()
    for (let i = 1; i < PANIER_MAX; i++) s = paniersReducer(s, { type: 'ajouter' })
    expect(s.paniers).toHaveLength(PANIER_MAX)
    expect(s.actif).toBe(PANIER_MAX - 1)
    const avant = s
    s = paniersReducer(s, { type: 'ajouter' }) // au-delà du max
    expect(s).toBe(avant)
  })

  it('activer bascule sans perte de contenu', () => {
    let s = vide()
    s = paniersReducer(s, { type: 'add', produit: produit(1) })
    s = paniersReducer(s, { type: 'ajouter' })
    s = paniersReducer(s, { type: 'add', produit: produit(2) })
    s = paniersReducer(s, { type: 'activer', id: 0 })
    expect(s.actif).toBe(0)
    expect(s.paniers[0].items[0].produit.id).toBe(1)
    expect(s.paniers[1].items[0].produit.id).toBe(2)
  })

  it('fermer un onglet vide uniquement', () => {
    let s = vide()
    s = paniersReducer(s, { type: 'add', produit: produit(1) })
    s = paniersReducer(s, { type: 'ajouter' }) // panier 2 vide, actif
    const idPlein = s.paniers[0].id
    s = paniersReducer(s, { type: 'fermer', id: idPlein }) // refusé : non vide
    expect(s.paniers).toHaveLength(2)

    s = paniersReducer(s, { type: 'fermer', id: s.paniers[1].id })
    expect(s.paniers).toHaveLength(1)
    expect(s.actif).toBe(0)
  })

  it('fermer le dernier onglet vide recrée un panier vierge', () => {
    let s = vide()
    s = paniersReducer(s, { type: 'fermer', id: s.paniers[0].id })
    expect(s.paniers).toHaveLength(1)
    expect(s.paniers[0].items).toHaveLength(0)
    expect(s.actif).toBe(0)
  })

  it('activer hors bornes → state inchangé', () => {
    const s = vide()
    expect(paniersReducer(s, { type: 'activer', id: 7 })).toBe(s)
    expect(paniersReducer(s, { type: 'activer', id: -1 })).toBe(s)
  })
})

describe('paniersReducer — vente', () => {
  it('vendu ne vide QUE le panier de la vente', () => {
    let s = vide()
    s = paniersReducer(s, { type: 'add', produit: produit(1) })
    s = paniersReducer(s, { type: 'ajouter' })
    s = paniersReducer(s, { type: 'add', produit: produit(2) })
    const venduId = s.paniers[1].id
    s = paniersReducer(s, { type: 'vendu', id: venduId })
    expect(s.paniers[1].items).toHaveLength(0)
    expect(s.paniers[0].items).toHaveLength(1)
  })

  it('vendu sans id cible le panier actif', () => {
    let s = vide()
    s = paniersReducer(s, { type: 'add', produit: produit(1) })
    s = paniersReducer(s, { type: 'vendu' })
    expect(s.paniers[0].items).toHaveLength(0)
  })
})

describe('paniersReducer — hydrate', () => {
  it('remplace l’état complet (restauration)', () => {
    const restore = {
      paniers: [
        { id: 3, items: [{ produit: produit(9), quantite: 2 }] },
        { id: 4, items: [] },
      ],
      actif: 1,
      seq: 4,
    }
    const s = paniersReducer(vide(), { type: 'hydrate', state: restore })
    expect(s).toEqual(restore)
  })
})
