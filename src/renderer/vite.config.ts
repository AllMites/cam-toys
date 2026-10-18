// Renderer-only dev server for working on the UI in a plain browser (window.camtoys is stubbed).
// npx vite --config src/renderer/vite.config.ts
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  root: resolve(__dirname),
  resolve: { alias: { '@engine': resolve(__dirname, '../engine'), '@filters': resolve(__dirname, '../filters') } },
  plugins: [svelte({ configFile: resolve(__dirname, '../../svelte.config.mjs') })],
  cacheDir: resolve(__dirname, '../../node_modules/.vite-renderer-ui'), // keep clear of electron-vite's cache
  server: { port: 5211 }
})
