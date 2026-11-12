import { describe, expect, it } from 'vitest'
import { buildWhatsAppLink, construireTexte, LIMITE_TEXTE, normaliserNumero, numeroClient } from './whatsapp.js'

const boutique = { nom: 'Wagué Bussness Halal', telephone: '+221 77 000 00 00' }
const vente = {
  id: 187,
  date_vente: '2026-11-04T14:32:00+00:00',
  montant_total: 4550,
  client_nom: 'Fatou Ndiaye',
  lignes: [
    { produit_nom: 'Riz parfumé 25 kg', quantite: 1, montant_ligne: 15500 },
    { produit_nom: 'Jus d’orange 1 L', quantite: 2, montant_ligne: 2400 },
  ],
}

describe('normaliserNumero', () => {
  it('retire espaces, +, 00 et tirets', () => {
    expect(normaliserNumero('+221 77 555 44 33')).toBe('221775554433')
    expect(normaliserNumero('00221775554433')).toBe('221775554433')
    expect(normaliserNumero('77 555 44 33')).toBe('221775554433') // 9 chiffres → 221
    expect(normaliserNumero('+221-77-555-44-33')).toBe('221775554433')
    expect(normaliserNumero('+33 6 12 34 56 78')).toBe('33612345678')
  })

  it('numéro à 9 chiffres → préfixe 221', () => {
    expect(normaliserNumero('77 555 44 33')).toBe('221775554433')
    expect(normaliserNumero('775554433')).toBe('221775554433')
  })

  it('contenu non numérique → chaîne vide', () => {
    expect(normaliserNumero('Fatou Ndiaye')).toBe('')
    expect(normaliserNumero('')).toBe('')
    expect(normaliserNumero(null)).toBe('')
    expect(normaliserNumero(undefined)).toBe('')
  })
})

describe('numeroClient', () => {
  it('préfère le champ téléphone dédié', () => {
    expect(numeroClient({ client_telephone: '+221 78 111 22 33', client_nom: 'Fatou' })).toBe(
      '221781112233',
    )
  })

  it('retombe sur client_nom si celui-ci est un numéro', () => {
    expect(numeroClient({ client_nom: '77 555 44 33' })).toBe('221775554433')
    expect(numeroClient({ client_nom: '+221 70 000 00 00' })).toBe('221700000000')
  })

  it('nom de client classique → pas de numéro', () => {
    expect(numeroClient({ client_nom: 'Fatou Ndiaye' })).toBe('')
    expect(numeroClient({})).toBe('')
  })
})

describe('construireTexte', () => {
  it('contient boutique, n°, date, lignes et total', () => {
    const t = construireTexte(vente, boutique)
    expect(t).toContain('Wagué Bussness Halal')
    expect(t).toContain('Vente n° 187')
    expect(t).toContain('04/11/2026')
    expect(t).toContain('Riz parfumé 25 kg ×1')
    expect(t).toContain('Jus d’orange 1 L ×2')
    expect(t).toContain('Total :')
    expect(t).toContain('Tél. +221 77 000 00 00')
  })

  it('mentionne le mode de vente des lignes (jamais au Détail)', () => {
    const avecModes = {
      ...vente,
      lignes: [
        {
          produit_nom: 'COLA',
          quantite: 2,
          montant_ligne: 30000,
          libelle: 'Carton',
          facteur: 12,
          est_detail: false,
        },
        {
          produit_nom: 'EAU',
          quantite: 3,
          montant_ligne: 1500,
          libelle: 'Détail',
          facteur: 1,
          est_detail: true,
        },
      ],
    }
    const t = construireTexte(avecModes, boutique)
    expect(t).toContain('COLA ×2 Carton (12) — ')
    expect(t).toContain('EAU ×3 — ')
    expect(t).not.toContain('EAU ×3 Détail')
  })

  it('tronque proprement sous la limite avec « … + N autres articles »', () => {
    const nombreuses = {
      ...vente,
      lignes: Array.from({ length: 60 }, (_, i) => ({
        produit_nom: `Produit numéro ${i + 1} avec un nom relativement long`,
        quantite: 3,
        montant_ligne: 9900,
      })),
    }
    const t = construireTexte(nombreuses, boutique)
    expect(t.length).toBeLessThanOrEqual(LIMITE_TEXTE)
    expect(t).toMatch(/… \+ \d+ autres articles/)
    expect(t).toContain('Total :') // le total reste toujours présent
  })

  it('troncature à 0 ligne → « … + N autre article » (singulier)', () => {
    const une = {
      ...vente,
      lignes: [{ produit_nom: 'x'.repeat(1400), quantite: 1, montant_ligne: 100 }],
    }
    const t = construireTexte(une, boutique)
    expect(t).toContain('… + 1 autre article')
    expect(t.length).toBeLessThanOrEqual(LIMITE_TEXTE)
  })

  it('sans lignes → texte minimal valide', () => {
    const t = construireTexte({ ...vente, lignes: [] }, { nom: 'Boutique X' })
    expect(t).toContain('Boutique X')
    expect(t).toContain('Total :')
    expect(t).not.toContain('autres articles')
  })
})

describe('buildWhatsAppLink', () => {
  it('avec numéro → wa.me/<numero> et texte encodé', () => {
    const lien = buildWhatsAppLink(
      { ...vente, client_telephone: '+221 77 555 44 33' },
      boutique,
    )
    expect(lien.startsWith('https://wa.me/221775554433?text=')).toBe(true)
    expect(lien).toContain(encodeURIComponent('Vente n° 187'))
    expect(lien).not.toContain(' ') // espace brut jamais present dans l'URL
    expect(decodeURIComponent(lien.split('?text=')[1])).toContain('Riz parfumé 25 kg ×1')
  })

  it('sans numéro → https://wa.me/?text=…', () => {
    const lien = buildWhatsAppLink(vente, boutique) // client_nom non numérique
    expect(lien.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(lien.split('?text=')[1])).toContain('Vente n° 187')
  })

  it('encodage des caractères spéciaux (apostrophes, accents, &)', () => {
    const lien = buildWhatsAppLink(
      { ...vente, client_nom: '', lignes: [{ produit_nom: 'Jus d’orange & sucre', quantite: 1, montant_ligne: 500 }] },
      boutique,
    )
    const texte = decodeURIComponent(lien.split('?text=')[1])
    expect(texte).toContain('Jus d’orange & sucre')
    expect(lien).not.toMatch(/[& ]Jus/) // l'& du texte est encodé
    expect(lien).toContain('%26')
  })
})
