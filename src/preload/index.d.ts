import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openLogFile: () => Promise<string | null>
      getLastFile: () => Promise<{ filePath: string; content: string } | null>
      onLogFileChanged: (callback: (content: string) => void) => () => void
      getSettings: () => Promise<any>
      saveSettings: (settings: any) => Promise<boolean>
    }
  }
}
