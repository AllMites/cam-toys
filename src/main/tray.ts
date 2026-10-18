import { Tray, Menu, nativeImage, app } from 'electron'
import trayIcon from '../../resources/tray.png?asset'

let tray: Tray | null = null // module-level so it isn't garbage-collected

export function createTray(show: () => void): Tray {
  tray = new Tray(nativeImage.createFromPath(trayIcon))
  tray.setToolTip('cam-toys')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show cam-toys', click: show },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  )
  tray.on('click', show)
  return tray
}
