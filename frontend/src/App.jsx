
/** Routage applicatif — Caisse eager (bundle initial), autres écrans lazy. */
import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/Toast.jsx'
import PageTransition from './components/PageTransition.jsx'
import { BoutiqueProvider } from './config/boutique.js'
import { CartProvider } from './context/CartContext.jsx'
import { MessagesProvider } from './context/MessagesContext.jsx'
import Layout from './components/Layout.jsx'
// Écran d'accueil caisse : chargé directement (jamais de fallback).
import Caisse from './pages/Caisse.jsx'

const Accueil = lazy(() => import('./pages/Accueil.jsx'))
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
        <MessagesProvider>
          <ToastProvider>
            <CartProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<PageTransition><Accueil /></PageTransition>} />
                    <Route path="/" element={<PageTransition><Accueil /></PageTransition>} />
                    <Route path="/accueil" element={<PageTransition><Accueil /></PageTransition>} />
                    <Route path="/caisse" element={<PageTransition><Caisse /></PageTransition>} />
                    <Route path="/produits" element={<PageTransition><Produits /></PageTransition>} />
                    <Route path="/ventes" element={<PageTransition><Ventes /></PageTransition>} />
                    <Route path="/rapport" element={<PageTransition><Rapport /></PageTransition>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </CartProvider>
          </ToastProvider>
        </MessagesProvider>
      </BoutiqueProvider>
    </QueryClientProvider>
  )
}
