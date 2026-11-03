/** Gestion des catégories : liste, création, édition, suppression (PROTECT). */
import { useEffect, useState } from 'react'
import { Pencil, Tags, Trash2 } from 'lucide-react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import EmptyState from './EmptyState.jsx'
import ErrorState from './ErrorState.jsx'
import Skeleton from './Skeleton.jsx'
import { useCategories, useDeleteCategorie, useSaveCategorie } from '../hooks/queries.js'
import { useToast } from './Toast.jsx'

const INPUT = 'block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm'

/**
 * @param {{open: boolean, onClose: () => void}} props
 */
export default function CategorieManager({ open, onClose }) {
  const categories = useCategories()
  const save = useSaveCategorie()
  const remove = useDeleteCategorie()
  const toast = useToast()

  const [form, setForm] = useState({ nom: '', description: '' })
  const [editingId, setEditingId] = useState(null)
  const [serverErrors, setServerErrors] = useState({})
  const [toDelete, setToDelete] = useState(null)

  useEffect(() => {
    if (open) {
      setForm({ nom: '', description: '' })
      setEditingId(null)
      setServerErrors({})
    }
  }, [open])

  const startEdit = (cat) => {
    setEditingId(cat.id)
    setForm({ nom: cat.nom, description: cat.description })
    setServerErrors({})
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm({ nom: '', description: '' })
    setServerErrors({})
  }

  const onSubmit = (e) => {
    e.preventDefault()
    save.mutate(
      { id: editingId, data: { nom: form.nom.trim(), description: form.description.trim() } },
      {
        onSuccess: () => {
          toast.success(editingId ? 'Catégorie modifiée.' : 'Catégorie créée.')
          cancelEdit()
        },
        onError: (err) => {
          setServerErrors(err.fields || {})
          if (!err.fields) toast.error(err.detail || 'Enregistrement impossible.')
        },
      },
    )
  }

  const confirmDelete = () => {
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success(`Catégorie « ${toDelete.nom} » supprimée.`)
        setToDelete(null)
      },
      onError: (err) => {
        // 409 PROTECT : catégorie encore utilisée par des produits
        toast.error(err.detail || 'Suppression impossible.')
        setToDelete(null)
      },
    })
  }

  const list = categories.data?.results ?? []

  return (
    <>
      <Modal open={open} title="Gérer les catégories" onClose={onClose} size="lg">
        <div className="space-y-5">
          {/* Liste */}
          {categories.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : categories.isError ? (
            <ErrorState message={categories.error.detail} onRetry={() => categories.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState icon={Tags} title="Aucune catégorie" message="Créez la première ci-dessous." />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {list.map((cat) => (
                <li key={cat.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{cat.nom}</p>
                    {cat.description ? (
                      <p className="truncate text-xs text-slate-500">{cat.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    aria-label={`Modifier la catégorie ${cat.nom}`}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(cat)}
                    aria-label={`Supprimer la catégorie ${cat.nom}`}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Formulaire */}
          <form onSubmit={onSubmit} className="space-y-3 rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              {editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="c-nom" className="block text-sm font-medium text-slate-700">
                  Nom *
                </label>
                <input
                  id="c-nom"
                  className={INPUT}
                  value={form.nom}
                  onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  required
                  maxLength={100}
                  aria-invalid={Boolean(serverErrors.nom)}
                />
                {serverErrors.nom ? (
                  <p className="text-xs font-medium text-red-600" role="alert">
                    {serverErrors.nom[0]}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <label htmlFor="c-desc" className="block text-sm font-medium text-slate-700">
                  Description
                </label>
                <input
                  id="c-desc"
                  className={INPUT}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {editingId ? (
                <Button variant="ghost" onClick={cancelEdit} type="button">
                  Annuler
                </Button>
              ) : null}
              <Button type="submit" disabled={save.isPending}>
                {save.isPending
                  ? 'Enregistrement…'
                  : editingId
                    ? 'Enregistrer'
                    : 'Ajouter la catégorie'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Supprimer la catégorie"
        message={`Supprimer « ${toDelete?.nom} » ? Impossible si des produits l'utilisent (intégrité du reporting).`}
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
