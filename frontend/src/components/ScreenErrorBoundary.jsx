/**
 * Frontière d'erreur des écrans lazy — affiche « Impossible de charger
 * l'écran » + un bouton Réessayer (reload : un chunk de build obsolète
 * ne peut être rechargé proprement qu'en réinitialisant la page).
 */
import { Component } from 'react'
import Button from './Button.jsx'

export default class ScreenErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(prevProps) {
    // Navigation vers un autre écran → on retente le chargement.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  componentDidCatch(error) {
    console.error('Chargement de l’écran impossible :', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
        >
          <p className="text-base font-semibold text-slate-900">
            Impossible de charger l’écran
          </p>
          <p className="text-sm text-slate-500">
            Vérifiez votre connexion puis réessayez.
          </p>
          <Button onClick={() => window.location.reload()}>Réessayer</Button>
        </div>
      )
    }
    return this.props.children
  }
}
