/**
 * Onglets accessibles génériques (WAI-ARIA « tabs ») — réutilisable.
 *
 * - `role="tablist"` / `role="tab"` (`aria-selected`, `aria-controls`) /
 *   `role="tabpanel"` (`aria-labelledby`) ;
 * - navigation clavier : flèches gauche/droite, Home, Fin ; la tabulation
 *   SORT de la liste (roving tabindex : seul l'onglet actif a `tabindex=0`) ;
 * - focus toujours visible (variables du thème, aucune couleur en dur) ;
 * - défilement horizontal sur mobile, barre de défilement masquée ;
 * - `param="onglet"` : l'état est reflété dans l'URL (`?onglet=mois`) pour
 *   que le rechargement et le bouton retour conservent l'onglet ;
 * - seul l'onglet actif est rendu.
 *
 * Aucune dépendance supplémentaire. Testé dans `Tabs.test.jsx`.
 */
import { useId, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Index atteint par une touche de navigation (logique pure, testée seule
 * faute de DOM dans la suite de tests — voir `Tabs.test.jsx`).
 * @param {string} touche `event.key`
 * @param {number} index index courant
 * @param {number} n nombre d'onglets
 * @returns {number|null} nouvel index, ou `null` si la touche n'est pas de navigation
 */
export function indexSuivant(touche, index, n) {
  if (!Number.isFinite(n) || n <= 0) return null
  const i = Number.isFinite(index) ? index : 0
  switch (touche) {
    case 'ArrowRight':
      return (i + 1) % n
    case 'ArrowLeft':
      return (i - 1 + n) % n
    case 'Home':
      return 0
    case 'End':
      return n - 1
    default:
      return null
  }
}

/**
 * Onglet valide parmi `ids` (valeur absente ou inconnue → défaut).
 * @param {string[]} ids
 * @param {string|null|undefined} valeur
 * @param {string|null|undefined} defaut
 * @returns {string}
 */
export function idValide(ids, valeur, defaut) {
  if (valeur && ids.includes(valeur)) return valeur
  if (defaut && ids.includes(defaut)) return defaut
  return ids[0]
}

/**
 * Onglet à afficher depuis la chaîne de requête (`?onglet=…`).
 * @param {string} search `location.search` ('' ou '?onglet=stock')
 * @param {string|null} param nom du paramètre (null → URL non utilisée)
 * @param {string[]} ids
 * @param {string} defaut
 * @returns {string|null} null quand l'URL n'est pas utilisée
 */
export function ongletDepuisURL(search, param, ids, defaut) {
  if (!param) return null
  const brut = new URLSearchParams(search ?? '').get(param)
  return idValide(ids, brut, defaut)
}

/**
 * Valeur à écrire dans l'URL pour sélectionner `id` (null → à retirer) :
 * l'onglet par défaut ne crée aucun paramètre.
 * @param {string|null} param
 * @param {string} id
 * @param {string} defaut
 * @returns {string|null}
 */
export function paramOnglet(param, id, defaut) {
  if (!param) return null
  return id === defaut ? null : id
}

/** Identifiant d'entité ARIA sûr (useId peut contenir des caractères spéciaux). */
function cle(useIdValue) {
  return String(useIdValue).replace(/[^a-zA-Z0-9]/g, '')
}

function BarreOnglets({
  items,
  actif,
  baseId,
  label,
  onChoisir,
  refsOnglets,
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
      <div
        role="tablist"
        aria-label={label}
        className="flex min-w-max gap-1 border-b border-[var(--border)]"
      >
        {items.map((item, i) => {
          const estActif = item.id === actif
          const tabId = `${baseId}-tab-${cle(item.id)}`
          return (
            <button
              key={item.id}
              ref={(el) => {
                if (refsOnglets) refsOnglets.current[i] = el
              }}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={estActif}
              aria-controls={`${baseId}-panel-${cle(item.id)}`}
              tabIndex={estActif ? 0 : -1}
              onClick={() => onChoisir(item.id)}
              onKeyDown={(e) => {
                const suivant = indexSuivant(e.key, i, items.length)
                if (suivant === null) return
                e.preventDefault()
                onChoisir(items[suivant].id)
                refsOnglets?.current?.[suivant]?.focus()
              }}
              className={`-mb-px inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors ${
                estActif
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {item.label}
              {item.badge !== undefined && item.badge !== null ? (
                <span
                  className={`badge-tone inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    estActif ? 'tone-blue' : 'tone-slate'
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Panneau({ baseId, actif, children }) {
  const tabId = `${baseId}-tab-${cle(actif)}`
  const panelId = `${baseId}-panel-${cle(actif)}`
  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      tabIndex={0}
      className="pt-4 focus-visible:outline-none"
    >
      {typeof children === 'function' ? children(actif) : children}
    </div>
  )
}

function TabsVue({ items, actif, choisir, label, children }) {
  const brut = useId()
  const baseId = `tabs${cle(brut)}`
  const refsOnglets = useRef([])

  return (
    <div>
      <BarreOnglets
        items={items}
        actif={actif}
        baseId={baseId}
        label={label}
        onChoisir={choisir}
        refsOnglets={refsOnglets}
      />
      <Panneau baseId={baseId} actif={actif}>
        {children}
      </Panneau>
    </div>
  )
}

/** Onglets gérés en état local (aucun paramètre d'URL). */
function TabsInterne({ items, defaultValue, label, onChange, children }) {
  const ids = items.map((i) => i.id)
  const defaut = defaultValue ?? ids[0]
  const [actif, setActif] = useState(() => idValide(ids, undefined, defaut))

  const choisir = (id) => {
    const idSuivant = idValide(ids, id, defaut)
    if (idSuivant !== actif) {
      setActif(idSuivant)
      onChange?.(idSuivant)
    }
  }

  return <TabsVue items={items} actif={actif} choisir={choisir} label={label}>{children}</TabsVue>
}

/** Onglets synchronisés avec l'URL (`?onglet=…`), conservés au retour arrière. */
function TabsAvecURL({ items, defaultValue, param, label, onChange, children }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const ids = items.map((i) => i.id)
  const defaut = defaultValue ?? ids[0]
  const actif = idValide(ids, searchParams.get(param), defaut)

  const choisir = (id) => {
    const idSuivant = idValide(ids, id, defaut)
    const suivant = new URLSearchParams(searchParams)
    const valeur = paramOnglet(param, idSuivant, defaut)
    if (valeur === null) suivant.delete(param)
    else suivant.set(param, valeur)
    // push : le bouton retour revoie à l'onglet précédent.
    if (suivant.toString() !== searchParams.toString()) setSearchParams(suivant)
    if (idSuivant !== actif) onChange?.(idSuivant)
  }

  return <TabsVue items={items} actif={actif} choisir={choisir} label={label}>{children}</TabsVue>
}

/**
 * @param {{items: Array<{id: string, label: string,
 *          badge?: number|string|null}>,
 *          defaultValue?: string,
 *          param?: string,
 *          label?: string,
 *          onChange?: (id: string) => void,
 *          children: React.ReactNode | ((id: string) => React.ReactNode)}} props
 */
export default function Tabs({
  items,
  defaultValue,
  param,
  label = 'Sections',
  onChange,
  children,
}) {
  if (!Array.isArray(items) || items.length === 0) return null
  const props = { items, defaultValue, label, onChange, children }
  if (param) return <TabsAvecURL {...props} param={param} />
  return <TabsInterne {...props} />
}
