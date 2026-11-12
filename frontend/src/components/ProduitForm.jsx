/**
 * Formulaire produit EN LIGNE (@audience patron) — remplace l'ancienne modale.
 *
 * Sections : Identité · Unités & prix · Modes de vente.
 * Envoie le contrat snake_case (POST à la création, PUT complet à l'édition —
 * la liste `conditionnements` est toujours remplacée en entier) et affiche les
 * erreurs serveur par champ (`err.fields`), plus la validation locale des modes
 * via `validerConditionnements`.
 */
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Button from './Button.jsx'
import { useSaveProduit } from '../hooks/queries.js'
import { useToast } from './Toast.jsx'
import { formatFcfa } from '../lib/money.js'
import {
  SUGGESTIONS_MODE,
  SUGGESTIONS_UNITE,
  UNITE_MAX,
  normaliserProduit,
} from '../lib/conditionnements.js'
import { validerFormulaireProduit } from '../lib/formProduit.js'

const CELL =
  'block h-11 w-full min-w-[7rem] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900'
const CELL_RO = 'block h-11 w-full min-w-[4.5rem] rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-600'

const MODE_VIDE = {
  id: null,
  libelle: '',
  facteur: '',
  prix_vente: '',
  code: '',
  est_detail: false,
  actif: true,
}

const VIDE = {
  code: '',
  nom: '',
  categorie: '',
  unite_base: 'unité',
  prix_achat: '',
  prix: '',
  quantite: '',
  seuil_alerte: '',
  modes: [],
}

/**
 * @param {{produit: import('../api/types.js').Produit|null,
 *          categories: import('../api/types.js').Categorie[],
 *          codesProduits?: string[],
 *          onClose: () => void}} props
 */
