/** Onglets accessibles — rôles ARIA, roving tabindex, URL, logique clavier. */
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, useLocation } from 'react-router-dom'
import Tabs, { idValide, indexSuivant, ongletDepuisURL, paramOnglet } from './Tabs.jsx'

const ITEMS = [
  { id: 'jour', label: "Aujourd'hui" },
  { id: 'mois', label: 'Ce mois' },
  { id: 'stock', label: 'Stock', badge: 14 },
]

const contenu = (id) => <p>contenu-{id}</p>

/** SSR : React insère des séparateurs `<!-- -->` entre les nœuds de texte. */
const nettoie = (html) => html.replace(/<!-- -->/g, '')

function render(els, props = {}) {
  return nettoie(
    renderToString(
      <MemoryRouter initialEntries={['/rapport']}>
        <Tabs items={els} {...props}>
          {contenu}
        </Tabs>
      </MemoryRouter>,
    ),
  )
}

describe('Tabs — ARIA', () => {
  it('expose tablist, tabs, tabpanel et les liaisons croisées', () => {
    const html = render(ITEMS)
    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-label="Sections"')
    expect(html.match(/role="tab"/g)).toHaveLength(3)
    expect(html).toContain('role="tabpanel"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('aria-selected="false"')

    const actif = html.match(/id="([^"]+)"[^>]*aria-selected="true"/)
    expect(actif).not.toBeNull()
    expect(html).toContain(`aria-controls="${actif[1].replace('-tab-', '-panel-')}"`)
    expect(html).toContain(`aria-labelledby="${actif[1]}"`)
  })

  it('ne rend QUE l’onglet actif', () => {
    const html = render(ITEMS)
    expect(html).toContain('contenu-jour')
    expect(html).not.toContain('contenu-mois')
    expect(html).not.toContain('contenu-stock')
    expect(html.match(/role="tabpanel"/g)).toHaveLength(1)
  })

  it('onglet par défaut : premier élément, aucun état initial imposé', () => {
    const html = render(ITEMS)
    expect(html).toContain('contenu-jour')
    expect(html).toContain('aria-selected="true"')
    expect(html).not.toContain('contenu-mois')
  })

  it('roving tabindex : 0 sur l’actif, −1 sur les autres (Tab sort de la liste)', () => {
    const html = render(ITEMS)
    const bouts = html.match(/<button[^>]*>/g) ?? []
    expect(bouts).toHaveLength(3)
    const tabindex = bouts.map((b) => (b.match(/tabindex="(-?\d+)"/) ?? [])[1])
    expect(tabindex).toEqual(['0', '-1', '-1'])
  })

  it('badge de l’onglet (nombre de produits à surveiller)', () => {
    const html = render(ITEMS)
    expect(html).toContain('>14<')
    expect(html).toContain('Stock')
  })

  it('panneau focalisable (tabIndex=0) pour atteindre son contenu au clavier', () => {
    const html = render(ITEMS)
    expect(html).toMatch(/role="tabpanel"[^>]*tabindex="0"/)
  })

  it('libellé personnalisé du tablist', () => {
    const html = render(ITEMS, { label: 'Sections du rapport' })
    expect(html).toContain('aria-label="Sections du rapport"')
  })

  it('sans onglet → rien (pas de plantage)', () => {
    expect(renderToString(<MemoryRouter><Tabs items={[]} /></MemoryRouter>)).toBe('')
  })
})

describe('Tabs — état interne', () => {
  it('defaultValue sélectionne un autre onglet', () => {
    const html = render(ITEMS, { defaultValue: 'stock' })
    expect(html).toContain('contenu-stock')
    expect(html).not.toContain('contenu-jour')
  })
})

describe('Tabs — URL (?onglet=)', () => {
  function renderURL(search, props = {}) {
    return nettoie(
      renderToString(
        <MemoryRouter initialEntries={[`/rapport${search}`]}>
          <Tabs items={ITEMS} param="onglet" {...props}>
            {(id) => <LectureURL id={id} />}
          </Tabs>
        </MemoryRouter>,
      ),
    )
  }

  function LectureURL({ id }) {
    const location = useLocation()
    return (
      <p>
        onglet={id} search={location.search}
      </p>
    )
  }

  it('lit l’onglet dans l’URL (rechargement conservé)', () => {
    const html = renderURL('?onglet=stock')
    expect(html).toContain('onglet=stock')
    expect(html).toContain('search=?onglet=stock')
    expect(html).toContain('aria-selected="true"')
  })

  it('valeur inconnue ou absente → onglet par défaut', () => {
    expect(renderURL('')).toContain('onglet=jour')
    expect(renderURL('?onglet=inconnu')).toContain('onglet=jour')
    expect(renderURL('?onglet=')).toContain('onglet=jour')
  })
})

describe('logique pure des onglets', () => {
  it('indexSuivant : flèches, Home, Fin, en boucle', () => {
    expect(indexSuivant('ArrowRight', 0, 3)).toBe(1)
    expect(indexSuivant('ArrowRight', 2, 3)).toBe(0)
    expect(indexSuivant('ArrowLeft', 0, 3)).toBe(2)
    expect(indexSuivant('ArrowLeft', 2, 3)).toBe(1)
    expect(indexSuivant('Home', 2, 3)).toBe(0)
    expect(indexSuivant('End', 0, 3)).toBe(2)
  })

  it('indexSuivant : touches hors navigation → null', () => {
    expect(indexSuivant('Tab', 0, 3)).toBeNull()
    expect(indexSuivant('Enter', 1, 3)).toBeNull()
    expect(indexSuivant('a', 1, 3)).toBeNull()
    expect(indexSuivant('ArrowRight', 0, 0)).toBeNull()
    expect(indexSuivant('ArrowRight', 0, NaN)).toBeNull()
  })

  it('idValide : valeur inconnue → défaut → premier', () => {
    expect(idValide(['a', 'b'], 'b', 'a')).toBe('b')
    expect(idValide(['a', 'b'], 'zz', 'a')).toBe('a')
    expect(idValide(['a', 'b'], null, 'zz')).toBe('a')
    expect(idValide(['a', 'b'], null, null)).toBe('a')
    expect(idValide([], 'a', 'a')).toBeUndefined()
  })

  it('ongletDepuisURL : paramètre absent ou faux → défaut', () => {
    expect(ongletDepuisURL('?onglet=stock', 'onglet', ['jour', 'stock'], 'jour')).toBe('stock')
    expect(ongletDepuisURL('', 'onglet', ['jour', 'stock'], 'jour')).toBe('jour')
    expect(ongletDepuisURL('?x=1', 'onglet', ['jour', 'stock'], 'jour')).toBe('jour')
    expect(ongletDepuisURL('?onglet=nope', 'onglet', ['jour', 'stock'], 'jour')).toBe('jour')
    expect(ongletDepuisURL('?onglet=stock', null, ['jour', 'stock'], 'jour')).toBeNull()
  })

  it('paramOnglet : défaut sans paramètre, sinon valeur', () => {
    expect(paramOnglet('onglet', 'jour', 'jour')).toBeNull()
    expect(paramOnglet('onglet', 'stock', 'jour')).toBe('stock')
    expect(paramOnglet(null, 'stock', 'jour')).toBeNull()
  })
})
