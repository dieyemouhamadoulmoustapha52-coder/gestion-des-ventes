/**
 * Shell de l'application : barre latérale (≥ 1024 px) / navigation basse
 * (mobile, cibles ≥ 44 px) + Suspense pour les routes lazy.
 */
import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Package, Receipt, ShoppingCart } from 'lucide-react'
import DemoBanner from './DemoBanner.jsx'
import PageSkeleton from './PageSkeleton.jsx'

const NAV = [
  { to: '/caisse', label: 'Caisse', icon: ShoppingCart },
  { to: '/produits', label: 'Produits', icon: Package },
  { to: '/ventes', label: 'Ventes', icon: Receipt },
  { to: '/rapport', label: 'Rapport', icon: BarChart3 },
]

function Brand() {
  return (
    <>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white"
        aria-hidden="true"
      >
        GV
      </span>
      <div className="leading-tight">
        <p className="text-sm font-bold text-slate-900">Gestion des ventes</p>
        <p className="text-xs text-slate-500">Point de vente MVP</p>
      </div>
    </>
  )
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Barre latérale — écrans larges */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Navigation principale">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-blue-600' : ''} aria-hidden="true" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* En-tête — mobile */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
        <Brand />
      </header>

      {/* Contenu */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 pb-28 lg:pb-10">
          <DemoBanner />
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Navigation basse — mobile */}
      <nav
        aria-label="Navigation principale (mobile)"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white lg:hidden"
      >
        <div className="grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-blue-600' : 'text-slate-500'
                }`
              }
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
