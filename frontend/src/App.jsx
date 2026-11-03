/**
 * Point d'entrée de l'interface — Gestion des Ventes & Stock (MVP).
 * Squelette initial : sera remplacé par le dashboard et les écrans métier
 * (catalogue, vente, stocks, alertes).
 */
const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'

export default function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 720 }}>
      <h1>Gestion des Ventes &amp; Stock — MVP</h1>
      <p>Squelette React (Vite) initialisé. L'interface sera développée ici.</p>
      <p>
        API : <code>{apiBase}</code>
      </p>
    </main>
  )
}
