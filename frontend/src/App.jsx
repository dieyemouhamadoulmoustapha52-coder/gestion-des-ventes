/** Routage applicatif — pages lazy (React.lazy + Suspense dans Layout). */
import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/Toast.jsx'
import Layout from './components/Layout.jsx'

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
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/caisse" replace />} />
              <Route path="/caisse" element={<Caisse />} />
              <Route path="/produits" element={<Produits />} />
              <Route path="/ventes" element={<Ventes />} />
              <Route path="/rapport" element={<Rapport />} />
              <Route path="*" element={<Navigate to="/caisse" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
