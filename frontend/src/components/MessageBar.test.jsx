/** Rendu SSR de la barre de messages (pas de DOM requis). */
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { BoutiqueProvider } from '../config/boutique.js'
import { MessagesProvider } from '../context/MessagesContext.jsx'
import MessageBar from './MessageBar.jsx'

const p = (id, nom, stock, extra = {}) => ({ id, nom, stock, ...extra })

function renderBar(produits) {
  const qc = new QueryClient()
  qc.setQueryData(['produits', 'grille', {}], {
    results: produits,
    count: produits.length,
    next: null,
  })
  return renderToString(
    <QueryClientProvider client={qc}>
      <BoutiqueProvider>
        <MessagesProvider>
          <MemoryRouter>
            <MessageBar />
          </MemoryRouter>
        </MessagesProvider>
      </BoutiqueProvider>
    </QueryClientProvider>,
  )
}

describe('MessageBar', () => {
  it('affiche le stock bas avec icône + libellé (role status, pas de couleur seule)', () => {
    const html = renderBar([p(1, 'Riz 25 kg', 3)])
    expect(html).toContain('Riz 25 kg : il reste 3')
    expect(html).toContain('Avertissement')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Masquer ce message') // masquable
  })

  it('affiche la rupture en role alert, non masquable', () => {
    const html = renderBar([p(1, 'Riz 25 kg', 0)])
    expect(html).toContain('Riz 25 kg : rupture de stock')
    expect(html).toContain('Critique')
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('Masquer ce message')
  })

  it('regroupe au-delà de 3 produits avec l’action Voir vers Produits filtré', () => {
    const html = renderBar([
      p(1, 'A', 1),
      p(2, 'B', 1),
      p(3, 'C', 0),
      p(4, 'D', 2),
      p(5, 'E', 3),
    ])
    expect(html).toContain('5 produits en stock bas')
    expect(html).toContain('href="/produits?stock_bas=true"')
    expect(html).not.toContain('A : il reste 1') // pas de messages individuels
  })

  it('sans aucun message : région live invisible, aucun espace visuel', () => {
    const html = renderBar([])
    expect(html).toContain('sr-only')
    expect(html).not.toContain('border-b')
    expect(html).not.toContain('truncate')
  })
})
