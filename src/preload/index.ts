import { contextBridge, ipcRenderer } from 'electron'
import type { CamtoysApi, Command } from '../engine/types'
import { vcam } from './vcam'

const api: CamtoysApi = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch)
  },
  vcam,
  quit: () => ipcRenderer.send('app:quit'),
  saveSnapshot: (png) => ipcRenderer.invoke('snapshot:save', png),
  setPresets: (list) => ipcRenderer.send('presets:list', list),
  onCommand: (cb) => {
    const h = (_e: Electron.IpcRendererEvent, c: Command): void => cb(c)
    ipcRenderer.on('command', h)
    return () => void ipcRenderer.off('command', h)
  }
}

contextBridge.exposeInMainWorld('camtoys', api)
