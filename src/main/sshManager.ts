import { Client, ConnectConfig } from 'ssh2'
import { WebContents } from 'electron'

export interface SshConfig {
  id?: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'privateKey'
  password?: string
  privateKey?: string
  passphrase?: string
  remotePath: string
  tailLines?: number
}

export interface RemoteFileItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
  mtime: number
}

export interface SshStatusEvent {
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  message?: string
  host?: string
  remotePath?: string
}

class SshManager {
  private client: Client | null = null
  private stream: any = null
  private activeConfig: SshConfig | null = null
  private isIntentionallyDisconnected = false

  /**
   * Build ssh2 connect configuration object
   */
  private buildConnectConfig(config: SshConfig): ConnectConfig {
    const connConfig: ConnectConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: 10000
    }

    if (config.authType === 'password') {
      connConfig.password = config.password || ''
    } else if (config.authType === 'privateKey') {
      connConfig.privateKey = config.privateKey || ''
      if (config.passphrase) {
        connConfig.passphrase = config.passphrase
      }
    }

    return connConfig
  }

  /**
   * Test SSH connection with provided configuration
   */
  public async testConnection(config: SshConfig): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      const testClient = new Client()
      let isSettled = false

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true
          try {
            testClient.end()
          } catch {
            // ignore
          }
          resolve({ success: false, message: 'Connection timed out after 10 seconds' })
        }
      }, 10000)

      testClient
        .on('ready', () => {
          if (!isSettled) {
            isSettled = true
            clearTimeout(timer)
            testClient.end()
            resolve({ success: true, message: 'SSH Connection successful!' })
          }
        })
        .on('error', (err: Error) => {
          if (!isSettled) {
            isSettled = true
            clearTimeout(timer)
            resolve({ success: false, message: err.message || String(err) })
          }
        })
        .connect(this.buildConnectConfig(config))
    })
  }

  /**
   * Connect to SSH server and start tailing the specified log file
   */
  public connectAndTail(config: SshConfig, webContents: WebContents): void {
    this.disconnect()

    this.activeConfig = config
    this.isIntentionallyDisconnected = false
    this.client = new Client()

    const emitStatus = (event: SshStatusEvent): void => {
      try {
        if (!webContents.isDestroyed()) {
          webContents.send('remote-log-status', event)
        }
      } catch (err) {
        console.error('Failed to send SSH status:', err)
      }
    }

    emitStatus({
      status: 'connecting',
      host: config.host,
      remotePath: config.remotePath
    })

    this.client
      .on('ready', () => {
        emitStatus({
          status: 'connected',
          host: config.host,
          remotePath: config.remotePath
        })

        const tailCount = config.tailLines && config.tailLines > 0 ? config.tailLines : 1000
        const escapedPath = config.remotePath.replace(/'/g, `'\\''`)
        const command = `tail -n ${tailCount} -f '${escapedPath}'`

        this.client?.exec(command, (err, stream) => {
          if (err) {
            emitStatus({
              status: 'error',
              message: `Failed to execute tail command: ${err.message}`
            })
            this.disconnect()
            return
          }

          this.stream = stream

          stream.on('data', (chunk: Buffer) => {
            try {
              if (!webContents.isDestroyed()) {
                webContents.send('remote-log-data', {
                  data: chunk.toString('utf-8')
                })
              }
            } catch (error) {
              console.error('Failed to send remote log chunk:', error)
            }
          })

          stream.stderr.on('data', (chunk: Buffer) => {
            const stderrStr = chunk.toString('utf-8')
            console.warn('SSH tail stderr:', stderrStr)
            try {
              if (!webContents.isDestroyed()) {
                webContents.send('remote-log-data', {
                  data: stderrStr
                })
              }
            } catch (error) {
              console.error('Failed to send remote log stderr chunk:', error)
            }
          })

          stream.on('close', (code: number, signal: string) => {
            if (!this.isIntentionallyDisconnected) {
              emitStatus({
                status: 'disconnected',
                message: `Remote stream closed (code: ${code}, signal: ${signal})`
              })
            }
          })
        })
      })
      .on('error', (err: Error) => {
        if (!this.isIntentionallyDisconnected) {
          emitStatus({
            status: 'error',
            message: err.message || 'SSH connection error'
          })
        }
      })
      .on('close', () => {
        if (!this.isIntentionallyDisconnected) {
          emitStatus({
            status: 'disconnected',
            message: 'SSH connection closed'
          })
        }
      })
      .connect(this.buildConnectConfig(config))
  }

  /**
   * Disconnect active SSH session
   */
  public disconnect(): void {
    this.isIntentionallyDisconnected = true

    if (this.stream) {
      try {
        this.stream.close()
      } catch {
        // ignore
      }
      this.stream = null
    }

    if (this.client) {
      try {
        this.client.end()
      } catch {
        // ignore
      }
      this.client = null
    }

    this.activeConfig = null
  }

  /**
   * List files and directories on remote server using SFTP
   */
  public async listRemoteDirectory(
    config: SshConfig,
    dirPath?: string
  ): Promise<{ success: boolean; currentPath?: string; items?: RemoteFileItem[]; error?: string }> {
    return new Promise((resolve) => {
      const conn = new Client()
      let isSettled = false

      const cleanup = (): void => {
        try {
          conn.end()
        } catch {
          // ignore
        }
      }

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true
          cleanup()
          resolve({ success: false, error: 'Directory listing timed out after 10 seconds' })
        }
      }, 10000)

      conn
        .on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) {
              if (!isSettled) {
                isSettled = true
                clearTimeout(timer)
                cleanup()
                resolve({ success: false, error: `SFTP initialization failed: ${err.message}` })
              }
              return
            }

            const initialTarget = dirPath && dirPath.trim() ? dirPath.trim() : '/var/log'

            const readPathWithFallback = (target: string, fallbackTried: boolean): void => {
              sftp.realpath(target, (realErr, resolvedPath) => {
                const workingPath = realErr || !resolvedPath ? target : resolvedPath

                sftp.readdir(workingPath, (readErr, list) => {
                  if (readErr) {
                    if (!fallbackTried && target !== '/') {
                      readPathWithFallback('/', true)
                      return
                    }
                    if (!isSettled) {
                      isSettled = true
                      clearTimeout(timer)
                      cleanup()
                      resolve({
                        success: false,
                        error: readErr.message || 'Failed to read directory'
                      })
                    }
                    return
                  }

                  if (!isSettled) {
                    isSettled = true
                    clearTimeout(timer)
                    cleanup()

                    const items: RemoteFileItem[] = list
                      .filter((entry) => entry.filename !== '.' && entry.filename !== '..')
                      .map((entry) => {
                        const isDir =
                          (entry.attrs.mode & 0o170000) === 0o040000 ||
                          (entry.longname && entry.longname.startsWith('d'))
                        const normalizedWorkingPath = workingPath === '/' ? '' : workingPath
                        const itemPath = `${normalizedWorkingPath}/${entry.filename}`
                        return {
                          name: entry.filename,
                          path: itemPath,
                          isDirectory: Boolean(isDir),
                          size: entry.attrs.size || 0,
                          mtime: (entry.attrs.mtime || 0) * 1000
                        }
                      })
                      .sort((a, b) => {
                        if (a.isDirectory && !b.isDirectory) return -1
                        if (!a.isDirectory && b.isDirectory) return 1
                        return a.name.localeCompare(b.name)
                      })

                    resolve({
                      success: true,
                      currentPath: workingPath,
                      items
                    })
                  }
                })
              })
            }

            readPathWithFallback(initialTarget, false)
          })
        })
        .on('error', (err: Error) => {
          if (!isSettled) {
            isSettled = true
            clearTimeout(timer)
            cleanup()
            resolve({ success: false, error: err.message || String(err) })
          }
        })
        .connect(this.buildConnectConfig(config))
    })
  }

  /**
   * Get active SSH config
   */
  public getActiveConfig(): SshConfig | null {
    return this.activeConfig
  }
}

export const sshManager = new SshManager()
