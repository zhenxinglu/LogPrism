import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { readFileSync, writeFileSync, existsSync, watchFile, unwatchFile } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'

import { logIndexer } from './logIndexer'
import { sshManager, SshConfig } from './sshManager'
import { openInIdea, detectIdeaExecutable } from './ideaLauncher'

const watchedFilesMap = new Map<string, { unwatch: () => void; count: number }>()
let mainWindow: BrowserWindow | null = null

function stopWatchingFile(filePath: string): void {
  const existing = watchedFilesMap.get(filePath)
  if (existing) {
    existing.count -= 1
    if (existing.count <= 0) {
      try {
        existing.unwatch()
      } catch (e) {
        console.error('Error unwatching file:', e)
      }
      watchedFilesMap.delete(filePath)
    }
  }
}

function stopAllFileWatchers(): void {
  for (const [, item] of watchedFilesMap.entries()) {
    try {
      item.unwatch()
    } catch (e) {
      console.error('Error unwatching file:', e)
    }
  }
  watchedFilesMap.clear()
}

function safeSendToMainWindow(channel: string, ...args: any[]): void {
  try {
    if (
      mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.webContents &&
      !mainWindow.webContents.isDestroyed() &&
      !mainWindow.webContents.isCrashed()
    ) {
      mainWindow.webContents.send(channel, ...args)
    }
  } catch (err) {
    console.warn(`Failed to send ${channel} to mainWindow:`, err)
  }
}

