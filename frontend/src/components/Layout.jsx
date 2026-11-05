/**
 * Shell de l'application : barre latérale (≥ 1024 px) / navigation basse
 * (mobile, cibles ≥ 44 px) + Suspense pour les routes lazy.
 */
import { Suspense, useEffect, useState } from 'react'
import { BarChart3, Home, Package, Receipt, ShoppingCart } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useBoutique } from '../config/boutique.js'
import { applyTheme, getStoredTheme, THEME_KEY, THEME_OPTIONS } from '../config/theme.js'
import DemoBanner from './DemoBanner.jsx'
import PageSkeleton from './PageSkeleton.jsx'

const NAV = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/caisse', label: 'Caisse', icon: ShoppingCart },
  { to: '/produits', label: 'Produits', icon: Package },
  { to: '/ventes', label: 'Ventes', icon: Receipt },
  { to: '/rapport', label: 'Rapport', icon: BarChart3 },
]

function Brand() {
  const boutique = useBoutique()

  return (
    <>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
        style={{ backgroundColor: boutique.couleur }}
        aria-hidden="true"
      >
        {boutique.sigle}
      </span>
      <div className="leading-tight">
        <p className="text-sm font-bold text-[var(--text)]">{boutique.nom}</p>
        <p className="text-xs text-[var(--muted)]">{boutique.devise}</p>
      </div>
    </>
  )
}

function ThemeSelector() {
  const [theme, setTheme] = useState(() => getStoredTheme())

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setTheme(option.value)}
          className={`min-h-9 rounded-full px-3 text-xs font-medium transition ${
            theme === option.value
              ? 'bg-[var(--text)] text-[var(--bg)]'
              : 'text-[var(--muted)] hover:bg-[var(--surface-alt)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default function Layout() {
  const boutique = useBoutique()

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
        <div className="flex h-16 items-center justify-between gap-3 border-b border-[var(--border)] px-5">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Navigation principale">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  isActive ? 'text-[var(--primary)]' : 'text-[var(--muted)] hover:bg-[var(--surface-alt)]'
                }`
              }
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--color-primary-soft)' : undefined,
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} style={{ color: isActive ? boutique.couleur : 'var(--muted)' }} aria-hidden="true" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:hidden">
        <Brand />
        <ThemeSelector />
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 pb-28 lg:pb-10">
          <div className="mb-4 flex justify-end">
            <ThemeSelector />
          </div>
          <DemoBanner />
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <nav
        aria-label="Navigation principale (mobile)"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] lg:hidden"
      >
        <div className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-[var(--primary)]' : 'text-[var(--muted)]'
                }`
              }
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--color-primary-soft)' : undefined,
              })}
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
