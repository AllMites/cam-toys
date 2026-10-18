import type { CamtoysApi, Settings } from '@engine/types'
import { mockFlags } from './engine'

// window.camtoys stand-in for running the renderer in a plain browser (no preload).
// Settings live in localStorage; ?mock=vcam pretends the virtual camera is installed.
const KEY = 'camtoys.mock.settings'
const DEFAULTS: Settings = {
  cameraId: null, width: 1280, height: 720, fps: 30,
  lastLayers: [], tutorialDone: false, closeToTray: true,
  hotkeys: { next: 'Control+Alt+Right', prev: 'Control+Alt+Left' }
}

function read(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return { ...DEFAULTS } }
}

export const mockCamtoys: CamtoysApi = {
  settings: {
    get: async () => read(),
    set: async (patch) => {
      const s = { ...read(), ...patch }
      try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode: keep in memory only */ }
      return s
    }
  },
  vcam: {
    available: () => mockFlags.has('vcam'),
    start: () => mockFlags.has('vcam'),
    send: () => {},
    stop: () => {}
  },
  quit: () => window.close()
}
