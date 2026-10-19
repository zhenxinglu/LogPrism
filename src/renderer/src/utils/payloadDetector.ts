/**
 * Smart detection, extraction, and formatting utility for embedded JSON and XML payloads in log lines.
 */

export type PayloadType = 'json' | 'xml'

export interface DetectedPayload {
  type: PayloadType
  rawPayload: string
  formatted: string
  prefixText: string
  suffixText: string
  parsedData?: any // Parsed object/array for JSON, or root node info for XML
  summary: string // Short summary, e.g. "Object (5 keys)", "Array (12 items)", "XML <response>"
  charCount: number
}

// Memory-capped LRU cache for detected payloads (max 3,000 entries)
const payloadCache = new Map<string, DetectedPayload | null>()
const MAX_CACHE_SIZE = 3000

/**
 * Formats XML string with clean indentation.
 */
export function formatXml(xmlStr: string): string {
  try {
    let formatted = ''
    let indent = ''
    const tab = '  '
    // Split on tags while preserving contents
    const tokens = xmlStr.replace(/>\s*</g, '><').replace(/></g, '>\n<').split('\n')

    for (let i = 0; i < tokens.length; i++) {
      let node = tokens[i].trim()
      if (!node) continue

      if (node.match(/^<\/\w/)) {
        // Closing tag: decrease indent
        indent = indent.substring(tab.length)
      }

      formatted += indent + node + '\r\n'

      if (
        node.match(/^<\w[^>]*[^\/]>.*$/) &&
        !node.match(/^<\w[^>]*>.*<\/\w[^>]*>$/) &&
        !node.startsWith('<?') &&
        !node.startsWith('<!')
      ) {
        // Opening tag without immediate inline close: increase indent
        indent += tab
      }
    }

    return formatted.trimEnd()
  } catch {
    return xmlStr
  }
}

/**
 * Validates whether candidate string is well-formed XML using standard browser DOMParser.
 */
function validateXml(candidate: string): { isValid: boolean; rootTagName?: string } {
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(candidate, 'application/xml')
      const parseError = doc.getElementsByTagName('parsererror')
      if (parseError.length > 0) {
        return { isValid: false }
      }
      const rootTag = doc.documentElement?.tagName
      return { isValid: true, rootTagName: rootTag }
    } catch {
      return { isValid: false }
    }
  }

  // Fallback for headless / Node test environments
  try {
    const trimmed = candidate.trim()
    const match = trimmed.match(/^<([a-zA-Z0-9_:\-]+)(?:\s+[^>]*)?>[\s\S]*<\/\1>$/)
    if (match) {
      return { isValid: true, rootTagName: match[1] }
    }
    const selfClosing = trimmed.match(/^<([a-zA-Z0-9_:\-]+)(?:\s+[^>]*)?\/>$/)
    if (selfClosing) {
      return { isValid: true, rootTagName: selfClosing[1] }
    }
  } catch {}
  return { isValid: false }
}

/**
 * Extracts balanced JSON (Object or Array) substring from raw line text.
 */
function extractJsonPayload(
  text: string
): { raw: string; prefix: string; suffix: string; parsed: any } | null {
  // First check if the entire trimmed string is JSON
  const trimmed = text.trim()
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    if (trimmed.length >= 2) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed !== null && typeof parsed === 'object') {
          return { raw: trimmed, prefix: '', suffix: '', parsed }
        }
      } catch {}
    }
  }

  // Scan through possible JSON start positions in text
  for (let startIdx = 0; startIdx < text.length; startIdx++) {
    const openChar = text[startIdx]
    if (openChar !== '{' && openChar !== '[') {
      continue
    }

    const closeChar = openChar === '{' ? '}' : ']'

    // Fast balanced scanner from startIdx
    let depth = 0
    let inString = false
    let escape = false
    let endIdx = -1

    for (let i = startIdx; i < text.length; i++) {
      const ch = text[i]

      if (inString) {
        if (escape) {
          escape = false
        } else if (ch === '\\') {
          escape = true
        } else if (ch === '"') {
          inString = false
        }
        continue
      }

      if (ch === '"') {
        inString = true
        continue
      }

      if (ch === openChar) {
        depth++
      } else if (ch === closeChar) {
        depth--
        if (depth === 0) {
          endIdx = i + 1
          break
        }
      }
    }

    if (endIdx !== -1 && endIdx - startIdx >= 4) {
      const candidate = text.substring(startIdx, endIdx)
      try {
        const parsed = JSON.parse(candidate)
        if (parsed !== null && typeof parsed === 'object') {
          const prefix = text.substring(0, startIdx).trim()
          const suffix = text.substring(endIdx).trim()
          return { raw: candidate, prefix, suffix, parsed }
        }
      } catch {
        // Not valid JSON, continue loop to look for next candidate
      }
    }
  }

  return null
}

