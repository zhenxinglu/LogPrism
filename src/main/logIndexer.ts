import { openSync, readSync, statSync, closeSync, createReadStream } from 'fs'

export interface FileIndexInfo {
  filePath: string
  fileSize: number
  totalLines: number
  offsets: number[]
}

class LogIndexer {
  private cache: Map<string, FileIndexInfo> = new Map()

  /**
   * Indexes a log file by scanning newline byte offsets (\n) using streaming chunks.
   * Efficient for both small (<1MB) and GB-scale files.
   */
  public async indexFile(filePath: string): Promise<FileIndexInfo> {
    const stats = statSync(filePath)
    const fileSize = stats.size

    return new Promise((resolve, reject) => {
      const offsets: number[] = [0]
      let currentOffset = 0

      const stream = createReadStream(filePath, {
        highWaterMark: 256 * 1024 // 256KB chunk size
      })

      stream.on('data', (chunk: Buffer | string) => {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
        const len = buf.length
        for (let i = 0; i < len; i++) {
          if (buf[i] === 0x0a) {
            // '\n'
            offsets.push(currentOffset + i + 1)
          }
        }
        currentOffset += len
      })

      stream.on('end', () => {
        const info: FileIndexInfo = {
          filePath,
          fileSize,
          totalLines: offsets.length,
          offsets
        }
        this.cache.set(filePath, info)
        resolve(info)
      })

      stream.on('error', (err) => {
        reject(err)
      })
    })
  }

  /**
   * Incrementally updates the line offset index when a file grows (appends new logs).
   */
  public updateIndexOnAppend(filePath: string): FileIndexInfo | null {
    const existing = this.cache.get(filePath)
    if (!existing) return null

    try {
      const stats = statSync(filePath)
      const newFileSize = stats.size

      if (newFileSize <= existing.fileSize) {
        // File shrunk or truncated, re-index full file
        return null
      }

      const readLen = newFileSize - existing.fileSize
      const fd = openSync(filePath, 'r')
      const buffer = Buffer.alloc(Math.min(readLen, 10 * 1024 * 1024)) // Read up to 10MB chunk
      let currentOffset = existing.fileSize

      let bytesRead = readSync(fd, buffer, 0, Math.min(buffer.length, readLen), currentOffset)
      while (bytesRead > 0) {
        for (let i = 0; i < bytesRead; i++) {
          if (buffer[i] === 0x0a) {
            existing.offsets.push(currentOffset + i + 1)
          }
        }
        currentOffset += bytesRead
        if (currentOffset >= newFileSize) break
        bytesRead = readSync(
          fd,
          buffer,
          0,
          Math.min(buffer.length, newFileSize - currentOffset),
          currentOffset
        )
      }

      closeSync(fd)

      existing.fileSize = newFileSize
      existing.totalLines = existing.offsets.length
      this.cache.set(filePath, existing)
      return existing
    } catch (err) {
      console.error('Failed to update index on append:', err)
      return null
    }
  }

  /**
   * Reads a slice of lines from [startLine, startLine + count) using cached byte offsets.
   */
  public readLogLines(
    filePath: string,
    startLine: number,
    count: number
  ): { lines: string[]; startLine: number; totalLines: number } {
    let indexInfo = this.cache.get(filePath)
    if (!indexInfo) {
      // Synchronous fallback read if not cached yet
      const stats = statSync(filePath)
      indexInfo = {
        filePath,
        fileSize: stats.size,
        totalLines: 0,
        offsets: [0]
      }
    }

    const totalLines = indexInfo.totalLines
    if (totalLines === 0 || startLine >= totalLines) {
      return { lines: [], startLine, totalLines }
    }

    const safeStartLine = Math.max(0, startLine)
    const safeEndLine = Math.min(totalLines, safeStartLine + count)

    const startByte = indexInfo.offsets[safeStartLine]
    const endByte = safeEndLine < totalLines ? indexInfo.offsets[safeEndLine] : indexInfo.fileSize
    const byteLength = endByte - startByte

    if (byteLength <= 0) {
      return { lines: [], startLine: safeStartLine, totalLines }
    }

    let fd: number | null = null
    try {
      fd = openSync(filePath, 'r')
      const buffer = Buffer.alloc(byteLength)
      readSync(fd, buffer, 0, byteLength, startByte)

      let rawContent = buffer.toString('utf-8')
      if (rawContent.endsWith('\r\n')) {
        rawContent = rawContent.slice(0, -2)
      } else if (rawContent.endsWith('\n')) {
        rawContent = rawContent.slice(0, -1)
      }

      const lines = rawContent.split(/\r?\n/)
      return { lines, startLine: safeStartLine, totalLines }
    } catch (err) {
      console.error('Failed to read log lines:', err)
      return { lines: [], startLine: safeStartLine, totalLines }
    } finally {
      if (fd !== null) {
        try {
          closeSync(fd)
        } catch {}
      }
    }
  }

  /**
   * Reads full file content if file is small (< 20MB), or null if file is large (> 20MB).
   */
  public readFullContentIfSmall(filePath: string, maxSizeBytes = 20 * 1024 * 1024): string | null {
    try {
      const stats = statSync(filePath)
      if (stats.size > maxSizeBytes) {
        return null // Too large for single IPC string
      }
      const fd = openSync(filePath, 'r')
      const buf = Buffer.alloc(stats.size)
      readSync(fd, buf, 0, stats.size, 0)
      closeSync(fd)
      return buf.toString('utf-8')
    } catch (err) {
      console.error('Failed to read file content:', err)
      return null
    }
  }

  /**
   * Gets cached file index info if available.
   */
  public getIndexInfo(filePath: string): FileIndexInfo | undefined {
    return this.cache.get(filePath)
  }

  /**
   * Clears cache for a file.
   */
  public clearCache(filePath?: string): void {
    if (filePath) {
      this.cache.delete(filePath)
    } else {
      this.cache.clear()
    }
  }
}

export const logIndexer = new LogIndexer()
