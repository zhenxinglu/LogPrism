import {
  LogLevel,
  TIMESTAMP_FORMATS,
  detectTimestampFormat,
  detectLogLevel,
  formatTimestamp
} from '../utils/logParser'

export interface LogLineData {
  text: string
  originalIndex: number
  timestamp: string | null
  level?: LogLevel
  isContext?: boolean
  contextTargetIndex?: number
}

export interface FilterWorkerRequest {
  jobId: number
  content: string
  includeKeywords: string
  excludeKeywords: string
  isIncludeCaseSensitive: boolean
  isExcludeCaseSensitive: boolean
  selectedLogLevels: Record<LogLevel, boolean>
  startTime: string | null
  endTime: string | null
  selectedFormatId: string
  detectedFormatId: string | null
  expandedContexts: Record<number, number>
}

export interface FilterWorkerResponse {
  jobId: number
  filteredLines: LogLineData[]
  unfilteredTimeLines: LogLineData[]
  matchCount: number
  levelCounts: Record<LogLevel, number>
  detectedFormatId: string | null
}

const DEFAULT_LOG_LEVELS: Record<LogLevel, boolean> = {
  ERROR: true,
  WARN: true,
  INFO: true,
  DEBUG: true,
  OTHER: true
}

const parseKeywords = (input: string, caseSensitive: boolean): string[] => {
  const regex = /"([^"]+)"|(\S+)/g
  const result: string[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(input)) !== null) {
    const kw = m[1] || m[2]
    if (kw) {
      result.push(caseSensitive ? kw : kw.toLowerCase())
    }
  }
  return result
}

