import {
  existsSync,
  mkdirSync,
  appendFileSync,
  statSync,
  renameSync,
  truncateSync,
  writeFileSync
} from 'fs'
import { dirname, resolve } from 'path'

export class LocalLogWriter {
  public readonly filePath: string
  private totalLinesWritten = 0

  constructor(filePath = 'test-logs/dynamic.log') {
    this.filePath = resolve(process.cwd(), filePath)
    this.ensureDirectory()
  }

  /**
   * Ensure parent directory of log file exists
   */
  private ensureDirectory(): void {
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  /**
   * Append a single log entry or multi-line entry to local file
   */
  public append(logEntry: string): void {
    const content = logEntry.endsWith('\n') ? logEntry : logEntry + '\n'
    appendFileSync(this.filePath, content, 'utf-8')
    const lines = content.split('\n').length - 1
    this.totalLinesWritten += lines
  }

  /**
   * Append multiple log entries in batch
   */
  public appendBatch(entries: string[]): void {
    if (entries.length === 0) return
    const chunk = entries.map((e) => (e.endsWith('\n') ? e : e + '\n')).join('')
    appendFileSync(this.filePath, chunk, 'utf-8')
    const lines = chunk.split('\n').length - 1
    this.totalLinesWritten += lines
  }

  /**
   * Simulate log rotation: rename current file to .<timestamp> and create fresh file
   */
  public rotate(): string {
    if (existsSync(this.filePath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const rotatedPath = `${this.filePath}.${timestamp}`
      renameSync(this.filePath, rotatedPath)
      writeFileSync(this.filePath, '', 'utf-8')
      this.totalLinesWritten = 0
      return rotatedPath
    }
    writeFileSync(this.filePath, '', 'utf-8')
    this.totalLinesWritten = 0
    return this.filePath
  }

  /**
   * Simulate log truncation: truncate file size to 0 bytes in-place
   */
  public truncate(): void {
    if (existsSync(this.filePath)) {
      truncateSync(this.filePath, 0)
    } else {
      writeFileSync(this.filePath, '', 'utf-8')
    }
    this.totalLinesWritten = 0
  }

  /**
   * Get current file statistics
   */
  public getStats(): { exists: boolean; size: number; totalLines: number } {
    if (!existsSync(this.filePath)) {
      return { exists: false, size: 0, totalLines: this.totalLinesWritten }
    }
    try {
      const stats = statSync(this.filePath)
      return { exists: true, size: stats.size, totalLines: this.totalLinesWritten }
    } catch {
      return { exists: false, size: 0, totalLines: this.totalLinesWritten }
    }
  }
}
