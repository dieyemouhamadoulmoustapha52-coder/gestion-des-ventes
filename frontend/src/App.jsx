
/** Routage applicatif — pages lazy (React.lazy + Suspense dans Layout). */
import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/Toast.jsx'
import { BoutiqueProvider } from './config/boutique.js'
import { CartProvider } from './context/CartContext.jsx'
import Layout from './components/Layout.jsx'

const Accueil = lazy(() => import('./pages/Accueil.jsx'))
const Caisse = lazy(() => import('./pages/Caisse.jsx'))
const Produits = lazy(() => import('./pages/Produits.jsx'))
const Ventes = lazy(() => import('./pages/Ventes.jsx'))
const Rapport = lazy(() => import('./pages/Rapport.jsx'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BoutiqueProvider>
        <ToastProvider>
          <CartProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Accueil />} />
                  <Route path="/" element={<Accueil />} />
                  <Route path="/accueil" element={<Accueil />} />
                  <Route path="/caisse" element={<Caisse />} />
                  <Route path="/produits" element={<Produits />} />
                  <Route path="/ventes" element={<Ventes />} />
                  <Route path="/rapport" element={<Rapport />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </ToastProvider>
      </BoutiqueProvider>
    </QueryClientProvider>
  )
}
