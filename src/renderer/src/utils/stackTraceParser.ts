export interface StackTraceReference {
  fileName: string
  className?: string
  line: number
  rawMatch: string
}

/**
 * Parses code stack trace or source file references from a log line.
 * Supports Java, Kotlin, Groovy, Python, JavaScript/TypeScript, C++, Go, etc.
 *
 * Handles:
 * - Java stacktrace: "at com.example.Service.method(Service.java:45)"
 * - File reference: "UserService.java:45"
 * - Colon-separated log format: "AbstractService:methodName:185"
 * - Dotted class name: "com.example.service.UserService:45"
 * - Logger name: "c.e.service.UserService"
 */
export function parseStackReference(lineText: string): StackTraceReference | null {
  if (!lineText) return null

  // 1. Java / Kotlin standard stacktrace format:
  // e.g., "at com.example.service.UserService.getUserById(UserService.java:45)"
  const javaAtRegex =
    /at\s+([a-zA-Z0-9_$.]+)\.([a-zA-Z0-9_$]+)\s*\((?:native\s+method|([a-zA-Z0-9_$]+\.(?:java|kt|groovy|scala))(?::(\d+))?)\)/i
  const javaAtMatch = lineText.match(javaAtRegex)
  if (javaAtMatch) {
    const fullClass = javaAtMatch[1]
    const fileName = javaAtMatch[3]
    const lineNum = javaAtMatch[4] ? parseInt(javaAtMatch[4], 10) : 1
    if (fileName) {
      return {
        fileName,
        className: fullClass,
        line: lineNum,
        rawMatch: javaAtMatch[0]
      }
    }
  }

  // 2. File name with extension and optional line number:
  // e.g., "UserService.java:45", "[UserService.java:45]", "(UserService.kt:120)"
  const fileExtRegex =
    /(?<!\.)([a-zA-Z0-9_-]+\.(?:java|kt|groovy|scala|py|ts|tsx|js|jsx|vue|cpp|hpp|go|rs|cs|php|rb|html|xml|json|yml|yaml|properties|sql|sh))(?::(\d+))?/i
  const fileExtMatch = lineText.match(fileExtRegex)
  if (fileExtMatch) {
    return {
      fileName: fileExtMatch[1],
      line: fileExtMatch[2] ? parseInt(fileExtMatch[2], 10) : 1,
      rawMatch: fileExtMatch[0]
    }
  }

  // 3. Colon-separated log format (common in many Java frameworks):
  // e.g., "SimpleStarter:<init>:116", "AbstractFinNextStopManager:FireEvent:185", "UserService:processRequest:42"
  // Pattern: ClassName:methodName:lineNumber or ClassName:<init>:lineNumber (class starts with uppercase)
  const colonSepRegex =
    /(?:^|[\s\[\]])([A-Z][a-zA-Z0-9_$]*):(?:<[a-zA-Z0-9_$]+>|[a-zA-Z_$][a-zA-Z0-9_$]*):(\d+)(?=\s|$|-|,|;|\]|\))/
  const colonSepMatch = lineText.match(colonSepRegex)
  if (colonSepMatch) {
    const className = colonSepMatch[1]
    const lineNum = parseInt(colonSepMatch[2], 10)
    return {
      fileName: `${className}.java`,
      className,
      line: lineNum,
      rawMatch: colonSepMatch[0].trim()
    }
  }

  // 3b. ClassName:lineNumber directly:
  // e.g., "SimpleStarter:116"
  const colonClassLineRegex =
    /(?:^|[\s\[\]])([A-Z][a-zA-Z0-9_$]{2,}):(\d+)(?=\s|$|-|,|;|\]|\))/
  const colonClassLineMatch = lineText.match(colonClassLineRegex)
  if (colonClassLineMatch) {
    const className = colonClassLineMatch[1]
    const lineNum = parseInt(colonClassLineMatch[2], 10)
    return {
      fileName: `${className}.java`,
      className,
      line: lineNum,
      rawMatch: colonClassLineMatch[0].trim()
    }
  }

  // 4. Colon-separated without line number:
  // e.g., "UserService:processRequest", "SimpleStarter:<init>" — just class + method, no line
  const colonNoLineRegex =
    /(?:^|[\s\[\]])([A-Z][a-zA-Z0-9_$]{2,}):(?:<[a-zA-Z0-9_$]+>|[a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s|$|-|,|;|\]|\))/
  const colonNoLineMatch = lineText.match(colonNoLineRegex)
  if (colonNoLineMatch) {
    const className = colonNoLineMatch[1]
    return {
      fileName: `${className}.java`,
      className,
      line: 1,
      rawMatch: colonNoLineMatch[0].trim()
    }
  }

  // 5. Dotted qualified class name with optional line number:
  // e.g., "com.example.service.UserService:45" or "c.e.service.UserService"
  // Each segment must start with a letter. Uses matchAll to skip false positives.
  const classRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*){1,})/g
  let classMatch: RegExpExecArray | null
  while ((classMatch = classRegex.exec(lineText)) !== null) {
    const fullClass = classMatch[1]
    const parts = fullClass.split('.')
    const lastPart = parts[parts.length - 1]

    // Last part must look like a ClassName (starts with uppercase letter)
    if (/^[A-Z][a-zA-Z0-9_$]*$/.test(lastPart)) {
      const remainingStr = lineText.substring(classMatch.index! + fullClass.length)
      const lineMatch = remainingStr.match(/^:(\d+)/)
      const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : 1
      return {
        fileName: `${lastPart}.java`,
        className: fullClass,
        line: lineNum,
        rawMatch: fullClass
      }
    }
  }

  return null
}
