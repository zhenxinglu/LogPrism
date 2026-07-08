import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openLogFile: () => Promise<string | null>
      getLastFile: () => Promise<{ filePath: string; content: string } | null>
    }
  }
}
