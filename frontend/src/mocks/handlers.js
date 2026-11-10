/**
 * Handlers MSW — implémentation EXACTE de docs/API_CONTRACT.md :
 * URLs avec slash final, pagination DRF, DecimalField en chaînes,
 * latence 200-400 ms, erreurs 400 par champ, 409 stock_insuffisant.
 */
import { http, HttpResponse, delay } from 'msw'
import * as db from './db.js'
import { dateDakar, decaleJours } from '../lib/dates.js'

const wait = () => delay(200 + Math.random() * 200)
const ok = async (body) => {
  await wait()
  return HttpResponse.json(body)
}
const created = async (body) => {
  await wait()
  return HttpResponse.json(body, { status: 201 })
}
const fail = async (status, body) => {
  await wait()
  return HttpResponse.json(body, { status })
}
const noContent = async () => {
  await wait()
  return new HttpResponse(null, { status: 204 })
}

/** Enveloppe de pagination DRF (page_size par défaut 10, options 10/25/50). */
function paginate(list, request) {
  const u = new URL(request.url)
  const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10) || 1)
  const brut = parseInt(u.searchParams.get('page_size') || '10', 10)
  const size = [10, 25, 50].includes(brut) ? brut : 10
  const count = list.length
  const start = (page - 1) * size
  const href = (p) => `${u.origin}${u.pathname}?page=${p}&page_size=${size}`
  return {
    count,
    next: start + size < count ? href(page + 1) : null,
    previous: page > 1 ? href(page - 1) : null,
    results: list.slice(start, start + size),
  }
}

/** Recherche insensible à la casse et aux accents. */
const fold = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

const sortedByNom = (list) => [...list].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

