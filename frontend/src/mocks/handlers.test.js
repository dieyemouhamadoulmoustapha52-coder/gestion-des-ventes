/**
 * Tests des handlers MSW (mode mock, aucune écriture backend).
 * Appel direct des résolveurs (pas de serveur) + état réinitialisé
 * à chaque test à partir de la graine de démonstration.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { handlers } from './handlers.js'
import * as db from './db.js'

const SEED = structuredClone(db.state)

/** Résolveur MSW correspondant à `method` + `path` (pattern du handler). */
function trouver(method, path) {
  const h = handlers.find(
    (x) => x.info.method === method.toUpperCase() && x.info.path === path,
  )
  if (!h) throw new Error(`Handler introuvable : ${method} ${path}`)
  return h
}

/**
 * Exécute un handler et renvoie `{status, body}`.
 * @param {string} method
 * @param {string} path pattern exact du handler
 * @param {{body?: any, params?: Record<string,string>, query?: string}} [opts]
 */
async function appel(method, path, { body, params = {}, query = '' } = {}) {
  // L'URL doit satisfaire le pattern du handler (la prédication MSW matche l'URL)
  const chemin = path
    .replace(/^\*/, 'http://localhost')
    .replace(/:(\w+)/g, (_, cle) => String(params[cle] ?? ''))
  const url = query ? `${chemin}?${query}` : chemin
  const request = new Request(url, {
    method: method.toUpperCase(),
    ...(body !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  })
  const out = await trouver(method, path).run({ request, params, requestId: 'test' })
  if (!out) throw new Error(`Aucune réponse : ${method} ${url}`)
  const res = out.response
  const texte = await res.text()
  let json = null
  if (texte) {
    try {
      json = JSON.parse(texte)
    } catch {
      json = texte
    }
  }
  return { status: res.status, body: json }
}

const COLA = '*/api/produits/:id/'
const PRODUITS = '*/api/produits/'
const VENTES = '*/api/ventes/'
const REAPPRO = '*/api/produits/:id/reapprovisionner/'

beforeEach(() => {
  Object.assign(db.state, structuredClone(SEED))
})

describe('GET produits', () => {
  it('forme contrat : prix/quantite/unite_base + conditionnements', async () => {
    const { status, body } = await appel('GET', PRODUITS, { query: 'page_size=50' })
    expect(status).toBe(200)
    const cola = body.results.find((p) => p.code === 'COLA')
    expect(cola).toMatchObject({
      quantite: 30,
      unite_base: 'bouteille',
      prix: '1500.00',
      prix_achat: '1083.33',
      seuil_alerte: 9,
      est_en_alerte: false,
    })
    expect(cola.conditionnements).toHaveLength(3)
    expect(cola.conditionnements[0]).toMatchObject({
      libelle: 'Détail',
      facteur: 1,
      prix_vente: '1500.00',
      est_detail: true,
      actif: true,
      ordre: 0,
    })
    // tout produit expose au moins un mode Détail (dérivé si absent)
    for (const p of body.results) {
      expect(p.conditionnements.some((m) => m.est_detail)).toBe(true)
    }
  })

  it('stock_bas filtre sur quantite <= seuil_alerte', async () => {
    const { body } = await appel('GET', PRODUITS, {
      query: 'stock_bas=true&page_size=50',
    })
    expect(body.results.length).toBeGreaterThan(0)
    expect(body.results.every((p) => p.quantite <= p.seuil_alerte)).toBe(true)
    expect(body.results.some((p) => p.code === 'JAVEL')).toBe(true) // stock 0
    expect(body.results.some((p) => p.code === 'COLA')).toBe(false) // 30 > 9
  })
})

describe('POST produits', () => {
  const base = {
    code: 'TEST1',
    nom: 'Yaourt test',
    categorie: 1,
    unite_base: 'boîte',
    prix_achat: 700,
    prix: 1000,
    quantite: 12,
    seuil_alerte: 3,
  }

  it('crée avec la liste de modes fournie (ids attribués)', async () => {
    const { status, body } = await appel('POST', PRODUITS, {
      body: {
        ...base,
        conditionnements: [
          { libelle: 'Détail', facteur: 1, prix_vente: 1000 },
          { libelle: 'Lot de 6', facteur: 6, prix_vente: 5500, code: 'test16' },
        ],
      },
    })
    expect(status).toBe(201)
    expect(body.prix).toBe('1000.00')
    expect(body.unite_base).toBe('boîte')
    const detail = body.conditionnements.find((m) => m.est_detail)
    expect(detail.id).not.toBeNull()
    expect(detail.prix_vente).toBe('1000.00')
    const lot = body.conditionnements.find((m) => !m.est_detail)
    expect(lot).toMatchObject({ code: 'TEST16', facteur: 6, ordre: 1, actif: true })
  })

  it('sans conditionnements : Détail dérivé de prix', async () => {
    const { status, body } = await appel('POST', PRODUITS, { body: base })
    expect(status).toBe(201)
    expect(body.conditionnements).toHaveLength(1)
    expect(body.conditionnements[0]).toMatchObject({
      facteur: 1,
      est_detail: true,
      prix_vente: '1000.00',
    })
  })

  it('accepte l’ancien format (prix_unitaire / stock)', async () => {
    const { status, body } = await appel('POST', PRODUITS, {
      body: {
        code: 'ANCIEN',
        nom: 'Ancien format',
        categorie: 1,
        prix_unitaire: 800,
        stock: 5,
        seuil_alerte: 2,
      },
    })
    expect(status).toBe(201)
    expect(body.prix).toBe('800.00')
    expect(body.quantite).toBe(5)
    expect(body.prix_achat).toBe('0.00')
  })

  it('refuse un mode Détail manquant', async () => {
    const { status, body } = await appel('POST', PRODUITS, {
      body: {
        ...base,
        conditionnements: [{ libelle: 'Lot', facteur: 6, prix_vente: 5000, code: 'T16' }],
      },
    })
    expect(status).toBe(400)
    expect(body.conditionnements).toBeDefined()
    expect(body.conditionnements.join(' ')).toMatch(/détail/i)
  })

  it('refuse un code déjà pris (produit ou mode)', async () => {
    const dup = await appel('POST', PRODUITS, { body: { ...base, code: 'COLA' } })
    expect(dup.status).toBe(400)
    expect(dup.body.code).toBeDefined()

    const dupMode = await appel('POST', PRODUITS, {
      body: {
        ...base,
        conditionnements: [
          { libelle: 'Détail', facteur: 1, prix_vente: 1000 },
          { libelle: 'Carton', facteur: 12, prix_vente: 15000, code: 'cola12' },
        ],
      },
    })
    expect(dupMode.status).toBe(400)
    expect(dupMode.body.conditionnements.join(' ')).toMatch(/déjà utilisé/i)
  })

  it('refuse un prix absent', async () => {
    const { status, body } = await appel('POST', PRODUITS, {
      body: { ...base, prix: undefined },
    })
    expect(status).toBe(400)
    expect(body.prix).toBeDefined()
  })
})

describe('PUT produits (liste complète)', () => {
  it('remplace la liste : id = mise à jour, sans id = nouveau, absent = actif:false', async () => {
    const { status, body } = await appel('PUT', COLA, {
      params: { id: '10' },
      body: {
        code: 'COLA',
        nom: 'Boisson gazeuse 1,5 L',
        categorie: 2,
        unite_base: 'bouteille',
        prix_achat: 1083.33,
        quantite: 30,
        seuil_alerte: 9,
        conditionnements: [
          { id: 1, libelle: 'Détail', facteur: 1, prix_vente: 1500 },
          { id: 3, libelle: 'Carton', facteur: 12, prix_vente: 15000, code: 'COLA12' },
          { libelle: 'Lot de 3', facteur: 3, prix_vente: 4200, code: 'cola3' },
        ],
      },
    })
    expect(status).toBe(200)
    expect(body.prix).toBe('1500.00')

    const cola = db.findProduit(10)
    const demi = cola.conditionnements.find((m) => m.id === 2)
    expect(demi).toBeDefined()
    expect(demi.actif).toBe(false) // jamais supprimé

    const lot = cola.conditionnements.find((m) => m.code === 'COLA3')
    expect(lot).toMatchObject({ facteur: 3, prix_vente: 4200, actif: true, ordre: 2 })
    expect(lot.id).not.toBeNull()

    const actifs = cola.conditionnements.filter((m) => m.actif)
    expect(actifs.map((m) => m.ordre)).toEqual([0, 1, 2])
    expect(actifs.map((m) => m.libelle)).toEqual(['Détail', 'Carton', 'Lot de 3'])
    expect(cola.quantite).toBe(30)
  })

  it('refuse un mode id inconnu', async () => {
    const { status, body } = await appel('PUT', COLA, {
      params: { id: '10' },
      body: {
        code: 'COLA',
        nom: 'Boisson gazeuse 1,5 L',
        categorie: 2,
        prix_achat: 1083.33,
        quantite: 30,
        seuil_alerte: 9,
        conditionnements: [
          { id: 999, libelle: 'Détail', facteur: 1, prix_vente: 1500 },
        ],
      },
    })
    expect(status).toBe(400)
    expect(body.conditionnements).toBeDefined()
  })

  it('sans conditionnements : ancien format, prix synchronisé sur le Détail', async () => {
    const { status, body } = await appel('PUT', COLA, {
      params: { id: '10' },
      body: {
        code: 'COLA',
        nom: 'Boisson gazeuse 1,5 L',
        categorie: 2,
        prix_unitaire: 1600,
        stock: 25,
        seuil_alerte: 9,
      },
    })
    expect(status).toBe(200)
    expect(body.prix).toBe('1600.00')
    expect(body.quantite).toBe(25)
    const detail = db.findProduit(10).conditionnements.find((m) => m.est_detail)
    expect(detail.prix_vente).toBe(1600)
  })
})

describe('PATCH produits', () => {
  it('prix synchronisé sur le mode Détail', async () => {
    const { status, body } = await appel('PATCH', COLA, {
      params: { id: '10' },
      body: { prix: 1650 },
    })
    expect(status).toBe(200)
    expect(body.prix).toBe('1650.00')
    const detail = db.findProduit(10).conditionnements.find((m) => m.est_detail)
    expect(detail.prix_vente).toBe(1650)
    // les autres modes ne bougent pas
    expect(db.findProduit(10).conditionnements.find((m) => m.id === 3).prix_vente).toBe(15000)
  })

  it('refuse conditionnements (PUT obligatoire)', async () => {
    const { status, body } = await appel('PATCH', COLA, {
      params: { id: '10' },
      body: { nom: 'X', conditionnements: [] },
    })
    expect(status).toBe(400)
    expect(body.conditionnements).toBeDefined()
  })

  it('accepte quantite / seuil_alerte en noms du contrat', async () => {
    const { status, body } = await appel('PATCH', COLA, {
      params: { id: '10' },
      body: { quantite: 42, seuil_alerte: 5 },
    })
    expect(status).toBe(200)
    expect(body.quantite).toBe(42)
    expect(body.seuil_alerte).toBe(5)
  })
})

describe('reapprovisionner', () => {
  it('sans conditionnement : +quantite en unités de base', async () => {
    const { status, body } = await appel('POST', REAPPRO, {
      params: { id: '10' },
      body: { quantite: 5 },
    })
    expect(status).toBe(200)
    expect(body.quantite).toBe(35)
  })

  it('avec conditionnement : +quantite × facteur', async () => {
    const { status, body } = await appel('POST', REAPPRO, {
      params: { id: '10' },
      body: { quantite: 5, conditionnement: 3 },
    })
    expect(status).toBe(200)
    expect(body.quantite).toBe(30 + 5 * 12) // 90
  })

  it('refuse un mode étranger ou inactif', async () => {
    const etranger = await appel('POST', REAPPRO, {
      params: { id: '10' },
      body: { quantite: 1, conditionnement: 7 }, // SAVON24
    })
    expect(etranger.status).toBe(400)
    expect(etranger.body.code).toBe('conditionnement_invalide')

    await appel('PUT', COLA, {
      params: { id: '10' },
      body: {
        code: 'COLA',
        nom: 'Boisson gazeuse 1,5 L',
        categorie: 2,
        prix_achat: 1083.33,
        quantite: 30,
        seuil_alerte: 9,
        conditionnements: [
          { id: 1, libelle: 'Détail', facteur: 1, prix_vente: 1500 },
          { id: 2, libelle: 'Demi-carton', facteur: 6, prix_vente: 8000, code: 'COLA6' },
        ],
      },
    })
    const inactif = await appel('POST', REAPPRO, {
      params: { id: '10' },
      body: { quantite: 1, conditionnement: 3 }, // retiré → actif:false
    })
    expect(inactif.status).toBe(400)
    expect(inactif.body.code).toBe('conditionnement_invalide')
  })

  it('refuse une quantité non entière ou nulle', async () => {
    const { status, body } = await appel('POST', REAPPRO, {
      params: { id: '10' },
      body: { quantite: 0 },
    })
    expect(status).toBe(400)
    expect(body.quantite).toBeDefined()
  })
})

describe('POST ventes', () => {
  const vente = (lignes, extra = {}) => ({
    mode_paiement: 'ESPECES',
    client_nom: 'Client test',
    lignes,
    ...extra,
  })

  it('2 cartons COLA : stock 30 → 6, total 30 000, snapshot complet', async () => {
    const avant = db.state.ventes.length
    const { status, body } = await appel('POST', VENTES, {
      body: vente([{ produit: 10, conditionnement: 3, quantite: 2 }]),
    })
    expect(status).toBe(201)
    expect(body.total).toBe('30000.00')
    expect(body.moyen_paiement).toBe('ESPECES')
    expect(body.date_vente).toBeDefined()
    expect(body.client_nom).toBe('Client test')
    expect(db.findProduit(10).quantite).toBe(6)
    expect(body.produits_mis_a_jour).toEqual([{ id: 10, quantite: 6 }])
    expect(db.state.ventes.length).toBe(avant + 1)

    const l = body.lignes[0]
    expect(l).toMatchObject({
      produit: 10,
      conditionnement: 3,
      libelle: 'Carton',
      facteur: 12,
      est_detail: false,
      quantite: 2,
      quantite_base: 24,
      prix_unitaire: '15000.00',
      cout_unitaire_base: '1083.33',
      total_ligne: '30000.00',
    })
  })

  it('sans conditionnement : vente en Détail', async () => {
    const { status, body } = await appel('POST', VENTES, {
      body: vente([{ produit: 10, quantite: 2 }]),
    })
    expect(status).toBe(201)
    expect(body.total).toBe('3000.00')
    expect(db.findProduit(10).quantite).toBe(28)
    expect(body.lignes[0]).toMatchObject({
      conditionnement: 1, // le Détail résolu (id du mode)
      libelle: 'Détail',
      facteur: 1,
      est_detail: true,
      quantite_base: 2,
    })
  })

  it('3 cartons (36 > 30) : 409 sans aucune écriture', async () => {
    const ventesAvant = db.state.ventes.length
    const lignesAvant = db.state.lignes.length
    const { status, body } = await appel('POST', VENTES, {
      body: vente([{ produit: 10, conditionnement: 3, quantite: 3 }]),
    })
    expect(status).toBe(409)
    expect(body).toMatchObject({
      code: 'stock_insuffisant',
      produit: 10,
      demande_base: 36,
      disponible_base: 30,
    })
    expect(db.findProduit(10).quantite).toBe(30)
    expect(db.state.ventes.length).toBe(ventesAvant)
    expect(db.state.lignes.length).toBe(lignesAvant)
  })

  it('cumul de lignes avant contrôle (carton + détail > stock)', async () => {
    const { status, body } = await appel('POST', VENTES, {
      body: vente([
        { produit: 10, conditionnement: 3, quantite: 2 }, // 24
        { produit: 10, quantite: 10 }, // 10 → 34
      ]),
    })
    expect(status).toBe(409)
    expect(body).toMatchObject({ demande_base: 34, disponible_base: 30 })
    expect(db.findProduit(10).quantite).toBe(30)
  })

  it('cumul autorisé : deux lignes qui passent ensemble', async () => {
    const { status, body } = await appel('POST', VENTES, {
      body: vente([
        { produit: 10, conditionnement: 3, quantite: 2 }, // 24
        { produit: 10, quantite: 6 }, // 6 → 30
      ]),
    })
    expect(status).toBe(201)
    expect(body.total).toBe((2 * 15000 + 6 * 1500).toFixed(2))
    expect(db.findProduit(10).quantite).toBe(0)
    expect(body.lignes).toHaveLength(2)
    expect(body.produits_mis_a_jour).toEqual([{ id: 10, quantite: 0 }])
  })

  it('refuse un mode étranger ou inactif', async () => {
    const etranger = await appel('POST', VENTES, {
      body: vente([{ produit: 10, conditionnement: 7, quantite: 1 }]),
    })
    expect(etranger.status).toBe(400)
    expect(etranger.body).toMatchObject({ code: 'conditionnement_invalide', produit: 10 })

    await appel('PUT', COLA, {
      params: { id: '10' },
      body: {
        code: 'COLA',
        nom: 'Boisson gazeuse 1,5 L',
        categorie: 2,
        prix_achat: 1083.33,
        quantite: 30,
        seuil_alerte: 9,
        conditionnements: [
          { id: 1, libelle: 'Détail', facteur: 1, prix_vente: 1500 },
          { id: 2, libelle: 'Demi-carton', facteur: 6, prix_vente: 8000, code: 'COLA6' },
        ],
      },
    })
    const inactif = await appel('POST', VENTES, {
      body: vente([{ produit: 10, conditionnement: 3, quantite: 1 }]),
    })
    expect(inactif.status).toBe(400)
    expect(inactif.body.code).toBe('conditionnement_invalide')
    expect(db.findProduit(10).quantite).toBe(30)
  })

  it('les snapshots survivent à un changement de facteur/prix', async () => {
    const { body: cree } = await appel('POST', VENTES, {
      body: vente([{ produit: 10, conditionnement: 3, quantite: 1 }]),
    })
    expect(cree.total).toBe('15000.00')

    await appel('PUT', COLA, {
      params: { id: '10' },
      body: {
        code: 'COLA',
        nom: 'Boisson gazeuse 1,5 L',
        categorie: 2,
        prix_achat: 1083.33,
        quantite: 18,
        seuil_alerte: 9,
        conditionnements: [
          { id: 1, libelle: 'Détail', facteur: 1, prix_vente: 1500 },
          { id: 2, libelle: 'Demi-carton', facteur: 6, prix_vente: 8000, code: 'COLA6' },
          { id: 3, libelle: 'Carton', facteur: 10, prix_vente: 12000, code: 'COLA10' },
        ],
      },
    })

    const { body: detail } = await appel('GET', '*/api/ventes/:id/', {
      params: { id: String(cree.id) },
    })
    expect(detail.montant_total).toBe('15000.00')
    expect(detail.lignes[0]).toMatchObject({
      facteur: 12,
      prix_unitaire: '15000.00',
      quantite_base: 12,
      total_ligne: '15000.00',
      libelle: 'Carton',
    })
  })

  it('GET ventes conserve montant_total / mode_paiement (ancien contrat)', async () => {
    const { body } = await appel('GET', VENTES, { query: 'page_size=1' })
    const v = body.results[0]
    expect(v.montant_total).toBeDefined()
    expect(v.mode_paiement).toBeDefined()
  })
})
