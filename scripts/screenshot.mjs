// README screenshot: `npm run screenshot` (after `npm run build`).
// Runs the built app with Chromium's fake camera, a throwaway profile and an off-screen
// window, applies a preset through the real UI, then captures the window (never the desktop).
import { app, BrowserWindow } from 'electron'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const PRESET = process.env.SHOT_PRESET ?? 'VHS Night'

app.commandLine.appendSwitch('use-fake-device-for-media-stream')
app.commandLine.appendSwitch('use-fake-ui-for-media-stream')
app.setPath('userData', mkdtempSync(join(tmpdir(), 'camtoys-shot-')))
app.on('browser-window-created', (_e, w) => {
  w.setPosition(-4000, -4000) // off-screen: rendered for capture, never in front of the user
  w.once('show', () => w.setPosition(-4000, -4000))
})

await import(pathToFileURL(resolve(root, 'out/main/index.js')).href)
// No top-level await on ready: Electron fires 'ready' only after this ESM entry finishes evaluating.
app.whenReady().then(shoot)

async function shoot() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let win
  for (let i = 0; i < 100 && !(win = BrowserWindow.getAllWindows()[0]); i++) await sleep(100)
  await new Promise((r) => (win.webContents.isLoading() ? win.webContents.once('did-finish-load', r) : r()))
  await sleep(1500)

  const js = `(async () => {
  const btn = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent ?? ''))
  for (let i = 0; i < 10; i++) { const b = btn(/^(Skip|Got it|Done|Let.s go)/i); if (!b) break; b.click(); await new Promise(r => setTimeout(r, 300)) }
  await window.camtoys.settings.set({ tutorialDone: true })
  const p = btn(new RegExp(${JSON.stringify(PRESET)}))
  p?.click()
  return !!p
})()`
  console.log('preset clicked:', await win.webContents.executeJavaScript(js))
  await sleep(4000)
  const img = await win.webContents.capturePage()
  const out = resolve(root, 'docs/screenshot.png')
  writeFileSync(out, img.toPNG())
  console.log('wrote', out, img.getSize())
  app.exit(0)
}
