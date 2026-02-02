// import { contextBridge } from 'electron'
// import { electronAPI } from '@electron-toolkit/preload'

console.log('Preload script loaded')

// // Custom APIs for renderer
// const api = {}

// // Use `contextBridge` APIs to expose Electron APIs to
// // renderer only if context isolation is enabled, otherwise
// // just add to the DOM global.
// if (process.contextIsolated) {
//     try {
//         contextBridge.exposeInMainWorld('electron', electronAPI)
//         contextBridge.exposeInMainWorld('api', api)
//     } catch (error) {
//         console.error(error)
//     }
// } else {
//     // @ts-ignore (define in d.ts)
//     window.electron = electronAPI
//     // @ts-ignore (define in d.ts)
//     window.api = api
// }

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) =>
      ipcRenderer.invoke(channel, ...args),
    on: (channel: string, callback: (...args: any[]) => void) =>
      ipcRenderer.on(channel, (_, ...args) => callback(...args)),
    off: (channel: string, callback: (...args: any[]) => void) =>
      ipcRenderer.removeListener(channel, callback),
  },
})