function startWatchingFile(filePath: string, webContents: Electron.WebContents): void {
  const existing = watchedFilesMap.get(filePath)
  if (existing) {
    existing.count += 1
    return
  }

  try {
    let debounceTimer: NodeJS.Timeout | null = null

    const callback = async (curr: any, prev: any): Promise<void> => {
      if (curr.mtimeMs !== prev.mtimeMs || curr.size !== prev.size) {
        if (debounceTimer) clearTimeout(debounceTimer)

        debounceTimer = setTimeout(async () => {
          debounceTimer = null
          try {
            if (existsSync(filePath)) {
              let indexInfo = logIndexer.updateIndexOnAppend(filePath)
              if (!indexInfo) {
                indexInfo = await logIndexer.indexFile(filePath)
              }
              const content = logIndexer.readFullContentIfSmall(filePath)
              const latestIndex = indexInfo || logIndexer.getIndexInfo(filePath)

              if (!webContents || webContents.isDestroyed() || webContents.isCrashed()) {
                stopWatchingFile(filePath)
                return
              }

              try {
                webContents.send('log-file-changed', {
                  filePath,
                  content,
                  totalLines: latestIndex?.totalLines || 0,
                  fileSize: latestIndex?.fileSize || 0
                })
              } catch (sendErr) {
                console.warn(`Failed to send log-file-changed IPC for ${filePath}, stopping watcher.`, sendErr)
                stopWatchingFile(filePath)
              }
            }
          } catch (err) {
            console.error('Failed to read updated file:', err)
          }
        }, 200)
      }
    }

    watchFile(filePath, { interval: 300 }, callback)
    watchedFilesMap.set(filePath, {
      unwatch: () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        unwatchFile(filePath, callback)
      },
      count: 1
    })
  } catch (err) {
    console.error('Failed to start file watcher:', err)
  }
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    stopAllFileWatchers()
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.warn('Renderer process gone:', details)
    stopAllFileWatchers()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const configPath = join(app.getPath('userData'), 'config.json')

  function readConfig(): any {
    try {
      if (existsSync(configPath)) {
        const configContent = readFileSync(configPath, 'utf-8')
        return JSON.parse(configContent)
      }
    } catch (err) {
      console.error('Failed to read config:', err)
    }
    return {}
  }

  function writeConfig(data: any): void {
    try {
      const current = readConfig()
      const updated = { ...current, ...data }
      writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to write config:', err)
    }
  }

  function updateRecentFiles(filePath: string): string[] {
    const config = readConfig()
    const currentList: string[] = Array.isArray(config.recentFiles) ? config.recentFiles : []
    const filtered = currentList.filter((p) => p !== filePath)
    filtered.unshift(filePath)
    const updated = filtered.slice(0, 10)
    writeConfig({ lastFilePath: filePath, recentFiles: updated })
    return updated
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Read slice of lines on demand from indexed file
  ipcMain.handle(
    'read-log-lines',
    async (_event, filePath: string, startLine: number, count: number) => {
      return logIndexer.readLogLines(filePath, startLine, count)
    }
  )

  // Index log file explicitly
  ipcMain.handle('index-log-file', async (_event, filePath: string) => {
    return await logIndexer.indexFile(filePath)
  })

  // Unwatch a log file when tab closes
  ipcMain.handle('unwatch-log-file', async (_event, filePath: string) => {
    stopWatchingFile(filePath)
    return true
  })

  // Open log file dialog and read content
  ipcMain.handle('open-log-file', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open Log File',
      filters: [
        { name: 'Log Files', extensions: ['log', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    try {
      const filePath = filePaths[0]
      const indexInfo = await logIndexer.indexFile(filePath)
      const content = logIndexer.readFullContentIfSmall(filePath)
      const window = BrowserWindow.fromWebContents(event.sender)
      if (window) {
        window.setTitle(`LogPrism - ${filePath}`)
      }
      const recentFiles = updateRecentFiles(filePath)
      startWatchingFile(filePath, event.sender)
      return {
        filePath,
        content,
        totalLines: indexInfo.totalLines,
        fileSize: indexInfo.fileSize,
        recentFiles
      }
    } catch (e) {
      return null
    }
  })

  // Get last opened file path and content
  ipcMain.handle('get-last-file', async (event) => {
    try {
      const config = readConfig()
      const lastFilePath = config.lastFilePath
      const recentFiles: string[] = Array.isArray(config.recentFiles) ? config.recentFiles : []
      if (lastFilePath && existsSync(lastFilePath)) {
        const indexInfo = await logIndexer.indexFile(lastFilePath)
        const content = logIndexer.readFullContentIfSmall(lastFilePath)
        const window = BrowserWindow.fromWebContents(event.sender)
        if (window) {
          window.setTitle(`LogPrism - ${lastFilePath}`)
        }
        startWatchingFile(lastFilePath, event.sender)
        return {
          filePath: lastFilePath,
          content,
          totalLines: indexInfo.totalLines,
          fileSize: indexInfo.fileSize,
          recentFiles
        }
      }
      return { filePath: null, content: null, recentFiles }
    } catch (e) {
      console.error('Failed to load last config:', e)
    }
    return null
  })

  // Open a log file by path directly
  ipcMain.handle('open-file-by-path', async (event, filePath: string) => {
    try {
      if (!existsSync(filePath)) {
        return { success: false, error: 'File does not exist' }
      }
      const indexInfo = await logIndexer.indexFile(filePath)
      const content = logIndexer.readFullContentIfSmall(filePath)
      const window = BrowserWindow.fromWebContents(event.sender)
      if (window) {
        window.setTitle(`LogPrism - ${filePath}`)
      }
      const recentFiles = updateRecentFiles(filePath)
      startWatchingFile(filePath, event.sender)
      return {
        success: true,
        filePath,
        content,
        totalLines: indexInfo.totalLines,
        fileSize: indexInfo.fileSize,
        recentFiles
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  // Get recent files list
  ipcMain.handle('get-recent-files', async () => {
    const config = readConfig()
    return Array.isArray(config.recentFiles) ? config.recentFiles : []
  })

  // Clear recent files list
  ipcMain.handle('clear-recent-files', async () => {
    writeConfig({ recentFiles: [] })
    return true
  })

  // Get all settings configuration
  ipcMain.handle('get-settings', async () => {
    return readConfig()
  })

  // Save all settings configuration
  ipcMain.handle('save-settings', async (_event, settings) => {
    writeConfig(settings)
    return true
  })

  // SSH Remote Server IPC handlers
  ipcMain.handle('ssh:test', async (_event, config: SshConfig) => {
    return await sshManager.testConnection(config)
  })

  ipcMain.handle('ssh:list-dir', async (_event, config: SshConfig, dirPath?: string) => {
    return await sshManager.listRemoteDirectory(config, dirPath)
  })

  ipcMain.handle('ssh:connect', async (event, config: SshConfig) => {
    sshManager.connectAndTail(config, event.sender)
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      window.setTitle(
        `LogPrism - ssh://${config.username}@${config.host}:${config.port || 22}${config.remotePath}`
      )
    }
    return true
  })

  ipcMain.handle('ssh:disconnect', async () => {
    sshManager.disconnect()
    return true
  })

  ipcMain.handle('ssh:get-profiles', async () => {
    const config = readConfig()
    return Array.isArray(config.sshProfiles) ? config.sshProfiles : []
  })

  ipcMain.handle('ssh:save-profiles', async (_event, profiles: SshConfig[]) => {
    writeConfig({ sshProfiles: profiles })
    return true
  })

  // Configure auto-updater
  autoUpdater.autoDownload = false
  autoUpdater.logger = console

  autoUpdater.on('checking-for-update', () => {
    safeSendToMainWindow('updater:checking')
  })
  autoUpdater.on('update-available', (info) => {
    safeSendToMainWindow('updater:available', info)
  })
  autoUpdater.on('update-not-available', (info) => {
    safeSendToMainWindow('updater:not-available', info)
  })
  autoUpdater.on('download-progress', (progressObj) => {
    safeSendToMainWindow('updater:progress', progressObj)
  })
  autoUpdater.on('update-downloaded', (info) => {
    safeSendToMainWindow('updater:downloaded', info)
  })
  autoUpdater.on('error', (err) => {
    console.error('AutoUpdater error:', err)
    const rawMsg = err == null ? 'Unknown error' : err.message || String(err)
    let userMsg = rawMsg

    // Friendly error handling for missing latest.yml (404)
    if (rawMsg.includes('Cannot find latest.yml') || rawMsg.includes('404')) {
      userMsg =
        'No release update metadata (latest.yml) found on GitHub. Please ensure latest.yml is uploaded to the GitHub Release artifacts.'
    }

    safeSendToMainWindow('updater:error', userMsg)
  })

  // Updater IPC handlers
  ipcMain.handle('updater:check', async () => {
    try {
      if (is.dev || !app.isPackaged) {
        console.log('App is in dev mode; updater check skipped.')
        safeSendToMainWindow('updater:not-available')
        return { isDev: true, message: 'Running in development mode. Auto-update is disabled.' }
      }
      const result = await autoUpdater.checkForUpdates()
      if (!result) {
        safeSendToMainWindow('updater:not-available')
      }
      return result
    } catch (err) {
      console.error('Error checking updates:', err)
      const rawMsg = err == null ? 'Unknown error' : err instanceof Error ? err.message : String(err)
      let userMsg = rawMsg
      if (rawMsg.includes('Cannot find latest.yml') || rawMsg.includes('404')) {
        userMsg =
          'No release update metadata (latest.yml) found on GitHub. Please ensure latest.yml is uploaded to GitHub Release artifacts.'
      }
      safeSendToMainWindow('updater:error', userMsg)
      return { error: true, message: userMsg }
    }
  })

  ipcMain.handle('updater:download', async () => {
    try {
      return await autoUpdater.downloadUpdate()
    } catch (err) {
      console.error('Error starting download:', err)
      return { error: true, message: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('updater:install', async () => {
    autoUpdater.quitAndInstall()
  })

  // Get app version
  ipcMain.handle('get-app-version', () => app.getVersion())

  // IntelliJ IDEA Integration handlers
  ipcMain.handle(
    'open-in-idea',
    async (
      _event,
      { fileName, className }: { fileName?: string; className?: string } = {}
    ) => {
      const config = readConfig()
      return await openInIdea(
        config.sourceRootPath,
        config.ideaExecutablePath,
        fileName,
        className
      )
    }
  )

  ipcMain.handle('select-source-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Source Code Root Directory',
      properties: ['openDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    const selectedPath = filePaths[0]
    writeConfig({ sourceRootPath: selectedPath })
    return selectedPath
  })

  ipcMain.handle('select-idea-executable', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select IntelliJ IDEA Executable (idea64.exe)',
      filters: [
        { name: 'Executables', extensions: ['exe', 'cmd', 'bat'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    const selectedPath = filePaths[0]
    writeConfig({ ideaExecutablePath: selectedPath })
    return selectedPath
  })

  ipcMain.handle('get-idea-config', () => {
    const config = readConfig()
    return {
      sourceRootPath: config.sourceRootPath || null,
      ideaExecutablePath: config.ideaExecutablePath || null
    }
  })

  ipcMain.handle('set-idea-config', (_event, data: { sourceRootPath?: string; ideaExecutablePath?: string }) => {
    writeConfig(data)
    return true
  })

  ipcMain.handle('detect-idea-executable', () => {
    const config = readConfig()
    const detected = detectIdeaExecutable(config.ideaExecutablePath)
    if (detected && !config.ideaExecutablePath) {
      writeConfig({ ideaExecutablePath: detected })
    }
    return detected
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
