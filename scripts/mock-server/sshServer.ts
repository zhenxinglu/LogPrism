import ssh2Pkg from 'ssh2'
import type { ServerChannel, Session } from 'ssh2'
const { Server } = ssh2Pkg
import { generateKeyPairSync } from 'crypto'
import { constants, existsSync, statSync, readFileSync } from 'fs'
import { posix as pathPosix } from 'path'
import { generateBurstLogs } from './generator.ts'

export interface SshServerOptions {
  port?: number
  username?: string
  password?: string
  initialHistoryCount?: number
  logFileName?: string
  localFilePath?: string
}

interface VirtualItem {
  isDir: boolean
  size: number
  mtime: number
}

const STATUS_CODE = {
  OK: 0,
  EOF: 1,
  NO_SUCH_FILE: 2,
  PERMISSION_DENIED: 3,
  FAILURE: 4,
  BAD_MESSAGE: 5,
  NO_CONNECTION: 6,
  CONNECTION_LOST: 7,
  OP_UNSUPPORTED: 8
}

export class MockSshServer {
  private server: Server | null = null
  private activeStreams: Set<ServerChannel> = new Set()
  private clientCount = 0
  public readonly port: number
  public readonly username: string
  public readonly password: string
  private initialHistoryCount: number
  public readonly logFileName: string
  public readonly localFilePath?: string
  private virtualFs: Map<string, VirtualItem> = new Map()

  constructor(options: SshServerOptions = {}) {
    this.port = options.port ?? 2222
    this.username = options.username ?? 'test'
    this.password = options.password ?? 'password123'
    this.initialHistoryCount = options.initialHistoryCount ?? 50
    this.logFileName = options.logFileName || 'dynamic.log'
    this.localFilePath = options.localFilePath
    this.initVirtualFs()
  }

  /**
   * Initialize in-memory virtual filesystem tree for SFTP browsing
   */
  private initVirtualFs(): void {
    const now = Date.now()

    // Standard directories
    const dirs = [
      '/',
      '/var',
      '/var/log',
      '/var/log/nginx',
      '/var/log/redis',
      '/var/tmp',
      '/var/run',
      '/var/cache',
      '/home',
      '/home/test',
      '/tmp',
      '/etc',
      '/etc/nginx'
    ]
    for (const d of dirs) {
      this.virtualFs.set(d, { isDir: true, size: 4096, mtime: now })
    }

    // Standard simulated log and configuration files
    const files: [string, number, number][] = [
      ['/var/log/app.log', 1048576, now - 1800000],
      ['/var/log/syslog', 245890, now - 3600000],
      ['/var/log/error.log', 45120, now - 7200000],
      ['/var/log/auth.log', 89450, now - 14400000],
      ['/var/log/daemon.log', 154200, now - 28800000],
      ['/var/log/dpkg.log', 67320, now - 86400000],
      ['/var/log/nginx/access.log', 452100, now - 600000],
      ['/var/log/nginx/error.log', 14200, now - 1200000],
      ['/var/log/redis/redis.log', 88400, now - 2400000],
      ['/home/test/app.log', 512000, now - 1800000],
      ['/home/test/mock.log', 256000, now - 3600000],
      ['/tmp/debug.log', 128000, now - 900000],
      ['/etc/hosts', 420, now - 86400000 * 30],
      ['/etc/nginx/nginx.conf', 1850, now - 86400000 * 15]
    ]

    for (const [filePath, size, mtime] of files) {
      this.virtualFs.set(filePath, { isDir: false, size, mtime })
    }

    // Default dynamic log file matching simulator generator
    const dynamicPath = `/var/log/${this.logFileName}`
    this.virtualFs.set(dynamicPath, { isDir: false, size: 524288, mtime: now })
  }

  /**
   * Normalize remote path for POSIX-compliant SFTP navigation
   */
  public normalizeRemotePath(p?: string): string {
    if (!p || p === '.' || p === '~') return '/var/log'
    let norm = p.replace(/\\/g, '/').replace(/\/+/g, '/')
    norm = pathPosix.normalize(norm)
    if (norm.length > 1 && norm.endsWith('/')) {
      norm = norm.slice(0, -1)
    }
    return norm.startsWith('/') ? norm : '/' + norm
  }

  /**
   * Retrieve virtual filesystem item metadata
   */
  public getVirtualItem(normPath: string): VirtualItem | undefined {
    const item = this.virtualFs.get(normPath)
    if (item && !item.isDir && this.localFilePath && normPath === `/var/log/${this.logFileName}`) {
      if (existsSync(this.localFilePath)) {
        try {
          const stats = statSync(this.localFilePath)
          return { isDir: false, size: stats.size, mtime: stats.mtimeMs }
        } catch {
          return item
        }
      }
    }
    return item
  }

