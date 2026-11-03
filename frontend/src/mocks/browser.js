/** Worker MSW — démarré par src/main.jsx si VITE_USE_MOCK=true. */
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers.js'

export const worker = setupWorker(...handlers)
