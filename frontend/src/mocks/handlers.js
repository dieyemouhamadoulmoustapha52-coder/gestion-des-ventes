/**
 * Handlers MSW — contrat « modes de vente » (snake_case) :
 * produits avec `conditionnements`, ventes avec snapshots et cumul du stock en
 * unités de base, réapprovisionnement par mode, erreurs 400/409 du contrat.
 * Enveloppes : URLs avec slash final, pagination DRF, DecimalField en chaînes,
 * latence 200-400 ms, erreurs 400 par champ.
 */
import { http, HttpResponse, delay } from 'msw'
import * as db from './db.js'
import { dateDakar, decaleJours } from '../lib/dates.js'
import {
  modeDetail,
  normaliserProduit,
  validerConditionnements,
} from '../lib/conditionnements.js'

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

/** Entier ≥ 0 à partir d'une saisie (null si invalide). */
function entierPositif(valeur) {
  if (valeur === '' || valeur === null || valeur === undefined) return null
  const n = typeof valeur === 'string' ? Number(valeur.trim()) : valeur
  return Number.isInteger(n) && n >= 0 ? n : null
}

/**
 * Liste brute de modes → forme de stockage (libellé/numéros trimés, code en
 * MAJUSCULES, `ordre` = position, détail sans code propre).
 * Appelé APRÈS validation (validerConditionnements lit les valeurs brutes).
 * @param {any[]} brut
 * @param {(id: number) => any} [parId] mode existant du produit (conserve l'id)
 */
function normaliserListeBrute(brut, parId = () => null) {
  return brut.map((m, i) => {
    const facteur = Math.trunc(Number(m?.facteur))
    const estDetail = m?.est_detail === true || (m?.est_detail !== false && facteur === 1)
    const existant = m?.id !== null && m?.id !== undefined ? parId(Number(m.id)) : null
    return {
      id: existant ? existant.id : db.state.seq.conditionnement++,
      libelle: String(m?.libelle ?? '').trim(),
      facteur,
      prix_vente: Number(m?.prix_vente),
      code: estDetail ? '' : String(m?.code ?? '').trim().toUpperCase(),
      est_detail: estDetail,
      actif: true,
      ordre: i,
    }
  })
}

/**
 * Valide une liste de modes soumise contre les codes déjà pris (tous les
 * produits + les modes hors de la liste soumise).
 * @param {any[]} liste modes bruts soumis
 * @param {number|null} produitId produit édité (null = création)
 * @returns {string[]} messages en français (vide = valide)
 */
function messagesConditionnements(liste, produitId = null) {
  const idsSoumis = new Set(
    liste.map((m) => (m?.id !== null && m?.id !== undefined ? Number(m.id) : -1)),
  )
  const codesModes = db
    .tousLesModes()
    .filter(
      ({ produit, mode }) =>
        !(
          produitId !== null &&
          produit.id === produitId &&
          mode.id !== null &&
          idsSoumis.has(Number(mode.id))
        ),
    )
    .map(({ mode }) => mode.code)
  const codesOccupes = [...db.state.produits.map((p) => p.code), ...codesModes].filter(Boolean)

  const { global, modes } = validerConditionnements(liste, { codesOccupes })
  const messages = [...global]
  modes.forEach((erreurs, i) => {
    const nom = String(liste[i]?.libelle ?? '').trim() || `n° ${i + 1}`
    for (const msg of Object.values(erreurs)) messages.push(`Mode « ${nom} » : ${msg}`)
  })
  return messages
}

/**
 * Unités de base d'une ligne brute du store (snapshot éventuellement sans
 * `quantite_base`) : `quantite × facteur` — les rapports agrègent toujours
 * en unités de base.
 */
