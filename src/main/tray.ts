import { Tray, Menu, app, BrowserWindow } from 'electron'
import icon from '../../resources/icon.png?asset'

let tray: Tray | null = null

export function initTray(mainWindow: BrowserWindow) {
    if (tray) return

    const iconPath = icon

    tray = new Tray(iconPath)

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open SentinelTrack',
            click: () => {
                mainWindow.show()
                mainWindow.focus()
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                // Find a way to signal force quit
                (app as any).isQuitting = true
                app.quit()
            }
        }
    ])

    tray.setToolTip('SentinelTrack')
    tray.setContextMenu(contextMenu)

    tray.on('double-click', () => {
        mainWindow.show()
        mainWindow.focus()
    })
}