/** Date AAAA-MM-JJ stricte (équivalent DateField DRF) : format + date réelle. */
function parseDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export const handlers = [
  // ── categories/ ─────────────────────────────────────────────
  http.get('*/api/categories/', ({ request }) => {
    const list = sortedByNom(db.state.categories).map(db.serializeCategorie)
    return ok(paginate(list, request))
  }),

  http.post('*/api/categories/', async ({ request }) => {
    const body = await request.json().catch(() => ({}))
    const nom = String(body.nom ?? '').trim()
    if (!nom) return fail(400, { nom: ['Ce champ est requis.'] })
    if (db.state.categories.some((c) => fold(c.nom) === fold(nom))) {
      return fail(400, { nom: ['Une catégorie avec ce nom existe déjà.'] })
    }
    const cat = { id: db.state.seq.categorie++, nom, description: String(body.description ?? '').trim() }
    db.state.categories.push(cat)
    return created(db.serializeCategorie(cat))
  }),

  http.get('*/api/categories/:id/', ({ params }) => {
    const cat = db.findCategorie(params.id)
    return cat ? ok(db.serializeCategorie(cat)) : fail(404, { detail: 'Non trouvé.' })
  }),

  http.put('*/api/categories/:id/', async ({ params, request }) => {
    const cat = db.findCategorie(params.id)
    if (!cat) return fail(404, { detail: 'Non trouvé.' })
    const body = await request.json().catch(() => ({}))
    const nom = String(body.nom ?? '').trim()
    if (!nom) return fail(400, { nom: ['Ce champ est requis.'] })
    if (db.state.categories.some((c) => c.id !== cat.id && fold(c.nom) === fold(nom))) {
      return fail(400, { nom: ['Une catégorie avec ce nom existe déjà.'] })
    }
    cat.nom = nom
    cat.description = String(body.description ?? '').trim()
    return ok(db.serializeCategorie(cat))
  }),

  http.delete('*/api/categories/:id/', ({ params }) => {
    const id = Number(params.id)
    if (!db.findCategorie(id)) return fail(404, { detail: 'Non trouvé.' })
    if (db.state.produits.some((p) => p.categorie === id)) {
      // PROTECT Django : catégorie utilisée
      return fail(409, { detail: 'Impossible de supprimer : des produits utilisent cette catégorie.' })
    }
    db.state.categories = db.state.categories.filter((c) => c.id !== id)
    return noContent()
  }),

  // ── produits/ ───────────────────────────────────────────────
  http.get('*/api/produits/', ({ request }) => {
    const u = new URL(request.url)
    const search = (u.searchParams.get('search') || '').trim()
    const categorie = u.searchParams.get('categorie')
    const stockBas = u.searchParams.get('stock_bas') === 'true'

    let list = db.state.produits
    if (search) {
      const q = fold(search)
      list = list.filter((p) => fold(p.code).includes(q) || fold(p.nom).includes(q))
    }
    if (categorie) list = list.filter((p) => p.categorie === Number(categorie))
    if (stockBas) list = list.filter((p) => p.stock <= p.seuil)

    const list2 = sortedByNom(list).map(db.serializeProduit)
    return ok(paginate(list2, request))
  }),

  http.post('*/api/produits/', async ({ request }) => {
    const body = await request.json().catch(() => ({}))
    const errors = {}
    const code = String(body.code ?? '').trim()
    const nom = String(body.nom ?? '').trim()
    const categorie = Number(body.categorie)
    const prix = Number(body.prix_unitaire)

    if (!code) errors.code = ['Ce champ est requis.']
    else if (db.state.produits.some((p) => fold(p.code) === fold(code))) {
      errors.code = ['produit avec ce code existe déjà.']
    }
    if (!nom) errors.nom = ['Ce champ est requis.']
    if (!db.findCategorie(categorie)) errors.categorie = ['Cette catégorie n\'existe pas.']
    if (body.prix_unitaire === undefined || !Number.isFinite(prix) || prix < 0) {
      errors.prix_unitaire = ['Saisissez un prix valide (≥ 0).']
    }
    const stock = body.stock === undefined ? 0 : Number(body.stock)
    const seuil = body.seuil_alerte === undefined ? 0 : Number(body.seuil_alerte)
    if (!Number.isInteger(stock) || stock < 0) errors.stock = ['Entier positif attendu.']
    if (!Number.isInteger(seuil) || seuil < 0) errors.seuil_alerte = ['Entier positif attendu.']
    if (Object.keys(errors).length) return fail(400, errors)

    const p = {
      id: db.state.seq.produit++, code, nom, categorie,
      prix, stock, seuil,
    }
    db.state.produits.push(p)
    return created(db.serializeProduit(p))
  }),

  http.get('*/api/produits/:id/', ({ params }) => {
    const p = db.findProduit(params.id)
    return p ? ok(db.serializeProduit(p)) : fail(404, { detail: 'Non trouvé.' })
  }),

  http.patch('*/api/produits/:id/', async ({ params, request }) => {
    const p = db.findProduit(params.id)
    if (!p) return fail(404, { detail: 'Non trouvé.' })
    const body = await request.json().catch(() => ({}))
    const errors = {}
    const next = {} // on ne mutate qu'après validation complète

    if (body.code !== undefined) {
      const code = String(body.code).trim()
      if (!code) errors.code = ['Ce champ est requis.']
      else if (db.state.produits.some((x) => x.id !== p.id && fold(x.code) === fold(code))) {
        errors.code = ['produit avec ce code existe déjà.']
      } else next.code = code
    }
    if (body.nom !== undefined) {
      const nom = String(body.nom).trim()
      if (!nom) errors.nom = ['Ce champ est requis.']
      else next.nom = nom
    }
    if (body.categorie !== undefined) {
      const cat = db.findCategorie(body.categorie)
      if (!cat) errors.categorie = ['Cette catégorie n\'existe pas.']
      else next.categorie = cat.id
    }
    if (body.prix_unitaire !== undefined) {
      const prix = Number(body.prix_unitaire)
      if (!Number.isFinite(prix) || prix < 0) errors.prix_unitaire = ['Saisissez un prix valide (≥ 0).']
      else next.prix = prix
    }
    if (body.stock !== undefined) {
      const stock = Number(body.stock)
      if (!Number.isInteger(stock) || stock < 0) errors.stock = ['Entier positif attendu.']
      else next.stock = stock
    }
    if (body.seuil_alerte !== undefined) {
      const seuil = Number(body.seuil_alerte)
      if (!Number.isInteger(seuil) || seuil < 0) errors.seuil_alerte = ['Entier positif attendu.']
      else next.seuil = seuil
    }
    if (Object.keys(errors).length) return fail(400, errors)
    Object.assign(p, next)
    return ok(db.serializeProduit(p))
  }),

  http.put('*/api/produits/:id/', async ({ params, request }) => {
    const p = db.findProduit(params.id)
    if (!p) return fail(404, { detail: 'Non trouvé.' })
    const body = await request.json().catch(() => ({}))
    const errors = {}
    const code = String(body.code ?? '').trim()
    const nom = String(body.nom ?? '').trim()
    const categorie = Number(body.categorie)
    const prix = Number(body.prix_unitaire)
    const stock = body.stock === undefined ? p.stock : Number(body.stock)
    const seuil = body.seuil_alerte === undefined ? p.seuil : Number(body.seuil_alerte)

    if (!code) errors.code = ['Ce champ est requis.']
    else if (db.state.produits.some((x) => x.id !== p.id && fold(x.code) === fold(code))) {
      errors.code = ['produit avec ce code existe déjà.']
    }
    if (!nom) errors.nom = ['Ce champ est requis.']
    if (!db.findCategorie(categorie)) errors.categorie = ['Cette catégorie n\'existe pas.']
    if (body.prix_unitaire === undefined || !Number.isFinite(prix) || prix < 0) {
      errors.prix_unitaire = ['Saisissez un prix valide (≥ 0).']
    }
    if (!Number.isInteger(stock) || stock < 0) errors.stock = ['Entier positif attendu.']
    if (!Number.isInteger(seuil) || seuil < 0) errors.seuil_alerte = ['Entier positif attendu.']
    if (Object.keys(errors).length) return fail(400, errors)

    Object.assign(p, { code, nom, categorie, prix, stock, seuil })
    return ok(db.serializeProduit(p))
  }),

  http.delete('*/api/produits/:id/', ({ params }) => {
    const id = Number(params.id)
    if (!db.findProduit(id)) return fail(404, { detail: 'Non trouvé.' })
    if (db.state.lignes.some((l) => l.produit === id)) {
      // PROTECT Django : produit vendu
      return fail(409, { detail: 'Impossible de supprimer : ce produit figure dans des ventes.' })
    }
    db.state.produits = db.state.produits.filter((p) => p.id !== id)
    return noContent()
  }),

  // ── produits/{id}/reapprovisionner/ ────────────────────────
  http.post('*/api/produits/:id/reapprovisionner/', async ({ params, request }) => {
    const p = db.findProduit(params.id)
    if (!p) return fail(404, { detail: 'Non trouvé.' })
    const body = await request.json().catch(() => ({}))
    const brut = body.quantite
    const q = typeof brut === 'string' && brut.trim() !== ''
      ? Number(brut)
      : typeof brut === 'number'
        ? brut
        : NaN
    if (!Number.isInteger(q) || q <= 0) {
      return fail(400, { quantite: ['Entier strictement positif attendu.'] })
    }
    p.stock += q // opération atomique : une seule écriture
    return ok(db.serializeProduit(p))
  }),

  // ── ventes/ ─────────────────────────────────────────────────
  http.get('*/api/ventes/', ({ request }) => {
    const u = new URL(request.url)
    const date = u.searchParams.get('date')
    const debut = u.searchParams.get('date_debut')
    const fin = u.searchParams.get('date_fin')
    const produit = u.searchParams.get('produit')
    const mode = u.searchParams.get('mode_paiement')
    const search = u.searchParams.get('search')

    let list = [...db.state.ventes].sort((a, b) => b.date_vente.localeCompare(a.date_vente))
    if (date) list = list.filter((v) => v.date_vente.slice(0, 10) === date)
    if (debut) list = list.filter((v) => v.date_vente.slice(0, 10) >= debut)
    if (fin) list = list.filter((v) => v.date_vente.slice(0, 10) <= fin)
    if (search) {
      const q = fold(search)
      list = list.filter(
        (v) => String(v.id).includes(search.trim()) || fold(v.client_nom).includes(q),
      )
    }
    if (produit) {
      const pid = Number(produit)
      const idsVentes = new Set(
        db.state.lignes.filter((l) => l.produit === pid).map((l) => l.vente),
      )
      list = list.filter((v) => idsVentes.has(v.id))
    }
    if (mode) list = list.filter((v) => v.mode_paiement === mode)
    return ok(paginate(list.map(db.serializeVente), request))
  }),

  http.post('*/api/ventes/', async ({ request }) => {
    const body = await request.json().catch(() => ({}))

    const mode = body.mode_paiement
    if (!db.MODES.includes(mode)) {
      return fail(400, { mode_paiement: ['Mode de paiement invalide.'] })
    }
    const lignes = body.lignes
    if (!Array.isArray(lignes) || lignes.length === 0) {
      return fail(400, { lignes: ['Une vente doit contenir au moins une ligne.'] })
    }

    // 1) Contrôle COMPLET avant toute écriture (atomicité du service creer_vente)
    const besoin = new Map() // produitId → quantité totale
    for (const [i, l] of lignes.entries()) {
      const produit = db.findProduit(l?.produit)
      if (!produit) return fail(400, { lignes: [`Produit introuvable (ligne ${i + 1}).`] })
      const qte = Number(l?.quantite)
      if (!Number.isInteger(qte) || qte <= 0) {
        return fail(400, { lignes: [`Quantité invalide pour ${produit.nom}.`] })
      }
      besoin.set(produit.id, (besoin.get(produit.id) || 0) + qte)
    }
    for (const [pid, qte] of besoin) {
      const produit = db.findProduit(pid)
      if (produit.stock < qte) {
        return fail(409, {
          code: 'stock_insuffisant',
          detail: `Stock insuffisant pour ${produit.nom} (disponible : ${produit.stock}, demandé : ${qte}).`,
          produit: produit.id,
          stock_disponible: produit.stock,
        })
      }
    }

    // 2) Écriture : vente, lignes (prix figés), décroissance des stocks
    const vente = {
      id: db.state.seq.vente++,
      date_vente: new Date().toISOString(),
      client_nom: typeof body.client_nom === 'string' ? body.client_nom.trim() : '',
      mode_paiement: mode,
      total: 0,
    }
    db.state.ventes.push(vente)
    let total = 0
    for (const [pid, qte] of besoin) {
      const produit = db.findProduit(pid)
      db.state.lignes.push({
        id: db.state.seq.ligne++,
        vente: vente.id,
        produit: pid,
        quantite: qte,
        prix: produit.prix, // figé
      })
      produit.stock -= qte
      total += qte * produit.prix
    }
    vente.total = total
    return created(db.serializeVenteDetail(vente))
  }),

  http.get('*/api/ventes/:id/', ({ params }) => {
    const v = db.state.ventes.find((x) => x.id === Number(params.id))
    return v ? ok(db.serializeVenteDetail(v)) : fail(404, { detail: 'Non trouvé.' })
  }),

  // ── rapports/jour/ ──────────────────────────────────────────
  http.get('*/api/rapports/jour/', ({ request }) => {
    const date = new URL(request.url).searchParams.get('date')
    if (!parseDate(date)) {
      return fail(400, { date: ['Format attendu : AAAA-MM-JJ.'] })
    }

    const ventesJour = db.state.ventes.filter((v) => v.date_vente.slice(0, 10) === date)
    const ids = new Set(ventesJour.map((v) => v.id))
    const lignesJour = db.state.lignes.filter((l) => ids.has(l.vente))
    const caTotal = ventesJour.reduce((s, v) => s + v.total, 0)
    const nb = ventesJour.length

    // encaissements par mode (du jour, triés -total)
    const parMode = new Map()
    for (const v of ventesJour) {
      const e = parMode.get(v.mode_paiement) || { mode_paiement: v.mode_paiement, total: 0, nb_ventes: 0 }
      e.total += v.total
      e.nb_ventes += 1
      parMode.set(v.mode_paiement, e)
    }

    // CA par catégorie (du jour, trié -ca)
    const parCat = new Map()
    for (const l of lignesJour) {
      const p = db.findProduit(l.produit)
      const cat = db.findCategorie(p?.categorie)
      if (!cat) continue
      parCat.set(cat.nom, (parCat.get(cat.nom) || 0) + l.quantite * l.prix)
    }

    // top 3 des quantités vendues (du jour)
    const parProd = new Map()
    for (const l of lignesJour) {
      const p = db.findProduit(l.produit)
      if (!p) continue
      const e = parProd.get(p.id) || { produit: p.id, code: p.code, nom: p.nom, qte: 0 }
      e.qte += l.quantite
      parProd.set(p.id, e)
    }

    // produits à racheter : état instantané des stocks (stock <= seuil)
    const alertes = db.state.produits
      .filter((p) => p.stock <= p.seuil)
      .sort((a, b) => a.stock - b.stock)
      .map((p) => ({
        produit: p.id, code: p.code, nom: p.nom,
        stock: p.stock, seuil_alerte: p.seuil, en_rupture: p.stock === 0,
      }))

    return ok({
      date,
      ca_total: db.money(caTotal),
      nb_ventes: nb,
      panier_moyen: db.money(nb ? caTotal / nb : 0),
      encaissements_par_mode: [...parMode.values()].sort((a, b) => b.total - a.total),
      ca_par_categorie: [...parCat.entries()]
        .map(([categorie, ca]) => ({ categorie, ca }))
        .sort((a, b) => b.ca - a.ca),
      top_produits: [...parProd.values()].sort((a, b) => b.qte - a.qte).slice(0, 3),
      produits_a_racheter: alertes,
    })
  }),

  // ── rapports/tableau-de-bord/ ─────────────────────────────
  http.get('*/api/rapports/tableau-de-bord/', ({ request }) => {
    const param = new URL(request.url).searchParams.get('date')
    let date
    if (param === null || param === '') date = dateDakar()
    else if (!parseDate(param)) {
      return fail(400, { date: ['Format attendu : AAAA-MM-JJ.'] })
    } else date = param

    const ventesJour = (d) => db.state.ventes.filter((v) => v.date_vente.slice(0, 10) === d)
    const ca = (list) => list.reduce((s, v) => s + v.total, 0)

    const vAuj = ventesJour(date)
    const vHier = ventesJour(decaleJours(date, -1))

    // Série de 7 jours glissants chronologiques finissant à `date`
    const serie = []
    const idsSemaine = new Set()
    for (let i = 6; i >= 0; i--) {
      const d = decaleJours(date, -i)
      const list = ventesJour(d)
      list.forEach((v) => idsSemaine.add(v.id))
      serie.push({ date: d, ca: db.money(ca(list)), nb_ventes: list.length })
    }

    // Top produits sur la même fenêtre de 7 jours (max 5)
    const parProd = new Map()
    for (const l of db.state.lignes) {
      if (!idsSemaine.has(l.vente)) continue
      const p = db.findProduit(l.produit)
      if (!p) continue
      const e = parProd.get(p.id) || { produit: p.id, code: p.code, nom: p.nom, qte: 0 }
      e.qte += l.quantite
      parProd.set(p.id, e)
    }
    const top = [...parProd.values()].sort((a, b) => b.qte - a.qte).slice(0, 5)

    // État instantané des stocks
    const produits = db.state.produits
    const stock = {
      nb_produits: produits.length,
      nb_en_alerte: produits.filter((p) => p.stock <= p.seuil).length,
      nb_en_rupture: produits.filter((p) => p.stock === 0).length,
      valeur_stock: db.money(produits.reduce((s, p) => s + p.prix * p.stock, 0)),
    }

    // 5 dernières ventes : globales, indépendantes du paramètre `date`
    const dernieres = [...db.state.ventes]
      .sort((a, b) => b.date_vente.localeCompare(a.date_vente))
      .slice(0, 5)
      .map((v) => ({
        id: v.id,
        date_vente: v.date_vente,
        montant_total: db.money(v.total),
        mode_paiement: v.mode_paiement,
      }))

    return ok({
      date,
      aujourdhui: {
        ca: db.money(ca(vAuj)),
        nb_ventes: vAuj.length,
        panier_moyen: db.money(vAuj.length ? ca(vAuj) / vAuj.length : 0),
      },
      hier: { ca: db.money(ca(vHier)), nb_ventes: vHier.length },
      serie_7_jours: serie,
      top_produits_semaine: top,
      stock,
      dernieres_ventes: dernieres,
    })
  }),
]