self.onmessage = (e: MessageEvent<FilterWorkerRequest>) => {
  const {
    jobId,
    content,
    includeKeywords,
    excludeKeywords,
    isIncludeCaseSensitive,
    isExcludeCaseSensitive,
    selectedLogLevels = DEFAULT_LOG_LEVELS,
    startTime,
    endTime,
    selectedFormatId,
    detectedFormatId,
    expandedContexts
  } = e.data

  if (!content) {
    const emptyResponse: FilterWorkerResponse = {
      jobId,
      filteredLines: [],
      unfilteredTimeLines: [],
      matchCount: 0,
      levelCounts: { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, OTHER: 0 },
      detectedFormatId: null
    }
    self.postMessage(emptyResponse)
    return
  }

  // Detect format if auto
  let currentDetectedFormatId = detectedFormatId
  if (selectedFormatId === 'auto' && !currentDetectedFormatId) {
    const detected = detectTimestampFormat(content)
    currentDetectedFormatId = detected ? detected.id : null
  }

  const formatIdToUse = selectedFormatId === 'auto' ? currentDetectedFormatId : selectedFormatId
  const activeFormat = TIMESTAMP_FORMATS.find((f) => f.id === formatIdToUse) || null

  const rawLines = content.split(/\r?\n/)
  const entries: {
    originalIndex: number
    headerLine: string
    lines: string[]
    timestamp: string | null
  }[] = []

  let currentEntry: {
    originalIndex: number
    headerLine: string
    lines: string[]
    timestamp: string | null
  } | null = null

  const timeRegex = activeFormat
    ? activeFormat.regex
    : /^\[?(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)\]?/

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const trimmed = line.trim()
    const match = trimmed.match(timeRegex)

    let extractedTime: string | null = null
    if (match) {
      if (activeFormat) {
        extractedTime = activeFormat.extractTime(match[1] || match[0], match[0])
      } else {
        extractedTime = formatTimestamp(match[1])
      }
    }

    if (match && extractedTime) {
      if (currentEntry) {
        entries.push(currentEntry)
      }
      currentEntry = {
        originalIndex: i,
        headerLine: line,
        lines: [line],
        timestamp: extractedTime
      }
    } else {
      if (currentEntry) {
        currentEntry.lines.push(line)
      } else {
        entries.push({
          originalIndex: i,
          headerLine: line,
          lines: [line],
          timestamp: null
        })
      }
    }
  }
  if (currentEntry) {
    entries.push(currentEntry)
  }

  // Build timeline density data
  const timelineData: LogLineData[] = []
  entries.forEach((entry) => {
    timelineData.push({
      text: entry.headerLine,
      originalIndex: entry.originalIndex,
      timestamp: entry.timestamp
    })
  })

  // Prepare keyword lists
  const includes = parseKeywords(includeKeywords || '', isIncludeCaseSensitive || false)
  const excludes = parseKeywords(excludeKeywords || '', isExcludeCaseSensitive || false)

  const isWithinTimeRange = (timeStr: string | null): boolean => {
    if (!timeStr) return true
    if (startTime && timeStr < startTime) return false
    if (endTime && timeStr > endTime) return false
    return true
  }

  const counts: Record<LogLevel, number> = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, OTHER: 0 }
  const resultLinesData: LogLineData[] = []
  const resultTextBlocks: string[] = []

  const activeExpandedContextEntries = expandedContexts ? Object.entries(expandedContexts) : []
  const hasActiveFilters = Boolean(
    (includeKeywords && includeKeywords.trim()) ||
      (excludeKeywords && excludeKeywords.trim()) ||
      startTime ||
      endTime ||
      Object.values(selectedLogLevels).some((v) => !v)
  )

  if (hasActiveFilters && activeExpandedContextEntries.length > 0) {
    const matchedEntries: typeof entries = []
    const matchedLineIndices = new Set<number>()

    for (const entry of entries) {
      const fullBlockText = entry.lines.join('\n')
      const entryLevel = detectLogLevel(entry.headerLine)
      counts[entryLevel] += 1

      if (!selectedLogLevels[entryLevel]) continue
      if (!isWithinTimeRange(entry.timestamp)) continue

      if (includes.length > 0) {
        const targetText = isIncludeCaseSensitive
          ? fullBlockText
          : fullBlockText.toLowerCase()
        const hasMatch = includes.some((kw) => targetText.includes(kw))
        if (!hasMatch) continue
      }

      if (excludes.length > 0) {
        const targetText = isExcludeCaseSensitive
          ? fullBlockText
          : fullBlockText.toLowerCase()
        const hasExclude = excludes.some((kw) => targetText.includes(kw))
        if (hasExclude) continue
      }

      matchedEntries.push(entry)
      for (let j = 0; j < entry.lines.length; j++) {
        matchedLineIndices.add(entry.originalIndex + j)
      }
    }

    const contextLineMap = new Map<number, { targetIndex: number }>()
    for (const [targetStr, count] of activeExpandedContextEntries) {
      const targetIndex = Number(targetStr)
      const minIdx = Math.max(0, targetIndex - count)
      const maxIdx = Math.min(rawLines.length - 1, targetIndex + count)
      for (let i = minIdx; i <= maxIdx; i++) {
        if (!matchedLineIndices.has(i)) {
          if (!contextLineMap.has(i)) {
            contextLineMap.set(i, { targetIndex })
          }
        }
      }
    }

    for (const entry of entries) {
      const fullBlockText = entry.lines.join('\n')
      const entryLevel = detectLogLevel(entry.headerLine)
      const isMatched = matchedEntries.includes(entry)

      if (isMatched) {
        resultTextBlocks.push(fullBlockText)
        for (let j = 0; j < entry.lines.length; j++) {
          resultLinesData.push({
            text: entry.lines[j],
            originalIndex: entry.originalIndex + j,
            timestamp: j === 0 ? entry.timestamp : null,
            level: entryLevel,
            isContext: false
          })
        }
      } else {
        for (let j = 0; j < entry.lines.length; j++) {
          const rawIdx = entry.originalIndex + j
          const contextInfo = contextLineMap.get(rawIdx)
          if (contextInfo) {
            resultLinesData.push({
              text: entry.lines[j],
              originalIndex: rawIdx,
              timestamp: j === 0 ? entry.timestamp : null,
              level: entryLevel,
              isContext: true,
              contextTargetIndex: contextInfo.targetIndex
            })
          }
        }
      }
    }

    const response: FilterWorkerResponse = {
      jobId,
      filteredLines: resultLinesData,
      unfilteredTimeLines: timelineData,
      matchCount: matchedEntries.length,
      levelCounts: counts,
      detectedFormatId: currentDetectedFormatId
    }
    self.postMessage(response)
  } else {
    for (const entry of entries) {
      const fullBlockText = entry.lines.join('\n')
      const entryLevel = detectLogLevel(entry.headerLine)
      counts[entryLevel] += 1

      if (!selectedLogLevels[entryLevel]) continue
      if (!isWithinTimeRange(entry.timestamp)) continue

      if (includes.length > 0) {
        const targetText = isIncludeCaseSensitive
          ? fullBlockText
          : fullBlockText.toLowerCase()
        const hasMatch = includes.some((kw) => targetText.includes(kw))
        if (!hasMatch) continue
      }

      if (excludes.length > 0) {
        const targetText = isExcludeCaseSensitive
          ? fullBlockText
          : fullBlockText.toLowerCase()
        const hasExclude = excludes.some((kw) => targetText.includes(kw))
        if (hasExclude) continue
      }

      resultTextBlocks.push(fullBlockText)
      for (let j = 0; j < entry.lines.length; j++) {
        resultLinesData.push({
          text: entry.lines[j],
          originalIndex: entry.originalIndex + j,
          timestamp: j === 0 ? entry.timestamp : null,
          level: entryLevel
        })
      }
    }

    const response: FilterWorkerResponse = {
      jobId,
      filteredLines: resultLinesData,
      unfilteredTimeLines: timelineData,
      matchCount: resultTextBlocks.length,
      levelCounts: counts,
      detectedFormatId: currentDetectedFormatId
    }
    self.postMessage(response)
  }
}
