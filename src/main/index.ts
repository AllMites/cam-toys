import { app, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { load, save, merge } from './settings'
import { createTray } from './tray'

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
      sandbox: false // Phase 2's preload loads the Softcam DLL via koffi
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('io.github.allmites.camtoys')
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))

  // Camera only; deny everything else.
  session.defaultSession.setPermissionRequestHandler((_wc, p, cb) => cb(p === 'media'))
  session.defaultSession.setPermissionCheckHandler((_wc, p) => p === 'media')

  ipcMain.handle('settings:get', () => settings)
  ipcMain.handle('settings:set', (_e, patch: unknown) => {
    settings = merge({ ...settings, ...(patch && typeof patch === 'object' ? patch : {}) })
    save(settingsFile, settings)
    return settings
  })
  ipcMain.on('app:quit', () => app.quit())

  createTray(showWindow)
  createWindow()
})
