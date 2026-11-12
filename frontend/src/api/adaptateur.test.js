/**
 * Adaptateur de contrat — tests de la SEULE frontière de traduction :
 * noms du contrat (« prix », « quantite », « total », « moyen_paiement »…)
 * ↔ noms vus par les écrans, alias legacy, snapshots de lignes.
 */
import { describe, expect, it } from 'vitest'
import { versVueLigne, versVueProduit, versVueVente } from './adaptateur.js'

describe('versVueProduit', () => {
  it('produit contrat → nombres + alias legacy', () => {
    const v = versVueProduit({
      id: 10,
      code: 'COLA',
      nom: 'Boisson gazeuse 1,5 L',
      categorie: 2,
      categorie_nom: 'Boissons',
      unite_base: 'bouteille',
      prix_achat: '1083.33',
      prix: '1500.00',
      quantite: 30,
      seuil_alerte: 9,
      conditionnements: [
        { id: 1, libelle: 'Détail', facteur: 1, prix_vente: '1500.00', est_detail: true, actif: true, ordre: 0 },
        { id: 3, libelle: 'Carton', facteur: 12, prix_vente: '15000.00', est_detail: false, actif: true, ordre: 2 },
      ],
    })
    expect(v.prix).toBe(1500)
    expect(v.prix_achat).toBe(1083.33)
    expect(v.quantite).toBe(30)
    expect(v.unite_base).toBe('bouteille')
    // alias legacy lus par les écrans non migrés
    expect(v.prix_unitaire).toBe(1500)
    expect(v.stock).toBe(30)
    expect(v.seuil).toBe(9)
    expect(v.conditionnements.map((m) => m.prix_vente)).toEqual([1500, 15000])
  })

  it('ancien format (sans conditionnements) → Détail dérivé + unite_base par défaut', () => {
    const v = versVueProduit({
      id: 1,
      code: 'RIZ',
      nom: 'Riz 25 kg',
      categorie: 1,
      prix_unitaire: '6200.00',
      stock: 4,
      seuil_alerte: 2,
    })
    expect(v.prix).toBe(6200)
    expect(v.quantite).toBe(4)
    expect(v.seuil_alerte).toBe(2)
    expect(v.unite_base).toBe('unité')
    expect(v.conditionnements).toHaveLength(1)
    expect(v.conditionnements[0]).toMatchObject({
      id: null,
      libelle: 'Détail',
      facteur: 1,
      est_detail: true,
      prix_vente: 6200,
    })
  })

  it('produit non objet → renvoyé tel quel', () => {
    expect(versVueProduit(null)).toBeNull()
    expect(versVueProduit(undefined)).toBeUndefined()
  })
})

describe('versVueLigne', () => {
  it('snapshot complet conservé (mode, unités de base, alias)', () => {
    const l = versVueLigne({
      produit: 10,
      conditionnement: 3,
      libelle: 'Carton',
      facteur: 12,
      est_detail: false,
      prix_unitaire: '15000.00',
      quantite: 2,
      quantite_base: 24,
      cout_unitaire_base: '1083.33',
      total_ligne: '30000.00',
    })
    expect(l).toMatchObject({
      facteur: 12,
      libelle: 'Carton',
      est_detail: false,
      quantite: 2,
      quantite_base: 24,
      prix_unitaire: 15000,
      cout_unitaire_base: 1083.33,
      total_ligne: 30000,
      montant_ligne: 30000, // @alias legacy
    })
  })

  it('ancienne ligne sans snapshot → Détail, unités = quantité', () => {
    const l = versVueLigne({ produit: 1, prix_unitaire: 200, quantite: 3 })
    expect(l).toMatchObject({
      facteur: 1,
      est_detail: true,
      libelle: 'Détail',
      quantite_base: 3,
      total_ligne: 600,
      montant_ligne: 600,
    })
  })

  it('libellé absent sur un mode non détail → « ×facteur »', () => {
    const l = versVueLigne({
      produit: 10,
      conditionnement: 2,
      facteur: 6,
      est_detail: false,
      prix_unitaire: 8000,
      quantite: 1,
      total_ligne: 8000,
    })
    expect(l.libelle).toBe('×6')
    expect(l.quantite_base).toBe(6)
  })
})

describe('versVueVente', () => {
  it('réponse POST (total / moyen_paiement) → les deux noms disponibles', () => {
    const v = versVueVente({
      id: 188,
      date_vente: '2026-11-12T12:00:00+00:00',
      client_nom: 'Fatou',
      total: '30000.00',
      moyen_paiement: 'ESPECES',
      produits_mis_a_jour: [{ id: 10, quantite: 6 }],
    })
    expect(v).toMatchObject({
      total: 30000,
      montant_total: 30000,
      moyen_paiement: 'ESPECES',
      mode_paiement: 'ESPECES',
    })
    expect(v.produits_mis_a_jour).toEqual([{ id: 10, quantite: 6 }])
  })

  it('réponse GET (montant_total / mode_paiement) → les deux noms disponibles', () => {
    const v = versVueVente({
      id: 187,
      date_vente: '2026-11-04T14:32:00+00:00',
      client_nom: '',
      montant_total: '4550.00',
      mode_paiement: 'WAVE',
    })
    expect(v).toMatchObject({
      total: 4550,
      montant_total: 4550,
      mode_paiement: 'WAVE',
      moyen_paiement: 'WAVE',
    })
  })

  it('lignes fournies (déjà adaptées par l’appelant) → conservées telles quelles', () => {
    const brute = { produit: 1, quantite: 2, prix_unitaire: '750.00' }
    const v = versVueVente(
      { id: 2, total: '1500.00', moyen_paiement: 'ESPECES' },
      [versVueLigne(brute)],
    )
    expect(v.lignes[0]).toMatchObject({
      quantite: 2,
      prix_unitaire: 750,
      total_ligne: 1500,
      montant_ligne: 1500,
    })
  })

  it('lignes imbriquées (GET détail) → adaptées automatiquement', () => {
    const v = versVueVente({
      id: 3,
      montant_total: '1500.00',
      mode_paiement: 'ESPECES',
      lignes: [{ produit: 1, quantite: 1, prix_unitaire: '1500.00' }],
    })
    expect(v.lignes[0].montant_ligne).toBe(1500)
    expect(v.lignes[0].est_detail).toBe(true)
  })
})