export default function ProduitForm({ produit, categories, codesProduits = [], onClose }) {
  const [form, setForm] = useState(VIDE)
  const [errChamp, setErrChamp] = useState({})
  const [errModes, setErrModes] = useState([])
  const [errListe, setErrListe] = useState([])
  const [serverErrors, setServerErrors] = useState({})
  const save = useSaveProduit()
  const toast = useToast()
  const editing = Boolean(produit)

  useEffect(() => {
    const p = produit ? normaliserProduit(produit) : null
    save.reset()
    setErrChamp({})
    setErrModes([])
    setErrListe([])
    setServerErrors({})
    setForm(
      p
        ? {
            code: p.code,
            nom: p.nom,
            categorie: String(p.categorie),
            unite_base: p.unite_base,
            prix_achat: String(p.prix_achat),
            prix: String(p.prix),
            quantite: String(p.quantite),
            seuil_alerte: String(p.seuil_alerte),
            // seuls les modes ACTIFS sont édités (les retirés restent inactifs)
            modes: p.conditionnements
              .filter((m) => m.actif !== false)
              .map((m) => ({
                id: m.id,
                libelle: m.libelle,
                facteur: String(m.facteur),
                prix_vente: String(m.prix_vente),
                code: m.code ?? '',
                est_detail: m.est_detail === true,
                actif: true,
              })),
          }
        : {
            ...VIDE,
            modes: [{ ...MODE_VIDE, est_detail: true, libelle: 'Détail', facteur: '1' }],
          },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produit])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setMode = (i, key) => (e) =>
    setForm((f) => ({
      ...f,
      modes: f.modes.map((m, j) => (j === i ? { ...m, [key]: e.target.value } : m)),
    }))
  const fe = (key) => serverErrors[key]?.[0]
  const ec = (key) => errChamp[key] || fe(key)

  const ajouterMode = () =>
    setForm((f) => ({ ...f, modes: [...f.modes, { ...MODE_VIDE }] }))

  const retirerMode = (i) =>
    setForm((f) => ({ ...f, modes: f.modes.filter((_, j) => j !== i) }))

  const onSubmit = (e) => {
    e.preventDefault()

    const r = validerFormulaireProduit(form, { produit, codesProduits })
    setErrChamp(r.champs)
    setErrModes(r.parMode)
    setErrListe(r.global)
    setServerErrors({})
    if (!r.valide) return

    const data = r.data

    save.mutate(
      { id: produit?.id, data },
      {
        onSuccess: () => {
          toast.success(editing ? 'Produit modifié.' : 'Produit créé.')
          onClose()
        },
        onError: (err) => {
          setServerErrors(err.fields || {})
          if (err.fields?.conditionnements) setErrListe(err.fields.conditionnements)
          if (!err.fields) toast.error(err.detail || 'Enregistrement impossible.')
        },
      },
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">
          {editing ? `Modifier — ${produit.nom}` : 'Nouveau produit'}
        </h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Annuler
          </Button>
          <Button type="submit" form="produit-form" disabled={save.isPending}>
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      <form id="produit-form" onSubmit={onSubmit} className="space-y-6 px-4 py-5 sm:px-6">
        {/* ── Identité ─────────────────────────────────────────── */}
        <section aria-labelledby="sec-identite" className="space-y-3">
          <h3
            id="sec-identite"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Identité
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="p-code" className="block text-sm font-medium text-slate-700">
                Code (SKU) *
              </label>
              <input
                id="p-code"
                className={CELL}
                value={form.code}
                onChange={set('code')}
                maxLength={50}
                placeholder="RIZ25"
                required
                aria-invalid={Boolean(ec('code'))}
              />
              {ec('code') ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {ec('code')}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <label htmlFor="p-nom" className="block text-sm font-medium text-slate-700">
                Nom *
              </label>
              <input
                id="p-nom"
                className={CELL}
                value={form.nom}
                onChange={set('nom')}
                maxLength={200}
                required
                aria-invalid={Boolean(ec('nom'))}
              />
              {ec('nom') ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {ec('nom')}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <label htmlFor="p-cat" className="block text-sm font-medium text-slate-700">
                Catégorie *
              </label>
              <select
                id="p-cat"
                className={CELL}
                value={form.categorie}
                onChange={set('categorie')}
                required
                aria-invalid={Boolean(ec('categorie'))}
              >
                <option value="">Choisir…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
              {ec('categorie') ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {ec('categorie')}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── Unités & prix ────────────────────────────────────── */}
        <section aria-labelledby="sec-unites" className="space-y-3">
          <h3
            id="sec-unites"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Unités &amp; prix
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="p-unite" className="block text-sm font-medium text-slate-700">
                Unité de base *
              </label>
              <input
                id="p-unite"
                className={CELL}
                value={form.unite_base}
                onChange={set('unite_base')}
                list="unites-suggestions"
                maxLength={UNITE_MAX}
                placeholder="bouteille"
                aria-invalid={Boolean(ec('unite_base'))}
              />
              <datalist id="unites-suggestions">
                {SUGGESTIONS_UNITE.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              {ec('unite_base') ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {ec('unite_base')}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Le stock et les facteurs s’expriment dans cette unité.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="p-achat" className="block text-sm font-medium text-slate-700">
                Prix d’achat (FCFA / unité)
              </label>
              <input
                id="p-achat"
                type="number"
                min="0"
                step="0.01"
                className={CELL}
                value={form.prix_achat}
                onChange={set('prix_achat')}
                placeholder="1083.33"
                aria-invalid={Boolean(ec('prix_achat'))}
              />
              {ec('prix_achat') ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {ec('prix_achat')}
                </p>
              ) : (
                <p className="text-xs text-slate-500">Coût d’une unité de base (marge).</p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="p-prix" className="block text-sm font-medium text-slate-700">
                Prix de vente au détail (FCFA) *
              </label>
              <input
                id="p-prix"
                type="number"
                min="1"
                step="1"
                className={CELL}
                value={form.prix}
                onChange={set('prix')}
                required
                aria-invalid={Boolean(ec('prix'))}
              />
              {ec('prix') ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {ec('prix')}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Prix d’une unité — c’est aussi le prix du mode « Détail ».
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="p-qte" className="block text-sm font-medium text-slate-700">
                Stock actuel (unités de base)
              </label>
              <input
                id="p-qte"
                type="number"
                min="0"
                step="1"
                className={CELL}
                value={form.quantite}
                onChange={set('quantite')}
                aria-invalid={Boolean(ec('quantite'))}
              />
              {ec('quantite') ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {ec('quantite')}
                </p>
              ) : (
                <p className="text-xs text-slate-500">Utilisez le réapprovisionnement au quotidien.</p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="p-seuil" className="block text-sm font-medium text-slate-700">
                Seuil d’alerte (unités de base)
              </label>
              <input
                id="p-seuil"
                type="number"
                min="0"
                step="1"
                className={CELL}
                value={form.seuil_alerte}
                onChange={set('seuil_alerte')}
                aria-invalid={Boolean(ec('seuil_alerte'))}
              />
              {ec('seuil_alerte') ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {ec('seuil_alerte')}
                </p>
              ) : (
                <p className="text-xs text-slate-500">Alerte « stock bas » en dessous.</p>
              )}
            </div>
          </div>
        </section>

        {/* ── Modes de vente ───────────────────────────────────── */}
        <section aria-labelledby="sec-modes" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              id="sec-modes"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Modes de vente
            </h3>
            <Button variant="secondary" type="button" onClick={ajouterMode}>
              <Plus size={16} aria-hidden="true" />
              Ajouter un mode
            </Button>
          </div>

          {errListe.length > 0 ? (
            <ul
              role="alert"
              className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
            >
              {errListe.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2">Libellé *</th>
                  <th scope="col" className="px-3 py-2">Unités / mode *</th>
                  <th scope="col" className="px-3 py-2">Prix (FCFA) *</th>
                  <th scope="col" className="px-3 py-2">Code</th>
                  <th scope="col" className="px-3 py-2 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {form.modes.map((m, i) => {
                  const em = errModes[i] ?? {}
                  const estDetail = m.est_detail === true
                  return (
                    <tr key={m.id ?? `nouveau-${i}`}>
                      <td className="px-3 py-2 align-top">
                        <label className="sr-only" htmlFor={`m-lib-${i}`}>
                          Libellé du mode {i + 1}
                        </label>
                        <input
                          id={`m-lib-${i}`}
                          className={CELL}
                          value={m.libelle}
                          onChange={setMode(i, 'libelle')}
                          placeholder={estDetail ? 'Détail' : SUGGESTIONS_MODE[i % SUGGESTIONS_MODE.length]}
                          maxLength={50}
                          aria-invalid={Boolean(em.libelle)}
                        />
                        {em.libelle ? (
                          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                            {em.libelle}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <label className="sr-only" htmlFor={`m-fact-${i}`}>
                          Unités de base du mode {i + 1}
                        </label>
                        {estDetail ? (
                          <input
                            id={`m-fact-${i}`}
                            className={CELL_RO}
                            value="1"
                            readOnly
                            aria-label="Le détail contient exactement 1 unité"
                          />
                        ) : (
                          <input
                            id={`m-fact-${i}`}
                            type="number"
                            min="2"
                            step="1"
                            className={CELL}
                            value={m.facteur}
                            onChange={setMode(i, 'facteur')}
                            placeholder="12"
                            aria-invalid={Boolean(em.facteur)}
                          />
                        )}
                        {em.facteur ? (
                          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                            {em.facteur}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {estDetail ? (
                          <>
                            <span className="flex h-11 items-center px-1 text-sm font-semibold text-slate-900">
                              {formatFcfa(form.prix)}
                            </span>
                            <span className="text-xs text-slate-500">réglé ci-dessus</span>
                          </>
                        ) : (
                          <>
                            <label className="sr-only" htmlFor={`m-prix-${i}`}>
                              Prix du mode {i + 1}
                            </label>
                            <input
                              id={`m-prix-${i}`}
                              type="number"
                              min="1"
                              step="1"
                              className={CELL}
                              value={m.prix_vente}
                              onChange={setMode(i, 'prix_vente')}
                              placeholder="15000"
                              aria-invalid={Boolean(em.prix_vente)}
                            />
                            {em.prix_vente ? (
                              <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                                {em.prix_vente}
                              </p>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {estDetail ? (
                          <span className="flex h-11 items-center text-xs text-slate-400">
                            aucun
                          </span>
                        ) : (
                          <>
                            <label className="sr-only" htmlFor={`m-code-${i}`}>
                              Code du mode {i + 1}
                            </label>
                            <input
                              id={`m-code-${i}`}
                              className={CELL}
                              value={m.code}
                              onChange={(e) => {
                                const valeur = e.target.value.toUpperCase()
                                setForm((f) => ({
                                  ...f,
                                  modes: f.modes.map((m, j) =>
                                    j === i ? { ...m, code: valeur } : m,
                                  ),
                                }))
                              }}
                              placeholder="COLA12"
                              maxLength={50}
                              aria-invalid={Boolean(em.code)}
                            />
                            {em.code ? (
                              <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                                {em.code}
                              </p>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex h-11 items-center justify-end">
                          {estDetail ? (
                            <span className="text-xs text-slate-400">obligatoire</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => retirerMode(i)}
                              aria-label={`Retirer le mode ${m.libelle || i + 1}`}
                              className="flex h-11 w-11 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Le mode « Détail » (1 unité) est obligatoire. Un mode retiré du formulaire reste en
            base mais devient inactif — il n’apparaîtra plus en caisse.
          </p>
        </section>

        <p className="text-xs text-slate-500">
          Montants en FCFA, quantités entières en unités de base, conformément au MVP.
        </p>
      </form>
    </div>
  )
}
