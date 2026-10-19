import { basename } from 'path'
import { LocalLogWriter } from './localWriter.ts'
import { MockSshServer } from './sshServer.ts'
import { Dashboard } from './dashboard.ts'
import type { DashboardMetrics } from './dashboard.ts'
import { generateNextLog, generateExceptionLog, generateBurstLogs } from './generator.ts'

interface CliArgs {
  port: number
  rate: number // logs per second
  filePath: string
  enableSsh: boolean
  enableLocal: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = {
    port: 2222,
    rate: 5,
    filePath: 'test-logs/dynamic.log',
    enableSsh: true,
    enableLocal: true
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--port' && args[i + 1]) {
      result.port = parseInt(args[++i], 10) || 2222
    } else if (arg === '--rate' && args[i + 1]) {
      result.rate = Math.max(1, parseInt(args[++i], 10) || 5)
    } else if (arg === '--file' && args[i + 1]) {
      result.filePath = args[++i]
    } else if (arg === '--no-ssh') {
      result.enableSsh = false
    } else if (arg === '--no-local') {
      result.enableLocal = false
    }
  }

  return result
}

async function main(): Promise<void> {
  const config = parseArgs()

  let isRunning = true
  let currentRate = config.rate
  let totalGenerated = 0

  const localWriter = config.enableLocal ? new LocalLogWriter(config.filePath) : null
  const logFileName = config.filePath ? basename(config.filePath) : 'dynamic.log'
  const sshServer = config.enableSsh
    ? new MockSshServer({
        port: config.port,
        logFileName,
        localFilePath: config.enableLocal ? config.filePath : undefined
      })
    : null

  if (sshServer) {
    try {
      await sshServer.start()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Failed to bind Mock SSH Server on port ${config.port}:`, msg)
      process.exit(1)
    }
  }

  let timer: NodeJS.Timeout | null = null

  const emitLog = (logEntry: string): void => {
    if (localWriter) {
      localWriter.append(logEntry)
    }
    if (sshServer) {
      sshServer.broadcast(logEntry)
    }
    totalGenerated++
  }

  const emitBatch = (entries: string[]): void => {
    if (localWriter) {
      localWriter.appendBatch(entries)
    }
    if (sshServer) {
      sshServer.broadcastBatch(entries)
    }
    totalGenerated += entries.length
  }

  const resetTimer = (): void => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (!isRunning) return

    const intervalMs = Math.max(10, Math.floor(1000 / currentRate))
    timer = setInterval(() => {
      if (!isRunning) return
      const entry = generateNextLog({ errorRatio: 0.15 })
      emitLog(entry)
    }, intervalMs)
  }

  const getMetrics = (): DashboardMetrics => {
    const localStats = localWriter ? localWriter.getStats() : { size: 0, totalLines: 0 }
    const sshStats = sshServer ? sshServer.getStats() : { clients: 0, streams: 0 }

    return {
      isRunning,
      ratePerSec: currentRate,
      totalGenerated,
      localFilePath: localWriter ? localWriter.filePath : '(Disabled)',
      localFileSize: localStats.size,
      localTotalLines: localStats.totalLines,
      sshEnabled: Boolean(sshServer),
      sshPort: config.port,
      sshUser: 'test',
      sshPass: 'password123',
      sshClients: sshStats.clients,
      sshStreams: sshStats.streams
    }
  }

  const dashboard = new Dashboard(getMetrics, {
    onBurst: () => {
      const burstLogs = generateBurstLogs(500, 0.5)
      emitBatch(burstLogs)
      dashboard.setMessage('Triggered traffic burst: +500 lines generated with 50% error rate!')
    },
    onInjectException: () => {
      const excLog = generateExceptionLog()
      emitLog(excLog)
      dashboard.setMessage('Injected multi-line exception stack trace into stream.')
    },
    onRotate: () => {
      if (localWriter) {
        const rotated = localWriter.rotate()
        dashboard.setMessage(`Rotated file: renamed to ${rotated} and recreated.`)
      } else {
        dashboard.setMessage('Local writer is disabled.')
      }
    },
    onTruncate: () => {
      if (localWriter) {
        localWriter.truncate()
        dashboard.setMessage('Truncated dynamic.log to 0 bytes.')
      } else {
        dashboard.setMessage('Local writer is disabled.')
      }
    },
    onTogglePause: () => {
      isRunning = !isRunning
      resetTimer()
      dashboard.setMessage(isRunning ? 'Resumed log streaming.' : 'Paused log streaming.')
    },
    onSpeedUp: () => {
      currentRate = Math.min(200, currentRate + (currentRate < 20 ? 5 : 20))
      resetTimer()
      dashboard.setMessage(`Speed increased to ${currentRate} logs/sec.`)
    },
    onSlowDown: () => {
      currentRate = Math.max(1, currentRate - (currentRate <= 10 ? 2 : 10))
      resetTimer()
      dashboard.setMessage(`Speed decreased to ${currentRate} logs/sec.`)
    },
    onQuit: async () => {
      if (timer) clearInterval(timer)
      dashboard.stop()
      if (sshServer) {
        await sshServer.stop()
      }
      process.exit(0)
    }
  })

  // Start generation timer & dashboard
  resetTimer()
  dashboard.start()

  // Graceful shutdown handling
  const shutdown = async (): Promise<void> => {
    if (timer) clearInterval(timer)
    dashboard.stop()
    if (sshServer) {
      await sshServer.stop()
    }
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('Fatal error starting mock server:', err)
  process.exit(1)
})
