import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openLogFile: () => Promise<{
        filePath: string
        content: string | null
        totalLines: number
        fileSize: number
        recentFiles: string[]
      } | null>
      getLastFile: () => Promise<{
        filePath: string | null
        content: string | null
        totalLines?: number
        fileSize?: number
        recentFiles: string[]
      } | null>
      openFileByPath: (filePath: string) => Promise<{
        success: boolean
        filePath?: string
        content?: string | null
        totalLines?: number
        fileSize?: number
        recentFiles?: string[]
        error?: string
      }>
      readLogLines: (
        filePath: string,
        startLine: number,
        count: number
      ) => Promise<{ lines: string[]; startLine: number; totalLines: number }>
      indexLogFile: (
        filePath: string
      ) => Promise<{ filePath: string; fileSize: number; totalLines: number }>
      getRecentFiles: () => Promise<string[]>
      clearRecentFiles: () => Promise<boolean>
      onLogFileChanged: (
        callback: (
          data:
            | { filePath: string; content: string | null; totalLines: number; fileSize: number }
            | string
        ) => void
      ) => () => void
      getSettings: () => Promise<any>
      saveSettings: (settings: any) => Promise<boolean>
      checkForUpdates: () => Promise<any>
      downloadUpdate: () => Promise<any>
      quitAndInstall: () => Promise<any>
      onUpdaterEvent: (channel: string, callback: (data: any) => void) => () => void
      getAppVersion: () => Promise<string>
      testRemoteConnection: (config: any) => Promise<{ success: boolean; message?: string }>
      listRemoteDirectory: (
        config: any,
        dirPath?: string
      ) => Promise<{
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
      }>
      connectRemoteLog: (config: any) => Promise<boolean>
      disconnectRemoteLog: () => Promise<boolean>
      getRemoteProfiles: () => Promise<any[]>
      saveRemoteProfiles: (profiles: any[]) => Promise<boolean>
      onRemoteLogData: (callback: (data: { data: string }) => void) => () => void
      onRemoteLogStatus: (
        callback: (data: {
          status: 'connecting' | 'connected' | 'disconnected' | 'error'
          message?: string
          host?: string
          remotePath?: string
        }) => void
      ) => () => void
      openInIdea: (params?: {
        fileName?: string
        className?: string
      }) => Promise<{
        success: boolean
        filePath?: string
        fileFound?: boolean
        reason?: 'NO_SOURCE_ROOT' | 'INVALID_SOURCE_ROOT' | 'FILE_NOT_FOUND' | 'SHELL_ERROR'
        message?: string
      }>
      selectSourceDirectory: () => Promise<string | null>
      selectIdeaExecutable: () => Promise<string | null>
      getIdeaConfig: () => Promise<{ sourceRootPath: string | null; ideaExecutablePath: string | null }>
      setIdeaConfig: (data: { sourceRootPath?: string; ideaExecutablePath?: string }) => Promise<boolean>
      detectIdeaExecutable: () => Promise<string | null>
    }
  }
}
