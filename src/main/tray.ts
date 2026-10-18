import { Tray, Menu, nativeImage, app } from 'electron'
import trayIcon from '../../resources/tray.png?asset'
import type { Command, PresetInfo } from '../engine/types'

let tray: Tray | null = null // module-level so it isn't garbage-collected
let show: () => void = () => {}
let send: (c: Command) => void = () => {}
let presets: PresetInfo[] = []
let cameraOn = true

function rebuild(): void {
  tray?.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show cam-toys', click: show },
      { type: 'separator' },
      {
        label: 'Camera on', type: 'checkbox', checked: cameraOn,
        click: () => { cameraOn = !cameraOn; send({ type: 'camera' }); rebuild() }
      },
      {
        label: 'Presets', enabled: presets.length > 0,
        submenu: presets.map((p) => ({ label: `${p.icon}  ${p.name}`, click: () => send({ type: 'preset', id: p.id }) }))
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  )
}

export function createTray(onShow: () => void, onCommand: (c: Command) => void): Tray {
  show = onShow
  send = onCommand
  tray = new Tray(nativeImage.createFromPath(trayIcon))
  tray.setToolTip('cam-toys')
  tray.on('click', show)
  rebuild()
  return tray
}

// The UI owns the preset list and sends it once on boot.
export function setTrayPresets(list: PresetInfo[]): void {
  presets = list.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string').map(({ id, name, icon }) => ({ id, name, icon: String(icon ?? '') }))
  rebuild()
}
