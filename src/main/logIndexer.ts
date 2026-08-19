import { openSync, readSync, statSync, closeSync, createReadStream, readFileSync } from 'fs'
import { createGunzip, gunzipSync } from 'zlib'

export interface FileIndexInfo {
  filePath: string
  fileSize: number
  totalLines: number
  offsets: Uint32Array | Float64Array | number[]
  isGz?: boolean
}

class LogIndexer {
  private cache: Map<string, FileIndexInfo> = new Map()

  /**
   * Checks if a file has a .gz extension or gzip magic header.
   */
  public isGzipFile(filePath: string): boolean {
    if (filePath.toLowerCase().endsWith('.gz')) return true
    try {
      const fd = openSync(filePath, 'r')
      const buf = Buffer.alloc(2)
      readSync(fd, buf, 0, 2, 0)
      closeSync(fd)
      return buf[0] === 0x1f && buf[1] === 0x8b
    } catch {
      return false
    }
  }

  /**
   * Indexes a log file by scanning newline byte offsets (\n) using streaming chunks.
   * Uses Uint32Array for contiguous memory storage (75% memory savings for <=1GB files).
   */
  public async indexFile(filePath: string): Promise<FileIndexInfo> {
    const isGz = this.isGzipFile(filePath)
    if (isGz) {
      return this.indexGzFile(filePath)
    }

    const stats = statSync(filePath)
    const fileSize = stats.size

    return new Promise((resolve, reject) => {
      // Pre-allocate Uint32Array for fast contiguous memory access
      let capacity = 64 * 1024
      let offsets = new Uint32Array(capacity)
      offsets[0] = 0
      let totalLines = 1
      let currentOffset = 0

      const stream = createReadStream(filePath, {
        highWaterMark: 256 * 1024 // 256KB chunk size
      })

      stream.on('data', (chunk: Buffer | string) => {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
        const len = buf.length
        for (let i = 0; i < len; i++) {
          if (buf[i] === 0x0a) {
            // Found '\n'
            if (totalLines >= capacity) {
              capacity *= 2
              const nextOffsets = new Uint32Array(capacity)
              nextOffsets.set(offsets)
              offsets = nextOffsets
            }
            offsets[totalLines] = currentOffset + i + 1
            totalLines++
          }
        }
        currentOffset += len
      })

      stream.on('end', () => {
        const finalOffsets = offsets.subarray(0, totalLines)
        const info: FileIndexInfo = {
          filePath,
          fileSize,
          totalLines: finalOffsets.length,
          offsets: finalOffsets,
          isGz: false
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
   * Index .gz compressed log files using streaming decompressor.
   */
  private async indexGzFile(filePath: string): Promise<FileIndexInfo> {
    const stats = statSync(filePath)
    const fileSize = stats.size

    return new Promise((resolve, reject) => {
      let capacity = 64 * 1024
      let offsets = new Uint32Array(capacity)
      offsets[0] = 0
      let totalLines = 1
      let currentOffset = 0

      const rawStream = createReadStream(filePath, { highWaterMark: 256 * 1024 })
      const gunzip = createGunzip()
      const stream = rawStream.pipe(gunzip)

      stream.on('data', (chunk: Buffer) => {
        const len = chunk.length
        for (let i = 0; i < len; i++) {
          if (chunk[i] === 0x0a) {
            if (totalLines >= capacity) {
              capacity *= 2
              const nextOffsets = new Uint32Array(capacity)
              nextOffsets.set(offsets)
              offsets = nextOffsets
            }
            offsets[totalLines] = currentOffset + i + 1
            totalLines++
          }
        }
        currentOffset += len
      })

      stream.on('end', () => {
        const finalOffsets = offsets.subarray(0, totalLines)
        const info: FileIndexInfo = {
          filePath,
          fileSize,
          totalLines: finalOffsets.length,
          offsets: finalOffsets,
          isGz: true
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
   * Incrementally updates line offset index when a plain log file appends new lines.
   */
  public updateIndexOnAppend(filePath: string): FileIndexInfo | null {
    const existing = this.cache.get(filePath)
    if (!existing || existing.isGz) return null

    try {
      const stats = statSync(filePath)
      const newFileSize = stats.size

      if (newFileSize <= existing.fileSize) {
        return null
      }

      const readLen = newFileSize - existing.fileSize
      const fd = openSync(filePath, 'r')
      const buffer = Buffer.alloc(Math.min(readLen, 10 * 1024 * 1024))
      let currentOffset = existing.fileSize

      const newOffsets: number[] = []
      let bytesRead = readSync(fd, buffer, 0, Math.min(buffer.length, readLen), currentOffset)
      while (bytesRead > 0) {
        for (let i = 0; i < bytesRead; i++) {
          if (buffer[i] === 0x0a) {
            newOffsets.push(currentOffset + i + 1)
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

      const oldLen = existing.offsets.length
      const updatedOffsets = new Uint32Array(oldLen + newOffsets.length)
      updatedOffsets.set(existing.offsets)
      for (let i = 0; i < newOffsets.length; i++) {
        updatedOffsets[oldLen + i] = newOffsets[i]
      }

      existing.fileSize = newFileSize
      existing.offsets = updatedOffsets
      existing.totalLines = updatedOffsets.length
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
      const stats = statSync(filePath)
      indexInfo = {
        filePath,
        fileSize: stats.size,
        totalLines: 0,
        offsets: new Uint32Array([0])
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

    if (indexInfo.isGz) {
      // Handle compressed .gz line slicing via gunzip
      try {
        const compressed = readFileSync(filePath)
        const decompressed = gunzipSync(compressed)
        const sliceBuf = decompressed.subarray(startByte, endByte)
        let rawContent = sliceBuf.toString('utf-8')
        if (rawContent.endsWith('\r\n')) rawContent = rawContent.slice(0, -2)
        else if (rawContent.endsWith('\n')) rawContent = rawContent.slice(0, -1)

        const lines = rawContent.split(/\r?\n/)
        return { lines, startLine: safeStartLine, totalLines }
      } catch (err) {
        console.error('Failed to read gz log lines:', err)
        return { lines: [], startLine: safeStartLine, totalLines }
      }
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
   * Reads full file content if file is small (< 5MB uncompressed), or null if file is large.
   */
  public readFullContentIfSmall(filePath: string, maxSizeBytes = 5 * 1024 * 1024): string | null {
    try {
      if (this.isGzipFile(filePath)) {
        const compressed = readFileSync(filePath)
        const decompressed = gunzipSync(compressed)
        if (decompressed.length > maxSizeBytes) {
          return null
        }
        return decompressed.toString('utf-8')
      }

      const stats = statSync(filePath)
      if (stats.size > maxSizeBytes) {
        return null
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
   * Clears cache for a file or all files.
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
