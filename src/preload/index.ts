import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  openLogFile: async (): Promise<string | null> => {
    return ipcRenderer.invoke('open-log-file')
  },
  getLastFile: async (): Promise<{ filePath: string; content: string } | null> => {
    return ipcRenderer.invoke('get-last-file')
  },
  onLogFileChanged: (callback: (content: string) => void): (() => void) => {
    const listener = (_event: any, content: string): void => callback(content)
    ipcRenderer.on('log-file-changed', listener)
    return (): void => {
      ipcRenderer.off('log-file-changed', listener)
    }
  },
  getSettings: async (): Promise<any> => {
    return ipcRenderer.invoke('get-settings')
  },
  saveSettings: async (settings: any): Promise<boolean> => {
    return ipcRenderer.invoke('save-settings', settings)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
