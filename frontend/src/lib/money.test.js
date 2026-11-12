import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTableauDeBord } from '../api/rapports.js'
import { reapprovisionnerProduit } from '../api/produits.js'
import { formatFcfa, formatNombre, toNumber } from './money.js'

describe('money helpers', () => {
  it('converts decimal strings to numbers', () => {
    expect(toNumber('15500.00')).toBe(15500)
    expect(toNumber('0')).toBe(0)
    expect(toNumber('')).toBe(0)
  })

  it('formats FCFA with non-breaking spaces', () => {
    expect(formatFcfa('15500.00')).toBe('15\u202F500\u00A0FCFA')
  })
})

describe('frontend API contract endpoints', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the dashboard endpoint documented in the contract', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        date: '2026-11-04',
        aujourdhui: { ca: '0.00', nb_ventes: 0, panier_moyen: '0.00' },
        hier: { ca: '0.00', nb_ventes: 0 },
        serie_7_jours: [],
        top_produits_semaine: [],
        stock: { nb_produits: 0, nb_en_alerte: 0, nb_en_rupture: 0, valeur_stock: '0.00' },
        dernieres_ventes: [],
      }),
    })

    vi.stubGlobal('fetch', mockFetch)

    await getTableauDeBord('2026-11-04')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(String(mockFetch.mock.calls[0][0])).toContain('/api/rapports/tableau-de-bord/?date=2026-11-04')
  })

  it('calls the reapprovisionnement endpoint documented in the contract', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 1,
        code: 'RIZ25',
        nom: 'Riz parfumé',
        categorie: 1,
        categorie_nom: 'Céréales',
        prix_unitaire: '6200.00',
        stock: 24,
        seuil_alerte: 5,
        est_en_alerte: false,
      }),
    })

    vi.stubGlobal('fetch', mockFetch)

    await reapprovisionnerProduit(1, 12)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(String(mockFetch.mock.calls[0][0])).toContain('/api/produits/1/reapprovisionner/')
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ quantite: 12 })
  })
})

describe('formatNombre', () => {
  it('nombre localisé sans unité (options de mode)', () => {
    expect(formatNombre(15000)).toBe(new Intl.NumberFormat('fr-FR').format(15000))
    expect(formatNombre('15000.00')).toBe(new Intl.NumberFormat('fr-FR').format(15000))
    expect(formatNombre(null)).toBe('0')
    expect(formatNombre(0)).toBe('0')
  })
})
