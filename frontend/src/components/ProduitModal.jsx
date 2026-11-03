/** Modal de création / édition d'un produit (champs du modèle produit). */
import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'
import { useSaveProduit } from '../hooks/queries.js'
import { useToast } from './Toast.jsx'

const EMPTY = { code: '', nom: '', categorie: '', prix_unitaire: '', stock: '', seuil_alerte: '' }
const INPUT =
  'block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900'

function Field({ label, htmlFor, error, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * @param {{open: boolean, onClose: () => void,
 *          produit: import('../api/types.js').Produit|null,
 *          categories: import('../api/types.js').Categorie[]}} props
 */
export default function ProduitModal({ open, onClose, produit, categories }) {
  const [form, setForm] = useState(EMPTY)
  const [serverErrors, setServerErrors] = useState({})
  const save = useSaveProduit()
  const toast = useToast()
  const editing = Boolean(produit)

  useEffect(() => {
    if (!open) return
    setServerErrors({})
    save.reset()
    setForm(
      produit
        ? {
            code: produit.code,
            nom: produit.nom,
            categorie: String(produit.categorie),
            prix_unitaire: String(produit.prix_unitaire),
            stock: String(produit.stock),
            seuil_alerte: String(produit.seuil_alerte),
          }
        : EMPTY,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, produit])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const fe = (key) => serverErrors[key]?.[0]

  const onSubmit = (e) => {
    e.preventDefault()
    const data = {
      code: form.code.trim(),
      nom: form.nom.trim(),
      categorie: Number(form.categorie),
      prix_unitaire: Number(form.prix_unitaire),
      stock: form.stock === '' ? 0 : Number(form.stock),
      seuil_alerte: form.seuil_alerte === '' ? 0 : Number(form.seuil_alerte),
    }
    save.mutate(
      { id: produit?.id, data },
      {
        onSuccess: () => {
          toast.success(editing ? 'Produit modifié.' : 'Produit créé.')
          onClose()
        },
        onError: (err) => {
          setServerErrors(err.fields || {})
          if (!err.fields) toast.error(err.detail || 'Enregistrement impossible.')
        },
      },
    )
  }

  return (
    <Modal
      open={open}
      title={editing ? `Modifier — ${produit.nom}` : 'Nouveau produit'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Annuler
          </Button>
          <Button type="submit" form="produit-form" disabled={save.isPending}>
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <form id="produit-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code (SKU) *" htmlFor="p-code" error={fe('code')}>
            <input
              id="p-code"
              className={INPUT}
              value={form.code}
              onChange={set('code')}
              required
              maxLength={50}
              placeholder="RIZ25"
              aria-invalid={Boolean(fe('code'))}
            />
          </Field>
          <Field label="Nom *" htmlFor="p-nom" error={fe('nom')}>
            <input
              id="p-nom"
              className={INPUT}
              value={form.nom}
              onChange={set('nom')}
              required
              maxLength={200}
              aria-invalid={Boolean(fe('nom'))}
            />
          </Field>
          <Field label="Catégorie *" htmlFor="p-cat" error={fe('categorie')}>
            <select
              id="p-cat"
              className={INPUT}
              value={form.categorie}
              onChange={set('categorie')}
              required
              aria-invalid={Boolean(fe('categorie'))}
            >
              <option value="">Choisir…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prix unitaire (FCFA) *" htmlFor="p-prix" error={fe('prix_unitaire')}>
            <input
              id="p-prix"
              type="number"
              min="0"
              step="1"
              className={INPUT}
              value={form.prix_unitaire}
              onChange={set('prix_unitaire')}
              required
              aria-invalid={Boolean(fe('prix_unitaire'))}
            />
          </Field>
          <Field label="Stock actuel" htmlFor="p-stock" error={fe('stock')}>
            <input
              id="p-stock"
              type="number"
              min="0"
              step="1"
              className={INPUT}
              value={form.stock}
              onChange={set('stock')}
              aria-invalid={Boolean(fe('stock'))}
            />
          </Field>
          <Field label="Seuil d'alerte" htmlFor="p-seuil" error={fe('seuil_alerte')}>
            <input
              id="p-seuil"
              type="number"
              min="0"
              step="1"
              className={INPUT}
              value={form.seuil_alerte}
              onChange={set('seuil_alerte')}
              aria-invalid={Boolean(fe('seuil_alerte'))}
            />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          Montants saisis en FCFA (entiers) — sans TVA ni remise, conformément au MVP.
        </p>
      </form>
    </Modal>
  )
}
