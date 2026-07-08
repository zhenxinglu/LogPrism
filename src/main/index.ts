import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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

  // 打开日志文件对话框并读取内容
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
      const content = readFileSync(filePaths[0], 'utf-8')
      const window = BrowserWindow.fromWebContents(event.sender)
      if (window) {
        window.setTitle(`Log Viewer - ${filePaths[0]}`)
      }
      try {
        writeFileSync(configPath, JSON.stringify({ lastFilePath: filePaths[0] }), 'utf-8')
      } catch (err) {
        console.error('Failed to save config:', err)
      }
      return content
    } catch (e) {
      return null
    }
  })

  // 获取上次打开的文件路径和内容
  ipcMain.handle('get-last-file', async (event) => {
    try {
      if (existsSync(configPath)) {
        const configContent = readFileSync(configPath, 'utf-8')
        const { lastFilePath } = JSON.parse(configContent)
        if (lastFilePath && existsSync(lastFilePath)) {
          const content = readFileSync(lastFilePath, 'utf-8')
          const window = BrowserWindow.fromWebContents(event.sender)
          if (window) {
            window.setTitle(`Log Viewer - ${lastFilePath}`)
          }
          return { filePath: lastFilePath, content }
        }
      }
    } catch (e) {
      console.error('Failed to load last config:', e)
    }
    return null
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
