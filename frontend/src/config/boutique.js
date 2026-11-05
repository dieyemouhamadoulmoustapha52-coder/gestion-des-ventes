import { createContext, createElement, useContext, useEffect, useMemo } from 'react'

export const DEFAULT_BOUTIQUE = {
  nom: 'Wagué Bussness Halal',
  sigle: 'WBH',
  couleur: '#2563eb',
  adresse: 'Dakar, Sénégal',
  telephone: '+221 77 000 00 00',
  message_ticket: 'Merci pour votre achat !',
  reseaux: '@waguebussness',
  caissier: 'Caisse principale',
  devise: 'Satisfaction de nos clients',
}

const BoutiqueContext = createContext(DEFAULT_BOUTIQUE)

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value
  const numeric = Number.parseInt(full, 16)
  const r = (numeric >> 16) & 255
  const g = (numeric >> 8) & 255
  const b = numeric & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function BoutiqueProvider({ children, value = {} }) {
  const boutique = useMemo(
    () => ({ ...DEFAULT_BOUTIQUE, ...value }),
    [value],
  )

  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', boutique.couleur)
    document.documentElement.style.setProperty('--color-primary-soft', hexToRgba(boutique.couleur, 0.12))
    document.documentElement.style.setProperty('--color-primary-strong', hexToRgba(boutique.couleur, 0.9))
  }, [boutique.couleur])

  return createElement(BoutiqueContext.Provider, { value: boutique }, children)
}

export function useBoutique() {
  return useContext(BoutiqueContext)
}
