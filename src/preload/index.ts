import { contextBridge, ipcRenderer } from 'electron'
import type { CamtoysApi } from '../engine/types'
import { vcam } from './vcam'

const api: CamtoysApi = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch)
  },
  vcam,
  quit: () => ipcRenderer.send('app:quit')
}

contextBridge.exposeInMainWorld('camtoys', api)
