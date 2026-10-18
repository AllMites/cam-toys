// Dev-only filter gallery: `npm run gallery`, then open the printed URL + /src/engine/dev/gallery.html
// in Chrome/Edge. Rooted at the repo so new files in src/filters/ show up without a restart.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = resolve(import.meta.dirname, '../../..')

export default defineConfig({
  root,
  resolve: { alias: { '@engine': resolve(root, 'src/engine'), '@filters': resolve(root, 'src/filters') } },
  server: { port: 5199, watch: { ignored: ['**/out/**', '**/dist/**', '**/resources/**'] } }
})