  /**
   * Get formatted entries for directory listing
   */
  public getDirectoryEntries(dirPath: string): any[] {
    const normDir = this.normalizeRemotePath(dirPath)
    const results: any[] = []
    const nowSec = Math.floor(Date.now() / 1000)

    // Current directory .
    results.push({
      filename: '.',
      longname: 'drwxr-xr-x 1 test test 4096 Oct 04 12:00 .',
      attrs: {
        mode: constants.S_IFDIR | 0o755,
        size: 4096,
        uid: 1000,
        gid: 1000,
        atime: nowSec,
        mtime: nowSec
      }
    })

    // Parent directory ..
    results.push({
      filename: '..',
      longname: 'drwxr-xr-x 1 test test 4096 Oct 04 12:00 ..',
      attrs: {
        mode: constants.S_IFDIR | 0o755,
        size: 4096,
        uid: 1000,
        gid: 1000,
        atime: nowSec,
        mtime: nowSec
      }
    })

    const children: any[] = []

    for (const [fullPath] of this.virtualFs.entries()) {
      if (fullPath === normDir) continue
      const parent = pathPosix.dirname(fullPath)
      if (parent === normDir) {
        const item = this.getVirtualItem(fullPath)!
        const name = pathPosix.basename(fullPath)
        const isDir = item.isDir
        const mode = isDir ? constants.S_IFDIR | 0o755 : constants.S_IFREG | 0o644
        const size = isDir ? 4096 : item.size
        const mtimeSec = Math.floor(item.mtime / 1000)
        const permStr = isDir ? 'drwxr-xr-x' : '-rw-r--r--'
        children.push({
          filename: name,
          isDir,
          longname: `${permStr} 1 test test ${size} Oct 04 12:00 ${name}`,
          attrs: {
            mode,
            size,
            uid: 1000,
            gid: 1000,
            atime: mtimeSec,
            mtime: mtimeSec
          }
        })
      }
    }

    children.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1
      if (!a.isDir && b.isDir) return 1
      return a.filename.localeCompare(b.filename)
    })

    return [...results, ...children]
  }

  /**
   * Read file content buffer for SFTP download requests
   */
  public readVirtualFileBuffer(normPath: string): Buffer {
    if (this.localFilePath && normPath === `/var/log/${this.logFileName}` && existsSync(this.localFilePath)) {
      try {
        return readFileSync(this.localFilePath)
      } catch {
        // fallback to generated logs
      }
    }
    const sampleLogs = generateBurstLogs(60, 0.15)
    return Buffer.from(sampleLogs.join('\n') + '\n', 'utf-8')
  }

  /**
   * Attach SFTP protocol handlers to active SFTP session stream
   */
  private setupSftpHandlers(sftp: any): void {
    const openHandles = new Map<number, any>()
    let nextHandleId = 1

    const onStat = (reqid: number, targetPath: string): void => {
      const norm = this.normalizeRemotePath(targetPath)
      const item = this.getVirtualItem(norm)
      if (!item) {
        return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE)
      }
      const mtimeSec = Math.floor(item.mtime / 1000)
      sftp.attrs(reqid, {
        mode: item.isDir ? constants.S_IFDIR | 0o755 : constants.S_IFREG | 0o644,
        size: item.isDir ? 4096 : item.size,
        uid: 1000,
        gid: 1000,
        atime: mtimeSec,
        mtime: mtimeSec
      })
    }

    sftp.on('REALPATH', (reqid: number, targetPath: string) => {
      const resolved = this.normalizeRemotePath(targetPath)
      sftp.name(reqid, [{ filename: resolved, longname: resolved, attrs: {} }])
    })

    sftp.on('OPENDIR', (reqid: number, targetPath: string) => {
      const norm = this.normalizeRemotePath(targetPath)
      const item = this.getVirtualItem(norm)
      if (!item || !item.isDir) {
        return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE)
      }
      const handleId = nextHandleId++
      const handle = Buffer.alloc(4)
      handle.writeUInt32BE(handleId, 0)
      openHandles.set(handleId, {
        type: 'dir',
        entries: this.getDirectoryEntries(norm),
        sent: false
      })
      sftp.handle(reqid, handle)
    })

    sftp.on('READDIR', (reqid: number, handle: Buffer) => {
      if (handle.length !== 4) return sftp.status(reqid, STATUS_CODE.FAILURE)
      const handleId = handle.readUInt32BE(0)
      const state = openHandles.get(handleId)
      if (!state || state.type !== 'dir') return sftp.status(reqid, STATUS_CODE.FAILURE)

      if (state.sent) {
        return sftp.status(reqid, STATUS_CODE.EOF)
      }
      state.sent = true
      sftp.name(reqid, state.entries)
    })

    sftp.on('CLOSE', (reqid: number, handle: Buffer) => {
      if (handle.length === 4) {
        openHandles.delete(handle.readUInt32BE(0))
      }
      sftp.status(reqid, STATUS_CODE.OK)
    })

    sftp.on('STAT', onStat)
    sftp.on('LSTAT', onStat)

    sftp.on('OPEN', (reqid: number, filename: string) => {
      const norm = this.normalizeRemotePath(filename)
      const item = this.getVirtualItem(norm)
      if (!item || item.isDir) {
        return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE)
      }
      const content = this.readVirtualFileBuffer(norm)
      const handleId = nextHandleId++
      const handle = Buffer.alloc(4)
      handle.writeUInt32BE(handleId, 0)
      openHandles.set(handleId, {
        type: 'file',
        content,
        mtime: item.mtime
      })
      sftp.handle(reqid, handle)
    })

    sftp.on('READ', (reqid: number, handle: Buffer, offset: number, length: number) => {
      if (handle.length !== 4) return sftp.status(reqid, STATUS_CODE.FAILURE)
      const handleId = handle.readUInt32BE(0)
      const state = openHandles.get(handleId)
      if (!state || state.type !== 'file') return sftp.status(reqid, STATUS_CODE.FAILURE)

      if (offset >= state.content.length) {
        return sftp.status(reqid, STATUS_CODE.EOF)
      }
      const chunk = state.content.subarray(offset, Math.min(state.content.length, offset + length))
      sftp.data(reqid, chunk)
    })

    sftp.on('FSTAT', (reqid: number, handle: Buffer) => {
      if (handle.length !== 4) return sftp.status(reqid, STATUS_CODE.FAILURE)
      const handleId = handle.readUInt32BE(0)
      const state = openHandles.get(handleId)
      if (!state || state.type !== 'file') return sftp.status(reqid, STATUS_CODE.FAILURE)

      const mtimeSec = Math.floor(state.mtime / 1000)
      sftp.attrs(reqid, {
        mode: constants.S_IFREG | 0o644,
        size: state.content.length,
        uid: 1000,
        gid: 1000,
        atime: mtimeSec,
        mtime: mtimeSec
      })
    })
  }

  /**
   * Start mock SSH server listening on specified port
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Generate in-memory RSA key pair dynamically
        const { privateKey } = generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
        })

        this.server = new Server({ hostKeys: [privateKey] }, (client) => {
          this.clientCount++

          client.on('authentication', (ctx) => {
            // Allow password authentication
            if (ctx.method === 'password') {
              if (
                (!this.username || ctx.username === this.username) &&
                (!this.password || ctx.password === this.password)
              ) {
                return ctx.accept()
              }
              // Also allow any valid connection for developer convenience
              return ctx.accept()
            }
            if (ctx.method === 'publickey') {
              return ctx.accept()
            }
            return ctx.reject()
          })

          client.on('ready', () => {
            client.on('session', (accept) => {
              const session: Session = accept()

              // Handle remote command execution (tail -n ... -f)
              session.on('exec', (acceptExec, _rejectExec, info) => {
                const stream: ServerChannel = acceptExec()
                this.activeStreams.add(stream)

                // If command is tail -n X -f, send initial historical log lines first
                if (info.command && info.command.includes('tail')) {
                  const initialLogs = generateBurstLogs(this.initialHistoryCount, 0.1)
                  const initialData = initialLogs
                    .map((l) => (l.endsWith('\n') ? l : l + '\n'))
                    .join('')
                  stream.write(initialData)
                }

                stream.on('close', () => {
                  this.activeStreams.delete(stream)
                })

                stream.on('error', () => {
                  this.activeStreams.delete(stream)
                })
              })

              // Handle SFTP subsystem request
              session.on('sftp', (acceptSftp) => {
                const sftp = acceptSftp()
                this.setupSftpHandlers(sftp)
              })
            })
          })

          client.on('close', () => {
            this.clientCount = Math.max(0, this.clientCount - 1)
          })

          client.on('error', (err) => {
            console.error('Mock SSH client error:', err.message)
          })
        })

        this.server.listen(this.port, '127.0.0.1', () => {
          resolve()
        })

        this.server.on('error', (err) => {
          reject(err)
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Broadcast dynamic log entry to all connected SSH tail streams
   */
  public broadcast(logEntry: string): void {
    if (this.activeStreams.size === 0) return
    const content = logEntry.endsWith('\n') ? logEntry : logEntry + '\n'
    for (const stream of this.activeStreams) {
      try {
        stream.write(content)
      } catch {
        this.activeStreams.delete(stream)
      }
    }
  }

  /**
   * Broadcast a batch of log entries to all connected SSH tail streams
   */
  public broadcastBatch(entries: string[]): void {
    if (this.activeStreams.size === 0 || entries.length === 0) return
    const chunk = entries.map((l) => (l.endsWith('\n') ? l : l + '\n')).join('')
    for (const stream of this.activeStreams) {
      try {
        stream.write(chunk)
      } catch {
        this.activeStreams.delete(stream)
      }
    }
  }

  /**
   * Get count of active connected SSH clients / tail streams
   */
  public getStats(): { clients: number; streams: number } {
    return {
      clients: this.clientCount,
      streams: this.activeStreams.size
    }
  }

  /**
   * Stop the SSH server and disconnect all active streams
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const stream of this.activeStreams) {
        try {
          stream.exit(0)
          stream.end()
        } catch {
          // ignore
        }
      }
      this.activeStreams.clear()

      if (this.server) {
        this.server.close(() => {
          this.server = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}
