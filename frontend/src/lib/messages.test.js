import { describe, expect, it } from 'vitest'
import { deriveStockMessages, trierMessages } from './messages.js'

const p = (id, stock, extra = {}) => ({ id, nom: `Produit ${id}`, stock, ...extra })

describe('deriveStockMessages', () => {
  it('signale le stock bas avec le seuil par défaut (5)', () => {
    const msgs = deriveStockMessages([p(1, 3)], 5)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatchObject({
      id: 'stock-bas:1',
      type: 'stock-bas',
      niveau: 'avertissement',
      texte: 'Produit 1 : il reste 3',
      masquable: true,
      audience: 'tous',
      ephemere: false,
    })
  })

  it('respecte le seuil propre au produit s’il existe', () => {
    expect(deriveStockMessages([p(1, 3, { seuil_alerte: 2 })], 5)).toHaveLength(0)
    expect(deriveStockMessages([p(1, 2, { seuil_alerte: 2 })], 5)).toHaveLength(1)
  })

  it('détecte la rupture et la rend non masquable', () => {
    const msgs = deriveStockMessages([p(1, 0)], 5)
    expect(msgs[0]).toMatchObject({
      type: 'rupture',
      niveau: 'critique',
      texte: 'Produit 1 : rupture de stock',
      masquable: false,
    })
  })

  it('la rupture remplace le stock bas du même produit (un seul message)', () => {
    const msgs = deriveStockMessages([p(1, 0)], 5)
    expect(msgs.filter((m) => m.id === 'stock-bas:1')).toHaveLength(1)
  })

  it('ignore les produits au-dessus du seuil', () => {
    expect(deriveStockMessages([p(1, 6), p(2, 7)], 5)).toHaveLength(0)
  })

  it('regroupe au-delà de 3 produits concernés avec une action « Voir »', () => {
    const msgs = deriveStockMessages([p(1, 1), p(2, 2), p(3, 0), p(4, 4), p(5, 5)], 5)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatchObject({
      id: 'stock-groupe',
      texte: '5 produits en stock bas',
      action: { label: 'Voir', route: '/produits?stock_bas=true' },
    })
  })

  it('reste message par message jusqu’à 3 produits concernés', () => {
    const msgs = deriveStockMessages([p(1, 1), p(2, 2), p(3, 0)], 5)
    expect(msgs).toHaveLength(3)
  })

  it('disparaît quand le stock remonte (aucun produit concerné)', () => {
    expect(deriveStockMessages([p(1, 10)], 5)).toHaveLength(0)
  })
})

describe('trierMessages', () => {
  it('ordonne par priorité : critique > avertissement > succès > info', () => {
    const msgs = [
      { id: 'i', niveau: 'info', creeLe: 0 },
      { id: 's', niveau: 'succes', creeLe: 0 },
      { id: 'a', niveau: 'avertissement', creeLe: 0 },
      { id: 'c', niveau: 'critique', creeLe: 0 },
    ]
    expect(trierMessages(msgs).map((m) => m.id)).toEqual(['c', 'a', 's', 'i'])
  })
})
