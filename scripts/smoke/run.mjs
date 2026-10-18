// Headless filter smoke test: `npm run smoke [-- outDir]`.
// Hidden Electron window + Chromium fake camera (no desktop capture). Serves scripts/smoke/smoke.html
// through the gallery's Vite config, then writes smoke.json + smoke.png (contact sheet) to outDir.
import { app, BrowserWindow, session } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const outDir = resolve(process.argv.find((a, i) => i > 1 && !a.startsWith('-') && !a.endsWith('.mjs')) ?? resolve(root, 'out/smoke'))

app.commandLine.appendSwitch('use-fake-device-for-media-stream')
app.commandLine.appendSwitch('use-fake-ui-for-media-stream')

app.whenReady().then(async () => {
  const server = await createServer({ configFile: resolve(root, 'src/engine/dev/vite.config.mjs'), server: { port: 5198, strictPort: true, hmr: false, watch: { ignored: ['**'] } } })
  await server.listen()
  session.defaultSession.setPermissionRequestHandler((_wc, _p, cb) => cb(true))
  const win = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { backgroundThrottling: false } })
  win.webContents.on('console-message', (e) => { if (process.env.SMOKE_VERBOSE || e.message.startsWith('[smoke]')) console.log(`[page ${e.level}] ${e.message}`) })
  await win.loadURL('http://localhost:5198/scripts/smoke/smoke.html' + (process.env.SMOKE_ONLY ? '?only=' + process.env.SMOKE_ONLY : ''))

  let res = null
  for (let i = 0; i < 600 && !res; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    res = await win.webContents.executeJavaScript('window.__smoke ?? null')
  }
  let code = 1
  if (res) {
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(outDir, 'smoke.png'), Buffer.from(res.sheet.split(',')[1], 'base64'))
    delete res.sheet
    writeFileSync(resolve(outDir, 'smoke.json'), JSON.stringify(res, null, 2))
    for (const r of res.results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id.padEnd(20)} changed ${String(r.changed).padStart(3)}%  ${r.ms.toFixed(2)} ms  engine ${r.engine}${r.error ? '  ' + r.error : ''}`)
    console.log(`${res.results.length} filters, ${res.results.filter((r) => !r.ok).length} failed → ${outDir}`)
    code = res.results.every((r) => r.ok) ? 0 : 1
  } else console.log('timed out')
  await server.close()
  app.exit(code)
})
