import readline from 'readline'

export interface DashboardMetrics {
  isRunning: boolean
  ratePerSec: number
  totalGenerated: number
  localFilePath: string
  localFileSize: number
  localTotalLines: number
  sshEnabled: boolean
  sshPort: number
  sshUser: string
  sshPass: string
  sshClients: number
  sshStreams: number
}

export interface DashboardActions {
  onBurst: () => void
  onInjectException: () => void
  onRotate: () => void
  onTruncate: () => void
  onTogglePause: () => void
  onSpeedUp: () => void
  onSlowDown: () => void
  onQuit: () => void
}

export class Dashboard {
  private lastMessage = 'Ready. Press keys to interact.'
  private refreshTimer: NodeJS.Timeout | null = null
  private getMetrics: () => DashboardMetrics
  private actions: DashboardActions

  constructor(getMetrics: () => DashboardMetrics, actions: DashboardActions) {
    this.getMetrics = getMetrics
    this.actions = actions
  }

  public setMessage(msg: string): void {
    this.lastMessage = msg
    this.render()
  }

  public start(): void {
    const handleKey = (ch: string): void => {
      const char = ch.trim().toLowerCase()
      if (char === 'q' || ch === '\u0003') {
        this.actions.onQuit()
      } else if (char === 'b') {
        this.actions.onBurst()
      } else if (char === 'e') {
        this.actions.onInjectException()
      } else if (char === 'r') {
        this.actions.onRotate()
      } else if (char === 't') {
        this.actions.onTruncate()
      } else if (char === 's') {
        this.actions.onTogglePause()
      } else if (ch === '+' || ch === '=') {
        this.actions.onSpeedUp()
      } else if (ch === '-' || ch === '_') {
        this.actions.onSlowDown()
      }
    }

    if (process.stdout.isTTY) {
      // Hide cursor to prevent cursor jitter and clear once at startup
      process.stdout.write('\x1b[?25l\x1b[2J\x1b[H')
    }

    if (process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin)
      process.stdin.setRawMode(true)
      process.stdin.resume()

      process.stdin.on('keypress', (str, key) => {
        if (!key) {
          if (str) handleKey(str)
          return
        }

        if ((key.ctrl && key.name === 'c') || key.name === 'q') {
          this.actions.onQuit()
        } else if (key.name === 'b') {
          this.actions.onBurst()
        } else if (key.name === 'e') {
          this.actions.onInjectException()
        } else if (key.name === 'r') {
          this.actions.onRotate()
        } else if (key.name === 't') {
          this.actions.onTruncate()
        } else if (key.name === 's') {
          this.actions.onTogglePause()
        } else if (key.sequence === '+' || key.sequence === '=') {
          this.actions.onSpeedUp()
        } else if (key.sequence === '-' || key.name === 'minus') {
          this.actions.onSlowDown()
        }
      })
    } else {
      process.stdin.setEncoding('utf-8')
      process.stdin.resume()
      process.stdin.on('data', (chunk: string) => {
        for (const char of chunk.toString()) {
          handleKey(char)
        }
      })
    }

    // Refresh display smoothly every 1000ms instead of 500ms
    this.refreshTimer = setInterval(() => {
      this.render()
    }, 1000)

    this.render()
  }

  public stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false)
      process.stdin.pause()
    }
    if (process.stdout.isTTY) {
      // Restore cursor visibility
      process.stdout.write('\x1b[?25h')
    }
    console.log('\nExiting dynamic log simulator. Goodbye!\n')
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  public render(): void {
    const m = this.getMetrics()
    const isTTY = Boolean(process.stdout.isTTY)

    const cyan = '\x1b[36m'
    const green = '\x1b[32m'
    const yellow = '\x1b[33m'
    const red = '\x1b[31m'
    const magenta = '\x1b[35m'
    const gray = '\x1b[90m'
    const bold = '\x1b[1m'
    const reset = '\x1b[0m'
    const clearEol = '\x1b[K'

    const statusBadge = m.isRunning
      ? `${green}${bold}[STREAMING ACTIVE]${reset}`
      : `${yellow}${bold}[STREAMING PAUSED]${reset}`

    if (!isTTY) {
      // In non-TTY environments (pipes, IDE background tasks),
      // avoid printing multi-line banners continuously to prevent terminal flooding.
      const statusText = `[Simulator] ${m.isRunning ? 'RUNNING' : 'PAUSED'} | ${m.ratePerSec} logs/s | Total: ${m.totalGenerated} | File: ${this.formatBytes(m.localFileSize)} (${m.localTotalLines} lines) | SSH Clients: ${m.sshClients} | ${this.lastMessage}`
      console.log(statusText)
      return
    }

    const lines: string[] = []
    lines.push(
      `${cyan}${bold}========================================================================${reset}`
    )
    lines.push(
      `${cyan}${bold}              LogPrism Dynamic Log Simulator & Test Harness             ${reset}`
    )
    lines.push(
      `${cyan}${bold}========================================================================${reset}`
    )
    lines.push(
      ` Status: ${statusBadge}   Rate: ${bold}${m.ratePerSec} logs/sec${reset}   Total Generated: ${bold}${m.totalGenerated}${reset}`
    )
    lines.push('')
    lines.push(`${bold}1. Local File Mode:${reset}`)
    lines.push(`   - Path:  ${green}${m.localFilePath}${reset}`)
    lines.push(`   - Stats: ${this.formatBytes(m.localFileSize)} | ${m.localTotalLines} lines`)
    lines.push('')
    if (m.sshEnabled) {
      lines.push(`${bold}2. Remote Mock SSH Server:${reset}`)
      lines.push(
        `   - Host:     ${magenta}127.0.0.1${reset}    Port: ${magenta}${m.sshPort}${reset}`
      )
      lines.push(
        `   - User:     ${magenta}${m.sshUser}${reset}      Pass: ${magenta}${m.sshPass}${reset}`
      )
      lines.push(
        `   - Clients:  ${bold}${m.sshClients}${reset} connected (${bold}${m.sshStreams}${reset} tail stream(s))`
      )
      lines.push(
        `   - Path:     ${gray}/var/log/app.log (or any path in LogPrism SSH modal)${reset}`
      )
    } else {
      lines.push(`${bold}2. Remote Mock SSH Server:${reset} ${gray}[DISABLED]${reset}`)
    }
    lines.push('')
    lines.push(
      `${gray}------------------------------------------------------------------------${reset}`
    )
    lines.push(`${bold}Interactive Hotkeys:${reset}`)
    lines.push(
      `  ${cyan}[b]${reset} Trigger Burst (+500 lines)    ${cyan}[e]${reset} Inject Error Stack Trace`
    )
    lines.push(
      `  ${cyan}[r]${reset} Rotate File (rename & new)   ${cyan}[t]${reset} Truncate File (0 bytes)`
    )
    lines.push(
      `  ${cyan}[s]${reset} Pause / Resume Stream        ${cyan}[+]${reset} Speed Up   ${cyan}[-]${reset} Slow Down`
    )
    lines.push(`  ${red}[q]${reset} Quit Simulator`)
    lines.push(
      `${gray}------------------------------------------------------------------------${reset}`
    )
    lines.push(` Latest Event: ${yellow}${this.lastMessage}${reset}`)
    lines.push(
      `${gray}------------------------------------------------------------------------${reset}`
    )

    // Flicker-free render buffer:
    // Move cursor to top-left without clearing the screen, write each line with EOL clear, and clear trailing rows.
    const output = '\x1b[H' + lines.map((l) => l + clearEol).join('\n') + '\n\x1b[J'
    process.stdout.write(output)
  }
}