/**
 * Extracts balanced XML substring from raw line text.
 */
function extractXmlPayload(
  text: string
): { raw: string; prefix: string; suffix: string; rootTag: string } | null {
  // Look for potential XML root tags: <tagName ...>...</tagName> or <tagName ... />
  const tagRegex = /<([a-zA-Z0-9_:\-]+)(?:\s+[^>]*)?>/g
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(text)) !== null) {
    const tagName = match[1]
    const startIdx = match.index

    // Check if self-closing: e.g. <root attr="val" />
    if (match[0].endsWith('/>')) {
      const candidate = match[0]
      const { isValid, rootTagName } = validateXml(candidate)
      if (isValid && rootTagName) {
        return {
          raw: candidate,
          prefix: text.substring(0, startIdx).trim(),
          suffix: text.substring(startIdx + candidate.length).trim(),
          rootTag: rootTagName
        }
      }
      continue
    }

    // Find the closing tag </tagName> starting from after the match
    const closingTag = `</${tagName}>`
    const lastCloseIdx = text.lastIndexOf(closingTag)
    if (lastCloseIdx > startIdx) {
      const endIdx = lastCloseIdx + closingTag.length
      const candidate = text.substring(startIdx, endIdx)
      const { isValid, rootTagName } = validateXml(candidate)
      if (isValid && rootTagName) {
        return {
          raw: candidate,
          prefix: text.substring(0, startIdx).trim(),
          suffix: text.substring(endIdx).trim(),
          rootTag: rootTagName
        }
      }
    }
  }

  return null
}

/**
 * Detects whether a log line contains an embedded or full JSON or XML payload.
 */
export function detectPayload(lineText: string): DetectedPayload | null {
  if (!lineText || lineText.length < 12) return null

  // Check cache
  if (payloadCache.has(lineText)) {
    return payloadCache.get(lineText)!
  }

  let result: DetectedPayload | null = null

  // 1. Try JSON extraction
  const jsonRes = extractJsonPayload(lineText)
  if (jsonRes) {
    const isArray = Array.isArray(jsonRes.parsed)
    const itemCount = isArray ? jsonRes.parsed.length : Object.keys(jsonRes.parsed).length
    const summary = isArray ? `Array (${itemCount} items)` : `Object (${itemCount} keys)`

    result = {
      type: 'json',
      rawPayload: jsonRes.raw,
      formatted: JSON.stringify(jsonRes.parsed, null, 2),
      prefixText: jsonRes.prefix,
      suffixText: jsonRes.suffix,
      parsedData: jsonRes.parsed,
      summary,
      charCount: jsonRes.raw.length
    }
  }

  // 2. If not JSON, try XML extraction
  if (!result) {
    const xmlRes = extractXmlPayload(lineText)
    if (xmlRes) {
      result = {
        type: 'xml',
        rawPayload: xmlRes.raw,
        formatted: formatXml(xmlRes.raw),
        prefixText: xmlRes.prefix,
        suffixText: xmlRes.suffix,
        summary: `XML <${xmlRes.rootTag}>`,
        charCount: xmlRes.raw.length
      }
    }
  }

  // Cache result
  if (payloadCache.size >= MAX_CACHE_SIZE) {
    const firstKey = payloadCache.keys().next().value
    if (firstKey) payloadCache.delete(firstKey)
  }
  payloadCache.set(lineText, result)

  return result
}
