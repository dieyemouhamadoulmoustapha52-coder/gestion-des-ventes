import { describe, expect, it } from 'vitest'
import { COLONNES_CSV, echapperCellule, genererCsvVentes, nomFichierCsv } from './exportCsv.js'

describe('echapperCellule', () => {
  it('valeurs simples passent telles quelles', () => {
    expect(echapperCellule('Riz parfumé')).toBe('Riz parfumé')
    expect(echapperCellule(1500)).toBe('1500')
    expect(echapperCellule('')).toBe('')
    expect(echapperCellule(null)).toBe('')
  })

  it('protège contre les formules (= + - @)', () => {
    expect(echapperCellule('=1+1')).toBe("'=1+1")
    expect(echapperCellule('+221700000000')).toBe("'+221700000000")
    expect(echapperCellule('-5')).toBe("'-5")
    expect(echapperCellule('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('échappe les guillemets et guillemote ; et retours ligne', () => {
    expect(echapperCellule('a;b')).toBe('"a;b"')
    expect(echapperCellule('dit "bonjour"')).toBe('"dit ""bonjour"""')
    expect(echapperCellule('ligne1\nligne2')).toBe('"ligne1\nligne2"')
    expect(echapperCellule('=A1;B1')).toBe('"\'=A1;B1"')
  })
})

describe('genererCsvVentes', () => {
  const ventes = [
    {
      id: 12,
      date_vente: '2026-11-04T14:32:00+00:00',
      client_nom: 'Fatou Ndiaye',
      mode_paiement: 'ESPECES',
      montant_total: '4550.00',
      lignes: [
        { produit_nom: 'Riz parfumé 25 kg', quantite: 1 },
        { produit_nom: 'Jus d’orange 1 L', quantite: 2 },
      ],
    },
    {
      id: 13,
      date_vente: '2026-11-05T09:05:00+00:00',
      client_nom: '',
      mode_paiement: 'WAVE',
      montant_total: 750,
      lignes: [{ produit_nom: 'Sucre 1 kg', quantite: 1 }],
    },
  ]

  const lignes = (csv) => csv.replace(/^﻿/, '').split('\r\n')

  it('colonne Articles : mode de vente après la quantité, absent au Détail', () => {
    const csv = genererCsvVentes([
      {
        id: 99,
        date_vente: '2026-11-06T10:00:00+00:00',
        client_nom: '',
        mode_paiement: 'ESPECES',
        montant_total: 31500,
        lignes: [
          { produit_nom: 'COLA', quantite: 2, libelle: 'Carton', facteur: 12, est_detail: false },
          { produit_nom: 'EAU', quantite: 3, libelle: 'Détail', facteur: 1, est_detail: true },
        ],
      },
    ])
    expect(csv).toContain('COLA ×2 Carton (12) ; EAU ×3')
    expect(csv).not.toContain('EAU ×3 Détail')
  })

  it('commence par le BOM UTF-8 et finit par CRLF', () => {
    const csv = genererCsvVentes(ventes)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.includes('\n')).toBe(true)
    expect(csv.split('\n').every((l) => l.endsWith('\r') || l === '')).toBe(true)
  })

  it('en-tête conforme et séparateur point-virgule', () => {
    const [entete] = lignes(genererCsvVentes(ventes))
    expect(entete).toBe(COLONNES_CSV.join(';'))
    expect(entete).toContain(';')
  })

  it('une ligne par vente, articles agrégés, total numérique', () => {
    const labels = { ESPECES: 'Espèces', WAVE: 'Wave' }
    const lignesCsv = lignes(genererCsvVentes(ventes, labels)).filter(Boolean)
    expect(lignesCsv).toHaveLength(3) // en-tête + 2 ventes
    expect(lignesCsv[1]).toContain('12;')
    expect(lignesCsv[1]).toContain('Riz parfumé 25 kg ×1 ; Jus d’orange 1 L ×2')
    expect(lignesCsv[1]).toContain('4550')
    expect(lignesCsv[1]).toContain('Espèces')
    expect(lignesCsv[2]).toContain('Wave')
  })

  it('libellés de moyens de paiement traduits', () => {
    const csv = genererCsvVentes(ventes, { ESPECES: 'Espèces', WAVE: 'Wave' })
    expect(csv).toContain('Espèces')
    expect(csv).toContain('Wave')
  })

  it('cellule à risque d’injection est neutralisée', () => {
    const dangereuse = [
      {
        id: 1,
        date_vente: '2026-11-04T10:00:00+00:00',
        client_nom: '=HYPERLINK("http://evil")',
        mode_paiement: 'ESPECES',
        montant_total: 100,
        lignes: [],
      },
    ]
    const csv = genererCsvVentes(dangereuse)
    expect(csv).toContain('\'=HYPERLINK')
    expect(csv).not.toMatch(/;=HYPERLINK/)
  })

  it('jeu vide → en-tête seul', () => {
    const csv = genererCsvVentes([])
    expect(lignes(csv).filter(Boolean)).toHaveLength(1)
  })
})

describe('nomFichierCsv', () => {
  it('utilise la période fournie', () => {
    expect(nomFichierCsv([], '2026-11-01', '2026-11-10')).toBe('ventes_2026-11-01_2026-11-10.csv')
  })

  it('déduit la période des ventes sinon', () => {
    const ventes = [
      { date_vente: '2026-11-05T10:00:00+00:00' },
      { date_vente: '2026-11-02T10:00:00+00:00' },
      { date_vente: '2026-11-04T10:00:00+00:00' },
    ]
    expect(nomFichierCsv(ventes, null, null)).toBe('ventes_2026-11-02_2026-11-05.csv')
  })

  it('sans données ni période → fichier inconnu valide', () => {
    expect(nomFichierCsv([], null, null)).toBe('ventes_inconnu_inconnu.csv')
  })
})
