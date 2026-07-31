import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  openLogFile: async (): Promise<{
    filePath: string
    content: string | null
    totalLines: number
    fileSize: number
    recentFiles: string[]
  } | null> => {
    return ipcRenderer.invoke('open-log-file')
  },
  getLastFile: async (): Promise<{
    filePath: string | null
    content: string | null
    totalLines?: number
    fileSize?: number
    recentFiles: string[]
  } | null> => {
    return ipcRenderer.invoke('get-last-file')
  },
  openFileByPath: async (
    filePath: string
  ): Promise<{
    success: boolean
    filePath?: string
    content?: string | null
    totalLines?: number
    fileSize?: number
    recentFiles?: string[]
    error?: string
  }> => {
    return ipcRenderer.invoke('open-file-by-path', filePath)
  },
  readLogLines: async (
    filePath: string,
    startLine: number,
    count: number
  ): Promise<{ lines: string[]; startLine: number; totalLines: number }> => {
    return ipcRenderer.invoke('read-log-lines', filePath, startLine, count)
  },
  indexLogFile: async (
    filePath: string
  ): Promise<{ filePath: string; fileSize: number; totalLines: number }> => {
    return ipcRenderer.invoke('index-log-file', filePath)
  },
  getRecentFiles: async (): Promise<string[]> => {
    return ipcRenderer.invoke('get-recent-files')
  },
  clearRecentFiles: async (): Promise<boolean> => {
    return ipcRenderer.invoke('clear-recent-files')
  },
  onLogFileChanged: (
    callback: (
      data:
        | { filePath: string; content: string | null; totalLines: number; fileSize: number }
        | string
    ) => void
  ): (() => void) => {
    const listener = (_event: any, data: any): void => callback(data)
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
  },
  getAppVersion: async (): Promise<string> => {
    return ipcRenderer.invoke('get-app-version')
  },
  testRemoteConnection: async (config: any): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('ssh:test', config)
  },
  listRemoteDirectory: async (
    config: any,
    dirPath?: string
  ): Promise<{
    success: boolean
    currentPath?: string
    items?: Array<{
      name: string
      path: string
      isDirectory: boolean
      size: number
      mtime: number
    }>
    error?: string
  }> => {
    return ipcRenderer.invoke('ssh:list-dir', config, dirPath)
  },
  connectRemoteLog: async (config: any): Promise<boolean> => {
    return ipcRenderer.invoke('ssh:connect', config)
  },
  disconnectRemoteLog: async (): Promise<boolean> => {
    return ipcRenderer.invoke('ssh:disconnect')
  },
  getRemoteProfiles: async (): Promise<any[]> => {
    return ipcRenderer.invoke('ssh:get-profiles')
  },
  saveRemoteProfiles: async (profiles: any[]): Promise<boolean> => {
    return ipcRenderer.invoke('ssh:save-profiles', profiles)
  },
  onRemoteLogData: (callback: (data: { data: string }) => void): (() => void) => {
    const listener = (_event: any, data: any): void => callback(data)
    ipcRenderer.on('remote-log-data', listener)
    return (): void => {
      ipcRenderer.off('remote-log-data', listener)
    }
  },
  onRemoteLogStatus: (
    callback: (data: {
      status: 'connecting' | 'connected' | 'disconnected' | 'error'
      message?: string
      host?: string
      remotePath?: string
    }) => void
  ): (() => void) => {
    const listener = (_event: any, data: any): void => callback(data)
    ipcRenderer.on('remote-log-status', listener)
    return (): void => {
      ipcRenderer.off('remote-log-status', listener)
    }
  },
  openInIdea: async (params?: {
    fileName?: string
    className?: string
  }): Promise<{
    success: boolean
    filePath?: string
    reason?: 'NO_SOURCE_ROOT' | 'INVALID_SOURCE_ROOT' | 'FILE_NOT_FOUND' | 'SHELL_ERROR'
    message?: string
  }> => {
    return ipcRenderer.invoke('open-in-idea', params)
  },
  selectSourceDirectory: async (): Promise<string | null> => {
    return ipcRenderer.invoke('select-source-directory')
  },
  selectIdeaExecutable: async (): Promise<string | null> => {
    return ipcRenderer.invoke('select-idea-executable')
  },
  getIdeaConfig: async (): Promise<{ sourceRootPath: string | null; ideaExecutablePath: string | null }> => {
    return ipcRenderer.invoke('get-idea-config')
  },
  setIdeaConfig: async (data: { sourceRootPath?: string; ideaExecutablePath?: string }): Promise<boolean> => {
    return ipcRenderer.invoke('set-idea-config', data)
  },
  detectIdeaExecutable: async (): Promise<string | null> => {
    return ipcRenderer.invoke('detect-idea-executable')
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
