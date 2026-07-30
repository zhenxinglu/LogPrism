import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openLogFile: () => Promise<{ filePath: string; content: string; recentFiles: string[] } | null>
      getLastFile: () => Promise<{ filePath: string | null; content: string | null; recentFiles: string[] } | null>
      openFileByPath: (
        filePath: string
      ) => Promise<{ success: boolean; filePath?: string; content?: string; recentFiles?: string[]; error?: string }>
      getRecentFiles: () => Promise<string[]>
      clearRecentFiles: () => Promise<boolean>
      onLogFileChanged: (callback: (content: string) => void) => () => void
      getSettings: () => Promise<any>
      saveSettings: (settings: any) => Promise<boolean>
      checkForUpdates: () => Promise<any>
      downloadUpdate: () => Promise<any>
      quitAndInstall: () => Promise<any>
      onUpdaterEvent: (channel: string, callback: (data: any) => void) => () => void
      getAppVersion: () => Promise<string>
    }
  }
}
