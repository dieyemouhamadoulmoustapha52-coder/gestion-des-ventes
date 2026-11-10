export const THEME_KEY = 'gestion-ventes-theme'

export const THEME_OPTIONS = [
  { value: 'clair', label: 'Clair' },
  { value: 'sombre', label: 'Sombre' },
  { value: 'auto', label: 'Auto' },
]

export function resolveTheme(theme) {
  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair'
  }
  return theme === 'sombre' ? 'sombre' : 'clair'
}

export function applyTheme(theme) {
  const mode = resolveTheme(theme)
  document.documentElement.dataset.theme = mode
  document.documentElement.style.colorScheme = mode === 'sombre' ? 'dark' : 'light'
}

export function getStoredTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved && THEME_OPTIONS.some((t) => t.value === saved)) return saved
  return 'clair'
}
