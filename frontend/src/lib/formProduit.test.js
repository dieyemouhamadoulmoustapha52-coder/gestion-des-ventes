/**
 * Tests de la validation du formulaire produit (couche pure).
 * Règles du contrat : champs requis, entiers, prix > 0, puis
 * `validerConditionnements` (Détail unique, facteurs, prix, codes).
 */
import { describe, expect, it } from 'vitest'
import { entierSaisi, modesDepuisFormulaire, validerFormulaireProduit } from './formProduit.js'

/** Formulaire valide de base (3 modes, dont un nouveau sans id). */
function formulaire(surcharge = {}) {
  return {
    code: 'COLA',
    nom: 'Boisson gazeuse 1,5 L',
    categorie: '2',
    unite_base: 'bouteille',
    prix_achat: '1083.33',
    prix: '1500',
    quantite: '30',
    seuil_alerte: '9',
    modes: [
      { id: 1, libelle: 'Détail', facteur: '1', prix_vente: '1500', code: '', est_detail: true, actif: true },
      { id: 3, libelle: 'Carton', facteur: '12', prix_vente: '15000', code: 'COLA12', est_detail: false, actif: true },
      { id: null, libelle: 'Lot de 3', facteur: '3', prix_vente: '4200', code: 'cola3', est_detail: false, actif: true },
    ],
    ...surcharge,
  }
}

describe('entierSaisi', () => {
  it('accepte vide (0), entiers, refuse décimal/négatif/texte', () => {
    expect(entierSaisi('')).toBe(0)
    expect(entierSaisi(' 12 ')).toBe(12)
    expect(entierSaisi('2.5')).toBeNull()
    expect(entierSaisi('-1')).toBeNull()
    expect(entierSaisi('abc')).toBeNull()
  })
})

describe('modesDepuisFormulaire', () => {
  it('force le Détail en facteur 1 sans code et avec le prix du détail', () => {
    const modes = modesDepuisFormulaire(formulaire(), 1500)
    expect(modes[0]).toMatchObject({ facteur: 1, code: '', est_detail: true, prix_vente: 1500 })
    expect(modes[2]).toMatchObject({ facteur: 3, code: 'COLA3', est_detail: false, id: null })
  })
})

