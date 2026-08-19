export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'OTHER'

export interface TimestampFormat {
  id: string
  name: string
  example: string
  regex: RegExp
  extractTime: (matchStr: string, fullMatch: string) => string | null
}

export const formatTimestamp = (raw: string): string => {
  const normalized = raw.replace(',', '.')
  if (normalized.length === 8) {
    return normalized + '.000'
  }
  const parts = normalized.split('.')
  if (parts.length === 2) {
    return `${parts[0]}.${parts[1].padEnd(3, '0').slice(0, 3)}`
  }
  return normalized
}

export const TIMESTAMP_FORMATS: TimestampFormat[] = [
  {
    id: 'iso8601',
    name: 'ISO 8601',
    example: '2026-07-30T08:58:24.123Z',
    regex: /^\[?(\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)(?:Z|[+-]\d{2}:?\d{2})?)\]?/,
    extractTime: (_matchStr, fullMatch) => {
      const m = fullMatch.match(/T(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)/)
      return m ? formatTimestamp(m[1]) : null
    }
  },
  {
    id: 'yyyy-mm-dd-ms',
    name: 'YYYY-MM-DD HH:mm:ss.SSS',
    example: '2026-07-30 08:58:24.123',
    regex: /^\[?(\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?))\]?/,
    extractTime: (_matchStr, fullMatch) => {
      const m = fullMatch.match(/(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)/)
      return m ? formatTimestamp(m[1]) : null
    }
  },
  {
    id: 'yyyy-mm-dd',
    name: 'YYYY-MM-DD HH:mm:ss',
    example: '2026-07-30 08:58:24',
    regex: /^\[?(\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2}:\d{2}))\]?/,
    extractTime: (_matchStr, fullMatch) => {
      const m = fullMatch.match(/(\d{2}:\d{2}:\d{2})/)
      return m ? formatTimestamp(m[1]) : null
    }
  },
  {
    id: 'yyyy/mm/dd-ms',
    name: 'YYYY/MM/DD HH:mm:ss.SSS',
    example: '2026/07/30 08:58:24.123',
    regex: /^\[?(\d{4}\/\d{2}\/\d{2}\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?))\]?/,
    extractTime: (_matchStr, fullMatch) => {
      const m = fullMatch.match(/(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)/)
      return m ? formatTimestamp(m[1]) : null
    }
  },
  {
    id: 'yyyy/mm/dd',
    name: 'YYYY/MM/DD HH:mm:ss',
    example: '2026/07/30 08:58:24',
    regex: /^\[?(\d{4}\/\d{2}\/\d{2}\s+(\d{2}:\d{2}:\d{2}))\]?/,
    extractTime: (_matchStr, fullMatch) => {
      const m = fullMatch.match(/(\d{2}:\d{2}:\d{2})/)
      return m ? formatTimestamp(m[1]) : null
    }
  },
  {
    id: 'clf',
    name: 'DD/MMM/YYYY:HH:mm:ss',
    example: '30/Jul/2026:08:58:24',
    regex: /^\[?(\d{2}\/[A-Za-z]{3}\/\d{4}:(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)(?:\s+[+-]\d{4})?)\]?/,
    extractTime: (_matchStr, fullMatch) => {
      const m = fullMatch.match(/:(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)/)
      return m ? formatTimestamp(m[1]) : null
    }
  },
  {
    id: 'syslog',
    name: 'MMM DD HH:mm:ss',
    example: 'Jul 30 08:58:24',
    regex: /^\[?([A-Za-z]{3}\s+\d{1,2}\s+(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?))\]?/,
    extractTime: (_matchStr, fullMatch) => {
      const m = fullMatch.match(/(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)/)
      return m ? formatTimestamp(m[1]) : null
    }
  },
  {
    id: 'hh-mm-ss-ms',
    name: 'HH:mm:ss.SSS',
    example: '08:58:24.123',
    regex: /^\[?(\d{2}:\d{2}:\d{2}[.,]\d{1,3})\]?/,
    extractTime: (matchStr) => formatTimestamp(matchStr)
  },
  {
    id: 'hh-mm-ss',
    name: 'HH:mm:ss',
    example: '08:58:24',
    regex: /^\[?(\d{2}:\d{2}:\d{2})\]?/,
    extractTime: (matchStr) => formatTimestamp(matchStr)
  }
]

export const detectTimestampFormat = (content: string): TimestampFormat | null => {
  if (!content) return null
  const lines = content.split(/\r?\n/).slice(0, 200)

  const counts = new Map<string, number>()
  for (const fmt of TIMESTAMP_FORMATS) {
    counts.set(fmt.id, 0)
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    for (const fmt of TIMESTAMP_FORMATS) {
      if (fmt.regex.test(trimmed)) {
        counts.set(fmt.id, (counts.get(fmt.id) || 0) + 1)
        break
      }
    }
  }

  let bestFmt: TimestampFormat | null = null
  let maxCount = 0
  for (const fmt of TIMESTAMP_FORMATS) {
    const count = counts.get(fmt.id) || 0
    if (count > maxCount) {
      maxCount = count
      bestFmt = fmt
    }
  }

  return bestFmt
}

const HEADER_UPPER_LEVEL_REGEX = /\b(ERROR|FATAL|SEVERE|CRITICAL|WARN|WARNING|INFO|NOTICE|DEBUG|TRACE|VERBOSE)\b/
const ALL_LEVELS_REGEX = /\b(error|fatal|severe|critical|err|exception|fail|failed|warn|warning|info|notice|debug|trace|verbose)\b/gi

export const detectLogLevel = (text: string): LogLevel => {
  if (!text) return 'OTHER'

  const headerText = text.slice(0, 120)
  const upperMatch = HEADER_UPPER_LEVEL_REGEX.exec(headerText)
  if (upperMatch) {
    const token = upperMatch[1]
    if (/^(ERROR|FATAL|SEVERE|CRITICAL)$/.test(token)) return 'ERROR'
    if (/^(WARN|WARNING)$/.test(token)) return 'WARN'
    if (/^(INFO|NOTICE)$/.test(token)) return 'INFO'
    if (/^(DEBUG|TRACE|VERBOSE)$/.test(token)) return 'DEBUG'
  }

  ALL_LEVELS_REGEX.lastIndex = 0
  const match = ALL_LEVELS_REGEX.exec(text)
  if (match) {
    const token = match[1].toLowerCase()
    if (/^(error|fatal|severe|critical|err|exception|fail|failed)$/.test(token)) return 'ERROR'
    if (/^(warn|warning)$/.test(token)) return 'WARN'
    if (/^(info|notice)$/.test(token)) return 'INFO'
    if (/^(debug|trace|verbose)$/.test(token)) return 'DEBUG'
  }

  return 'OTHER'
}
