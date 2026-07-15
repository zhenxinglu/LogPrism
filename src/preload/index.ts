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
  },
  checkForUpdates: async (): Promise<any> => {
    return ipcRenderer.invoke('updater:check')
  },
  downloadUpdate: async (): Promise<any> => {
    return ipcRenderer.invoke('updater:download')
  },
  quitAndInstall: async (): Promise<any> => {
    return ipcRenderer.invoke('updater:install')
  },
  onUpdaterEvent: (channel: string, callback: (data: any) => void): (() => void) => {
    const validChannels = [
      'updater:checking',
      'updater:available',
      'updater:not-available',
      'updater:progress',
      'updater:downloaded',
      'updater:error'
    ]
    if (validChannels.includes(channel)) {
      const listener = (_event: any, data: any): void => callback(data)
      ipcRenderer.on(channel, listener)
      return (): void => {
        ipcRenderer.off(channel, listener)
      }
    }
    return (): void => {}
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