describe('validerFormulaireProduit', () => {
  it('formulaire valide → payload du contrat complet', () => {
    const r = validerFormulaireProduit(formulaire(), { codesProduits: ['EAU15', 'SAVON'] })
    expect(r.valide).toBe(true)
    expect(r.champs).toEqual({})
    expect(r.global).toEqual([])
    expect(r.data).toMatchObject({
      code: 'COLA',
      nom: 'Boisson gazeuse 1,5 L',
      categorie: 2,
      unite_base: 'bouteille',
      prix_achat: 1083.33,
      prix: 1500,
      quantite: 30,
      seuil_alerte: 9,
    })
    expect(r.data.conditionnements).toHaveLength(3)
    expect(r.data.conditionnements[0]).toEqual({
      id: 1,
      libelle: 'Détail',
      facteur: 1,
      prix_vente: 1500,
      est_detail: true,
    })
    // le nouveau mode n'a pas d'id (le service en attribue) — code en MAJUSCULES
    expect(r.data.conditionnements[2]).not.toHaveProperty('id')
    expect(r.data.conditionnements[2]).toMatchObject({
      code: 'COLA3',
      facteur: 3,
      prix_vente: 4200,
      est_detail: false,
    })
  })

  it('champs requis et prix manquants', () => {
    const r = validerFormulaireProduit(formulaire({
      code: '  ',
      nom: '',
      categorie: '',
      prix: '',
      modes: [{ id: null, libelle: 'Détail', facteur: '1', prix_vente: '', code: '', est_detail: true }],
    }))
    expect(r.valide).toBe(false)
    expect(r.champs).toMatchObject({
      code: 'Ce champ est requis.',
      nom: 'Ce champ est requis.',
      categorie: 'Ce champ est requis.',
      prix: 'Le prix doit être supérieur à 0.',
    })
    expect(r.data).toBeNull()
  })

  it('quantité, seuil, coût et unité invalides', () => {
    const r = validerFormulaireProduit(formulaire({
      quantite: '2.5',
      seuil_alerte: '-3',
      prix_achat: '-1',
      unite_base: 'x'.repeat(31),
    }))
    expect(r.valide).toBe(false)
    expect(r.champs.quantite).toBe('Entier positif attendu.')
    expect(r.champs.seuil_alerte).toBe('Entier positif attendu.')
    expect(r.champs.prix_achat).toBe('Saisissez un coût valide (≥ 0).')
    expect(r.champs.unite_base).toContain('30')
  })

  it('exige un seul mode au détail', () => {
    const sansDetail = validerFormulaireProduit(formulaire({
      modes: [{ id: null, libelle: 'Carton', facteur: '12', prix_vente: '15000', code: 'C12', est_detail: false }],
    }))
    expect(sansDetail.valide).toBe(false)
    expect(sansDetail.global.join(' ')).toMatch(/détail/i)

    const deuxDetails = validerFormulaireProduit(formulaire({
      modes: [
        { id: 1, libelle: 'Détail', facteur: '1', prix_vente: '1500', code: '', est_detail: true },
        { id: null, libelle: 'Mini', facteur: '1', prix_vente: '500', code: '', est_detail: true },
      ],
    }))
    expect(deuxDetails.global.join(' ')).toMatch(/seul mode/i)
  })

  it('facteur et prix de mode invalides', () => {
    const r = validerFormulaireProduit(formulaire({
      modes: [
        { id: 1, libelle: 'Détail', facteur: '1', prix_vente: '1500', code: '', est_detail: true },
        { id: null, libelle: 'Carton', facteur: '12.5', prix_vente: '0', code: 'C12', est_detail: false },
        { id: null, libelle: 'Lot', facteur: '', prix_vente: '3000', code: 'L3', est_detail: false },
      ],
    }))
    expect(r.valide).toBe(false)
    expect(r.parMode[1].facteur).toMatch(/entier/)
    expect(r.parMode[1].prix_vente).toMatch(/supérieur à 0/)
    expect(r.parMode[2].facteur).toMatch(/entier/)
  })

  it('libellés dupliqués pour un même produit', () => {
    const r = validerFormulaireProduit(formulaire({
      modes: [
        { id: 1, libelle: 'Détail', facteur: '1', prix_vente: '1500', code: '', est_detail: true },
        { id: null, libelle: 'Carton', facteur: '12', prix_vente: '15000', code: 'A', est_detail: false },
        { id: null, libelle: 'carton', facteur: '6', prix_vente: '8000', code: 'B', est_detail: false },
      ],
    }))
    expect(r.parMode[2].libelle).toMatch(/déjà utilisé/)
  })

  it('code de mode déjà pris dans le catalogue', () => {
    const r = validerFormulaireProduit(formulaire(), { codesProduits: ['COLA3', 'EAU15'] })
    expect(r.valide).toBe(false)
    expect(r.parMode[2].code).toMatch(/déjà utilisé/)
  })

  it('code d’un mode retiré reste occupé', () => {
    const produit = {
      conditionnements: [
        { id: 1, libelle: 'Détail', facteur: 1, code: '', est_detail: true, actif: true },
        { id: 2, libelle: 'Demi-carton', facteur: 6, code: 'COLA6', est_detail: false, actif: true },
      ],
    }
    const r = validerFormulaireProduit(formulaire({
      modes: [
        { id: 1, libelle: 'Détail', facteur: '1', prix_vente: '1500', code: '', est_detail: true },
        { id: null, libelle: 'Lot de 6', facteur: '6', prix_vente: '8000', code: 'COLA6', est_detail: false },
      ],
    }), { produit })
    expect(r.parMode[1].code).toMatch(/déjà utilisé/)
  })

  it('modes existants conservent leur id, retrait possible', () => {
    const r = validerFormulaireProduit(formulaire({
      modes: [
        { id: 1, libelle: 'Détail', facteur: '1', prix_vente: '1500', code: '', est_detail: true },
        { id: 3, libelle: 'Carton', facteur: '12', prix_vente: '16000', code: 'COLA12', est_detail: false },
      ],
    }))
    expect(r.valide).toBe(true)
    expect(r.data.conditionnements.map((m) => m.id)).toEqual([1, 3])
    expect(r.data.conditionnements[1].prix_vente).toBe(16000)
  })
})
