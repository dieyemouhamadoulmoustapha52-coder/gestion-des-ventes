/**
 * Barre de messages — notifications DANS LE FLUX (sous l'en-tête, tous écrans) :
 * aucun popup/toast. Un message à la fois par priorité, compteur dépliable,
 * navigation précédent/suivant, fermeture (si masquable) et action éventuelle.
 * Accessible : role alert/status, aria-live, clavier, prefers-reduced-motion.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  OctagonAlert,
  X,
} from 'lucide-react'
import { useMessages } from '../context/MessagesContext.jsx'
import { DUREE_EPHEMERE, DUREE_ROTATION } from '../lib/messages.js'

/** Niveau → icône + libellé textuel (la couleur seule ne suffit jamais). */
const NIVEAUX = {
  critique: { label: 'Critique', couleur: 'var(--danger)', Icon: OctagonAlert },
  avertissement: { label: 'Avertissement', couleur: 'var(--warning)', Icon: AlertTriangle },
  succes: { label: 'Succès', couleur: 'var(--success)', Icon: CheckCircle2 },
  info: { label: 'Info', couleur: 'var(--primary)', Icon: Info },
}

const BTN =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-alt)] disabled:cursor-not-allowed disabled:opacity-40'

export default function MessageBar() {
  const { messages, index, setIndex, expire, masquer } = useMessages()
  const [expanded, setExpanded] = useState(false)
  const [pause, setPause] = useState(false) // pause du décompte éphémère (survol/focus)
  const [reste, setReste] = useState(null)

  const current = messages[index] ?? null
  const niveau = current ? NIVEAUX[current.niveau] : null
  const ephemere = messages.find((m) => m.ephemere) ?? null
  const total = messages.length

  // Décompte du message éphémère : 4 s, en pause au survol et au focus.
  // Indépendant de l'index : le décompte continue même si l'on navigue ailleurs.
  useEffect(() => {
    setReste(ephemere ? ephemere.duree ?? DUREE_EPHEMERE : null)
  }, [ephemere?.id, ephemere?.duree])

  useEffect(() => {
    if (reste === null || pause || !ephemere) return
    if (reste <= 0) {
      expire(ephemere.id)
      return
    }
    const timer = setTimeout(() => setReste((r) => Math.max(0, r - 100)), 100)
    return () => clearTimeout(timer)
  }, [reste, pause, ephemere, expire])

  useEffect(() => {
    if (messages.length === 0) setExpanded(false)
  }, [messages.length])

  // Défilement automatique : chaque message reste DUREE_ROTATION ms puis
  // on passe au suivant (boucle). En pause au survol/focus, quand le panneau
  // est ouvert et pendant un message éphémère (qui a son propre décompte).
  const dureeRotation = current?.duree ?? DUREE_ROTATION
  useEffect(() => {
    if (total <= 1 || pause || expanded || ephemere) return
    const timer = setTimeout(() => setIndex((index + 1) % total), dureeRotation)
    return () => clearTimeout(timer)
  }, [index, total, pause, expanded, ephemere, setIndex, dureeRotation])

  const critique = current?.niveau === 'critique'

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && expanded) {
      e.stopPropagation()
      setExpanded(false)
    }
  }

  // Région live toujours montée (sr-only à vide → aucun espace visuel) :
  // le lecteur d'écran annonce l'arrivée/le changement de message.
  if (!current || !niveau) {
    return <div className="sr-only" role="status" aria-live="polite" />
  }

  const { Icon, label, couleur } = niveau

  return (
    <div
      className="border-b-2 border-[var(--border)] bg-[var(--surface-alt)]"
      style={{
        // Fond teinté au niveau du message (repli : --surface-alt si
        // color-mix indisponible) + liseré fort à gauche.
        backgroundColor: `color-mix(in srgb, ${couleur} 15%, var(--surface))`,
        borderBottomColor: `color-mix(in srgb, ${couleur} 50%, var(--border))`,
        borderLeft: `5px solid ${couleur}`,
      }}
      role={critique ? 'alert' : 'status'}
      aria-live={critique ? undefined : 'polite'}
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onFocusCapture={() => setPause(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPause(false)
      }}
      onKeyDown={onKeyDown}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full p-1.5"
          style={{ backgroundColor: `color-mix(in srgb, ${couleur} 25%, var(--surface))` }}
        >
          <Icon size={17} style={{ color: couleur }} aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 basis-48 truncate text-sm font-semibold text-[var(--text)]">
          {current.texte}
        </p>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold text-[var(--text)]"
          style={{
            backgroundColor: `color-mix(in srgb, ${couleur} 22%, var(--surface))`,
            borderColor: couleur,
          }}
        >
          {label}
        </span>

        {total > 0 && (
          <button
            type="button"
            className={`${BTN} tabular-nums`}
            aria-expanded={expanded}
            aria-controls="messages-bar-panel"
            aria-label={`Messages : ${index + 1} sur ${total}. ${expanded ? 'Masquer' : 'Afficher'} la liste`}
            onClick={() => setExpanded((v) => !v)}
          >
            {index + 1}/{total}
          </button>
        )}
        {total > 1 && (
          <>
            <button
              type="button"
              className={BTN}
              aria-label="Message précédent"
              disabled={index === 0}
              onClick={() => setIndex(Math.max(0, index - 1))}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={BTN}
              aria-label="Message suivant"
              disabled={index >= total - 1}
              onClick={() => setIndex(Math.min(total - 1, index + 1))}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </>
        )}

        {current.action?.route && (
          <Link
            to={current.action.route}
            className={`${BTN} no-underline`}
            onClick={() => setExpanded(false)}
          >
            {current.action.label}
          </Link>
        )}
        {current.action?.callback && (
          <button type="button" className={BTN} onClick={current.action.callback}>
            {current.action.label}
          </button>
        )}
        {current.masquable && (
          <button
            type="button"
            className={BTN}
            aria-label="Masquer ce message"
            onClick={() => masquer(current)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Panneau EN LIGNE (dans le flux, jamais en overlay) */}
      {expanded && (
        <div id="messages-bar-panel" className="border-t border-[var(--border)] bg-[var(--surface-alt)]">
          <ul
            className="mx-auto max-h-64 max-w-6xl divide-y divide-[var(--border)] overflow-y-auto px-3 sm:px-4"
            aria-label="Tous les messages"
          >
            {messages.map((m, i) => {
              const n = NIVEAUX[m.niveau]
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    aria-current={i === index ? 'true' : undefined}
                    className="flex w-full items-center gap-2 px-1 py-2.5 text-left hover:bg-[var(--surface)]"
                    onClick={() => {
                      setIndex(i)
                      setExpanded(false)
                    }}
                  >
                    <n.Icon size={16} className="shrink-0" style={{ color: n.couleur }} aria-hidden="true" />
                    <span className="shrink-0 text-[11px] font-semibold text-[var(--text)]">
                      {n.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{m.texte}</span>
                    {i === index && (
                      <span className="shrink-0 text-[11px] text-[var(--muted)]">affiché</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