const baseDe = (l) => {
  if (Number.isInteger(l?.quantite_base)) return l.quantite_base
  const facteur = Number.isInteger(l?.facteur) ? l.facteur : 1
  return (Number(l?.quantite) || 0) * facteur
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
    if (stockBas) list = list.filter((p) => p.quantite <= p.seuil_alerte)

    const list2 = sortedByNom(list).map(db.serializeProduit)
    return ok(paginate(list2, request))
  }),

  http.post('*/api/produits/', async ({ request }) => {
    const body = await request.json().catch(() => ({}))
    const errors = {}
    const code = String(body.code ?? '').trim()
    const nom = String(body.nom ?? '').trim()
    const categorie = Number(body.categorie)
    const uniteBase = String(body.unite_base ?? 'unité').trim() || 'unité'
    const prixAchat = body.prix_achat === undefined ? 0 : Number(body.prix_achat)
    // ancien format accepté : prix_unitaire / stock
    const prix =
      body.prix !== undefined ? Number(body.prix)
        : body.prix_unitaire !== undefined ? Number(body.prix_unitaire)
        : NaN
    const quantite =
      body.quantite !== undefined ? entierPositif(body.quantite)
        : body.stock !== undefined ? entierPositif(body.stock)
        : 0
    const seuil = body.seuil_alerte !== undefined ? entierPositif(body.seuil_alerte) : 0

    if (!code) errors.code = ['Ce champ est requis.']
    else if (db.state.produits.some((p) => fold(p.code) === fold(code))) {
      errors.code = ['produit avec ce code existe déjà.']
    }
    if (!nom) errors.nom = ['Ce champ est requis.']
    if (!db.findCategorie(categorie)) errors.categorie = ['Cette catégorie n\'existe pas.']
    if (uniteBase.length > 30) errors.unite_base = ['30 caractères maximum.']
    if (!Number.isFinite(prixAchat) || prixAchat < 0) {
      errors.prix_achat = ['Saisissez un coût valide (≥ 0).']
    }
    if (!Number.isFinite(prix) || prix < 0) {
      errors.prix = ['Saisissez un prix valide (≥ 0).']
    }
    if (quantite === null) errors.quantite = ['Entier positif attendu.']
    if (seuil === null) errors.seuil_alerte = ['Entier positif attendu.']

    const brutModes = Array.isArray(body.conditionnements) ? body.conditionnements : null
    if (brutModes) {
      const messages = messagesConditionnements(brutModes, null)
      if (messages.length) errors.conditionnements = messages
    }
    if (Object.keys(errors).length) return fail(400, errors)

    const p = {
      id: db.state.seq.produit++,
      code,
      nom,
      categorie,
      unite_base: uniteBase,
      prix_achat: prixAchat,
      prix: Number.isFinite(prix) ? prix : 0,
      quantite: quantite ?? 0,
      seuil_alerte: seuil ?? 0,
      conditionnements: brutModes
        ? normaliserListeBrute(brutModes)
        : [db.nouveauDetail(Number.isFinite(prix) ? prix : 0, db.state.seq.conditionnement++)],
    }
    // prix toujours synchronisé sur le mode Détail
    const detail = p.conditionnements.find((m) => m.est_detail)
    if (detail) p.prix = detail.prix_vente

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
    if (body.unite_base !== undefined) {
      const u = String(body.unite_base).trim() || 'unité'
      if (u.length > 30) errors.unite_base = ['30 caractères maximum.']
      else next.unite_base = u
    }
    if (body.prix_achat !== undefined) {
      const pa = Number(body.prix_achat)
      if (!Number.isFinite(pa) || pa < 0) errors.prix_achat = ['Saisissez un coût valide (≥ 0).']
      else next.prix_achat = pa
    }
    const brutPrix = body.prix !== undefined ? body.prix : body.prix_unitaire
    if (brutPrix !== undefined) {
      const prix = Number(brutPrix)
      if (!Number.isFinite(prix) || prix < 0) errors.prix = ['Saisissez un prix valide (≥ 0).']
      else next.prix = prix
    }
    const brutQte = body.quantite !== undefined ? body.quantite : body.stock
    if (brutQte !== undefined) {
      const q = entierPositif(brutQte)
      if (q === null) errors.quantite = ['Entier positif attendu.']
      else next.quantite = q
    }
    if (body.seuil_alerte !== undefined) {
      const seuil = entierPositif(body.seuil_alerte)
      if (seuil === null) errors.seuil_alerte = ['Entier positif attendu.']
      else next.seuil_alerte = seuil
    }
    if (body.conditionnements !== undefined) {
      // la liste complète se remplace par PUT (contrat)
      errors.conditionnements = ['Utilisez PUT pour remplacer la liste des modes de vente.']
    }
    if (Object.keys(errors).length) return fail(400, errors)
    Object.assign(p, next)

    // prix toujours synchronisé sur le mode Détail (ancien format accepté)
    if (next.prix !== undefined) {
      const detail = (p.conditionnements ?? []).find((m) => m.est_detail)
      if (detail) detail.prix_vente = next.prix
      else p.conditionnements = [db.nouveauDetail(next.prix, db.state.seq.conditionnement++)]
    }
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
    const uniteBase = String(body.unite_base ?? p.unite_base ?? 'unité').trim() || 'unité'
    const prixAchat = body.prix_achat !== undefined ? Number(body.prix_achat) : p.prix_achat
    const quantite =
      body.quantite !== undefined ? entierPositif(body.quantite)
        : body.stock !== undefined ? entierPositif(body.stock)
        : p.quantite
    const seuil =
      body.seuil_alerte !== undefined ? entierPositif(body.seuil_alerte)
        : body.seuil !== undefined ? entierPositif(body.seuil)
        : p.seuil_alerte
    const brutPrix = body.prix !== undefined ? body.prix : body.prix_unitaire

    if (!code) errors.code = ['Ce champ est requis.']
    else if (db.state.produits.some((x) => x.id !== p.id && fold(x.code) === fold(code))) {
      errors.code = ['produit avec ce code existe déjà.']
    }
    if (!nom) errors.nom = ['Ce champ est requis.']
    if (!db.findCategorie(categorie)) errors.categorie = ['Cette catégorie n\'existe pas.']
    if (uniteBase.length > 30) errors.unite_base = ['30 caractères maximum.']
    if (!Number.isFinite(prixAchat) || prixAchat < 0) {
      errors.prix_achat = ['Saisissez un coût valide (≥ 0).']
    }
    if (quantite === null) errors.quantite = ['Entier positif attendu.']
    if (seuil === null) errors.seuil_alerte = ['Entier positif attendu.']

    const brutModes = Array.isArray(body.conditionnements) ? body.conditionnements : null
    if (brutModes) {
      const idsConnus = new Set(
        (p.conditionnements ?? []).filter((m) => m.id !== null).map((m) => m.id),
      )
      if (brutModes.some((m) => m?.id !== null && m?.id !== undefined && !idsConnus.has(Number(m.id)))) {
        errors.conditionnements = ['Mode de vente introuvable pour ce produit.']
      } else {
        const messages = messagesConditionnements(brutModes, p.id)
        if (messages.length) errors.conditionnements = messages
      }
    } else if (brutPrix !== undefined && (!Number.isFinite(Number(brutPrix)) || Number(brutPrix) < 0)) {
      errors.prix = ['Saisissez un prix valide (≥ 0).']
    }
    if (Object.keys(errors).length) return fail(400, errors)

    const champs = {
      code,
      nom,
      categorie,
      unite_base: uniteBase,
      prix_achat: prixAchat,
      quantite: quantite ?? 0,
      seuil_alerte: seuil ?? 0,
    }

    if (brutModes) {
      // Liste complète : id = mise à jour, sans id = nouveau, absent = actif:false
      const parId = new Map(
        (p.conditionnements ?? []).filter((m) => m.id !== null).map((m) => [m.id, m]),
      )
      const suivis = normaliserListeBrute(brutModes, (id) => parId.get(id) ?? null)
      const detail = suivis.find((m) => m.est_detail)
      champs.prix = detail ? detail.prix_vente : p.prix
      const idsSuivis = new Set(suivis.map((m) => m.id))
      const inactifs = (p.conditionnements ?? [])
        .filter((m) => !idsSuivis.has(m.id))
        .map((m) => ({ ...m, actif: false }))
      champs.conditionnements = [...suivis, ...inactifs]
    } else {
      // Ancien format (sans conditionnements) : maintiens un Détail issu de `prix`
      const prix = brutPrix !== undefined ? Number(brutPrix) : p.prix
      champs.prix = prix
      const modes = (p.conditionnements ?? []).map((m) =>
        m.est_detail ? { ...m, prix_vente: prix } : m,
      )
      champs.conditionnements = modes.some((m) => m.est_detail)
        ? modes
        : [db.nouveauDetail(prix, db.state.seq.conditionnement++)]
    }

    Object.assign(p, champs)
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
  // { conditionnement?, quantite } → quantite += quantite × facteur
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
    let facteur = 1
    if (body.conditionnement !== undefined && body.conditionnement !== null && body.conditionnement !== '') {
      const cond = normaliserProduit(p).conditionnements.find(
        (m) => m.id === Number(body.conditionnement),
      )
      if (!cond || cond.actif === false) {
        return fail(400, {
          code: 'conditionnement_invalide',
          detail: `Mode de vente invalide pour ${p.nom}.`,
          produit: p.id,
          conditionnement: body.conditionnement,
        })
      }
      facteur = cond.facteur
    }
    p.quantite += q * facteur // opération atomique : une seule écriture
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

    // 1) Résolution des lignes — AUCUNE écriture avant contrôle complet
    //    (verrouillage logique : le service creer_vente est tout-ou-rien)
    const resolues = [] // {produit, mode, quantite}
    for (const [i, l] of lignes.entries()) {
      const brut = db.findProduit(l?.produit)
      if (!brut) return fail(400, { lignes: [`Produit introuvable (ligne ${i + 1}).`] })
      const produit = normaliserProduit(brut)
      const qte = Number(l?.quantite)
      if (!Number.isInteger(qte) || qte <= 0) {
        return fail(400, { lignes: [`Quantité invalide pour ${produit.nom}.`] })
      }
      let cond = null
      const refMode = l?.conditionnement
      if (refMode !== undefined && refMode !== null && refMode !== '') {
        cond = produit.conditionnements.find((m) => m.id === Number(refMode)) ?? null
        if (!cond || cond.actif === false) {
          return fail(400, {
            code: 'conditionnement_invalide',
            detail: `Mode de vente invalide pour ${produit.nom}.`,
            produit: produit.id,
            conditionnement: refMode,
          })
        }
      } else {
        cond = modeDetail(produit) // sans `conditionnement` = Détail
      }
      resolues.push({ brut, produit, cond, quantite: qte })
    }

    // 2) CUMUL du besoin en unités de base par produit, puis stock APRÈS cumul
    const besoin = new Map()
    for (const r of resolues) {
      besoin.set(r.produit.id, (besoin.get(r.produit.id) ?? 0) + r.quantite * r.cond.facteur)
    }
    for (const [pid, demande] of besoin) {
      const produit = db.findProduit(pid)
      if (produit.quantite < demande) {
        return fail(409, {
          code: 'stock_insuffisant',
          detail: `Stock insuffisant pour ${produit.nom} (disponible : ${produit.quantite}, demandé : ${demande} unités).`,
          produit: produit.id,
          demande_base: demande,
          disponible_base: produit.quantite,
        })
      }
    }

    // 3) Écriture : vente, lignes avec SNAPSHOT figés, décroissance des stocks
    const vente = {
      id: db.state.seq.vente++,
      date_vente: new Date().toISOString(),
      client_nom: typeof body.client_nom === 'string' ? body.client_nom.trim() : '',
      mode_paiement: mode,
      total: 0,
    }
    db.state.ventes.push(vente)
    let total = 0
    const misAJour = new Map()
    for (const r of resolues) {
      const { brut, cond, quantite } = r
      const quantiteBase = quantite * cond.facteur
      const prixVente = cond.prix_vente // figé à la création
      const ligne = {
        id: db.state.seq.ligne++,
        vente: vente.id,
        produit: brut.id,
        conditionnement: cond.id ?? null,
        libelle: cond.libelle,
        facteur: cond.facteur,
        est_detail: cond.est_detail === true || cond.facteur === 1,
        prix: prixVente,
        quantite,
        quantite_base: quantiteBase,
        cout_unitaire_base: brut.prix_achat,
        total_ligne: quantite * prixVente,
      }
      db.state.lignes.push(ligne)
      brut.quantite -= quantiteBase
      total += ligne.total_ligne
      misAJour.set(brut.id, brut.quantite)
    }
    vente.total = total

    // 4) Réponse du contrat (+ date_vente/client_nom : affichage ticket)
    return created({
      id: vente.id,
      date_vente: vente.date_vente,
      client_nom: vente.client_nom,
      total: db.money(total),
      moyen_paiement: mode,
      lignes: db.state.lignes.filter((l) => l.vente === vente.id).map(db.serializeLigne),
      produits_mis_a_jour: [...misAJour.entries()].map(([id, quantite]) => ({ id, quantite })),
    })
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

    // CA par catégorie (du jour, trié -ca) — total des lignes (prix × mode)
    const parCat = new Map()
    for (const l of lignesJour) {
      const p = db.findProduit(l.produit)
      const cat = db.findCategorie(p?.categorie)
      if (!cat) continue
      parCat.set(cat.nom, (parCat.get(cat.nom) || 0) + Number(l.total_ligne ?? l.quantite * l.prix))
    }

    // top 3 des quantités vendues (du jour) — EN UNITÉS DE BASE
    const parProd = new Map()
    for (const l of lignesJour) {
      const p = db.findProduit(l.produit)
      if (!p) continue
      const e = parProd.get(p.id) || { produit: p.id, code: p.code, nom: p.nom, qte: 0 }
      e.qte += baseDe(l)
      parProd.set(p.id, e)
    }

    // produits à racheter : état instantané des stocks (stock <= seuil)
    const alertes = db.state.produits
      .filter((p) => p.quantite <= p.seuil_alerte)
      .sort((a, b) => a.quantite - b.quantite)
      .map((p) => ({
        produit: p.id, code: p.code, nom: p.nom,
        stock: p.quantite, seuil_alerte: p.seuil_alerte, en_rupture: p.quantite === 0,
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
      e.qte += baseDe(l) // EN UNITÉS DE BASE
      parProd.set(p.id, e)
    }
    const top = [...parProd.values()].sort((a, b) => b.qte - a.qte).slice(0, 5)

    // État instantané des stocks
    const produits = db.state.produits
    const stock = {
      nb_produits: produits.length,
      nb_en_alerte: produits.filter((p) => p.quantite <= p.seuil_alerte).length,
      nb_en_rupture: produits.filter((p) => p.quantite === 0).length,
      // Stock immobilisé : prix d'ACHAT × stock en unités de base
      // (prix de vente × stock = surestimation).
      valeur_stock: db.money(produits.reduce((s, p) => s + p.prix_achat * p.quantite, 0)),
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
