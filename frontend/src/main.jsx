import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyTheme, getStoredTheme, THEME_KEY } from './config/theme.js'
import { demoState } from './lib/demo.js'

/**
 * Amorçage : si VITE_USE_MOCK=true, démarre le worker MSW AVANT le rendu
 * (les écrans ne savent pas si les données sont mockées ou réelles).
 *
 * Le démarrage de MSW peut échouer — Firefox en navigation privée lève
 * « The operation is insecure » (SecurityError sur serviceWorker.register).
 * On rattrape l'erreur, on marque le mode démo indisponible et on rend
 * QUAND MÊME l'application : la bannière <DemoBanner /> prévient l'utilisateur,
 * au lieu d'un écran blanc.
 */
async function bootstrap() {
 const theme = getStoredTheme()
 applyTheme(theme)
 if (window.matchMedia('(prefers-color-scheme: dark)').matches && theme === 'auto') {
   applyTheme('auto')
 }

 if (import.meta.env.VITE_USE_MOCK === 'true') {
   try {
     const { worker } = await import('./mocks/browser.js')
     await worker.start({ onUnhandledRequest: 'bypass' })
     demoState.actif = true
   } catch (err) {
     console.error('MSW — démarrage du mode démo impossible :', err)
     demoState.indisponible = true
   }
 }

 createRoot(document.getElementById('root')).render(
   <StrictMode>
     <App />
   </StrictMode>,
 )
}

bootstrap()
