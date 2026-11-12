import { describe, expect, it } from 'vitest'
import { PANIER_MAX, ligneCle, paniersEtatInitial, paniersReducer } from './paniers.js'

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

describe('paniersReducer — modes de vente', () => {
  const cola = (stock = 30) => ({
    id: 10,
    stock,
    prix_unitaire: 1500,
    nom: 'COLA',
    unite_base: 'bouteille',
    conditionnements: [
      { id: 1, libelle: 'Détail', facteur: 1, prix_vente: 1500, est_detail: true, actif: true },
      { id: 2, libelle: 'Demi-carton', facteur: 6, prix_vente: 8000, est_detail: false, actif: true },
      { id: 3, libelle: 'Carton', facteur: 12, prix_vente: 15000, est_detail: false, actif: true },
    ],
  })
  const mode = (p, id) => p.conditionnements.find((m) => m.id === id)

  it('ligneCle : le Détail a toujours la même clé', () => {
    expect(ligneCle(10, null)).toBe('10:detail')
    expect(ligneCle(10, mode(cola(), 1))).toBe('10:detail')
    expect(ligneCle(10, mode(cola(), 3))).toBe('10:3')
  })

  it('add avec un mode crée une ligne distincte du Détail', () => {
    const p = cola()
    let s = vide()
    s = paniersReducer(s, { type: 'add', produit: p, mode: mode(p, 3) })
    s = paniersReducer(s, { type: 'add', produit: p, mode: null })
    expect(s.paniers[0].items).toHaveLength(2)
    expect(s.paniers[0].items[0].conditionnement.id).toBe(3)
    expect(s.paniers[0].items[1].conditionnement).toBeNull()
    expect(s.paniers[0].items[0].quantite).toBe(1)
    expect(s.paniers[0].items[1].quantite).toBe(1)
  })

  it('les bornes sont en unités de base (2 cartons max sur 30)', () => {
    const p = cola(30)
    let s = vide()
    for (let i = 0; i < 4; i += 1) s = paniersReducer(s, { type: 'add', produit: p, mode: mode(p, 3) })
    expect(s.paniers[0].items[0].quantite).toBe(2) // 2 × 12 = 24 ≤ 30

    // le reste du stock (6) est disponible pour une ligne de détail
    for (let i = 0; i < 10; i += 1) s = paniersReducer(s, { type: 'add', produit: p, mode: null })
    const detail = s.paniers[0].items.find((i) => i.conditionnement === null)
    expect(detail.quantite).toBe(6)
  })

  it('inc est borné par le mode de la ligne', () => {
    const p = cola(30)
    let s = vide()
    s = paniersReducer(s, { type: 'add', produit: p, mode: mode(p, 2) }) // demi-carton ×6
    const cle = ligneCle(p.id, mode(p, 2))
    for (let i = 0; i < 10; i += 1) s = paniersReducer(s, { type: 'inc', cle })
    expect(s.paniers[0].items[0].quantite).toBe(5) // 5 × 6 = 30
  })

  it('changerMode re-borné, et fusion si la ligne cible existe', () => {
    const p = cola(30)
    let s = vide()
    s = paniersReducer(s, { type: 'add', produit: p, mode: null })
    s = paniersReducer(s, { type: 'add', produit: p, mode: mode(p, 3) })
    expect(s.paniers[0].items).toHaveLength(2)

    s = paniersReducer(s, { type: 'mode', cle: ligneCle(p.id, mode(p, 3)), mode: null })
    expect(s.paniers[0].items).toHaveLength(1)
    expect(s.paniers[0].items[0].quantite).toBe(2) // 1 détail + 1 carton → 2 détails
    expect(s.paniers[0].items[0].conditionnement).toBeNull()
  })

  it('changerMode vers un mode qui ne tient pas en stock → inchangé', () => {
    const p = cola(11)
    let s = vide()
    s = paniersReducer(s, { type: 'add', produit: p, mode: null })
    for (let i = 0; i < 10; i += 1) s = paniersReducer(s, { type: 'inc', cle: ligneCle(p.id, null) })
    expect(s.paniers[0].items[0].quantite).toBe(11)
    s = paniersReducer(s, { type: 'mode', cle: ligneCle(p.id, null), mode: mode(p, 3) })
    expect(s.paniers[0].items[0].conditionnement).toBeNull() // 12 > 11 : refusé
    expect(s.paniers[0].items[0].quantite).toBe(11)
  })

  it('remove / dec ciblent la clé de ligne (produit + mode)', () => {
    const p = cola()
    let s = vide()
    s = paniersReducer(s, { type: 'add', produit: p, mode: mode(p, 3) })
    s = paniersReducer(s, { type: 'add', produit: p, mode: null })
    s = paniersReducer(s, { type: 'remove', cle: ligneCle(p.id, mode(p, 3)) })
    expect(s.paniers[0].items).toHaveLength(1)
    expect(s.paniers[0].items[0].conditionnement).toBeNull()
  })
})
