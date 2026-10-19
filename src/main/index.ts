import { app, BrowserWindow, globalShortcut, ipcMain, session } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { autoUpdater } from 'electron-updater'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { load, save, merge } from './settings'
import { createTray, setTrayPresets } from './tray'
import type { Command, Settings } from '../engine/types'

let win: BrowserWindow | null = null
let quitting = false

// exit() not quit(): quit is async and whenReady would still build a tray/window.
if (!app.requestSingleInstanceLock()) app.exit(0)

const settingsFile = join(app.getPath('userData'), 'settings.json')
let settings = load(settingsFile)

function showWindow(): void {
  if (!win) return createWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 640,
    backgroundColor: '#0F0F12', show: false, autoHideMenuBar: true, title: 'cam-toys',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Phase 2's preload loads the Softcam DLL via koffi
      backgroundThrottling: false // keep feeding the virtual camera while hidden in the tray
    }
  })
  win.on('ready-to-show', () => win?.show())
  // Close hides to tray; real quit comes from the tray menu or app:quit.
  win.on('close', (e) => {
    if (!quitting && settings.closeToTray) { e.preventDefault(); win?.hide() }
  })
  win.on('closed', () => (win = null))
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const devUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined
  win.webContents.on('will-navigate', (e, url) => {
    if (!devUrl || !url.startsWith(devUrl)) e.preventDefault()
  })
  if (devUrl) win.loadURL(devUrl)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.on('second-instance', showWindow)
app.on('before-quit', () => (quitting = true))
app.on('window-all-closed', () => {}) // stay alive in the tray
app.on('activate', () => showWindow()) // mac: dock icon click
app.on('will-quit', () => globalShortcut.unregisterAll())

const send = (c: Command): void => win?.webContents.send('command', c)

// Global hotkeys cycle presets even while Discord/Zoom is focused.
function registerHotkeys(h: Settings['hotkeys']): void {
  globalShortcut.unregisterAll()
  const bind = (accel: string, id: 'next' | 'prev'): void => {
    try {
      if (!globalShortcut.register(accel, () => send({ type: 'preset', id }))) console.warn('[hotkeys] taken by another app:', accel)
    } catch (e) {
      console.warn('[hotkeys] invalid accelerator:', accel, e)
    }
  }
  bind(h.next, 'next')
  bind(h.prev, 'prev')
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('io.github.allmites.camtoys')
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))

  // Camera only; deny everything else.
  session.defaultSession.setPermissionRequestHandler((_wc, p, cb) => cb(p === 'media'))
  session.defaultSession.setPermissionCheckHandler((_wc, p) => p === 'media')

  ipcMain.handle('settings:get', () => settings)
  ipcMain.handle('settings:set', (_e, patch: unknown) => {
    const prevKeys = JSON.stringify(settings.hotkeys)
    settings = merge({ ...settings, ...(patch && typeof patch === 'object' ? patch : {}) })
    save(settingsFile, settings)
    if (JSON.stringify(settings.hotkeys) !== prevKeys) registerHotkeys(settings.hotkeys)
    return settings
  })
  ipcMain.handle('snapshot:save', (_e, png: unknown) => {
    if (!(png instanceof Uint8Array) || png.length < 8) throw new Error('Snapshot data is not a PNG.')
    const dir = join(app.getPath('pictures'), 'cam-toys')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `cam-toys-${new Date().toISOString().replace(/[:.]/g, '-')}.png`)
    writeFileSync(file, png)
    return file
  })
  ipcMain.on('presets:list', (_e, list: unknown) => setTrayPresets(Array.isArray(list) ? list : []))
  ipcMain.on('app:quit', () => app.quit())

  createTray(showWindow, send)
  registerHotkeys(settings.hotkeys)
  createWindow()

  // Auto-update: electron-updater reads latest.yml from the newest GitHub Release
  // (electron-builder uploads it next to the installer), downloads in the background,
  // shows a Windows notification, and installs on next quit.
  // Dev builds have no app-update.yml, so only run when packaged.
  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify().catch((e) => console.warn('[update]', e))
})
