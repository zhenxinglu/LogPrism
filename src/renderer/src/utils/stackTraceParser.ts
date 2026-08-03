export interface StackTraceReference {
  fileName: string
  className?: string
  line: number
  rawMatch: string
}

// Extensions specifically representing source code files
const CODE_EXT_PATTERN =
  'groovy|scala|java|tsx|jsx|cpp|hpp|vue|php|kt|py|ts|js|go|rs|cs|rb|c|h'

// Extensions representing data, configuration, or text files
const DATA_EXT_PATTERN =
  'properties|yaml|json|html|conf|log|txt|yml|xml|sql|ini|csv|md|sh'

/**
 * Parses code stack trace or source file references from a log line.
 * Supports Java, Kotlin, Groovy, Python, JavaScript/TypeScript, C++, Go, etc.
 *
 * Priority order:
 * 1. Java standard stacktrace: "at com.example.Service.method(Service.java:45)"
 * 2. Source file with extension AND line number: "UserService.java:45", "app.tsx:50"
 * 3. Java log format (Class:Method:Line or Class:Line): "FileLoaderFactory:loadConfigFromFiles:135"
 * 4. Qualified class with line: "com.example.service.UserService:45"
 * 5. Source file with extension (no line): "UserService.java", "app.tsx"
 * 6. Java log format (Class:Method, no line): "FileLoaderFactory:loadConfigFromFiles"
 * 7. Qualified class name (no line): "com.example.service.UserService"
 * 8. Data/config file with line number: "config.json:45"
 * 9. Data/config file (no line): "tcs-gui2.json"
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

  // 2. Source code file name with extension AND line number:
  // e.g., "UserService.java:45", "[UserService.kt:120]", "(app.tsx:50)"
  const codeFileWithLineRegex = new RegExp(
    `(?<!\\.)([a-zA-Z0-9_-]+\\.(?:${CODE_EXT_PATTERN})(?![a-zA-Z0-9_]))::?(\\d+)`,
    'i'
  )
  const codeFileWithLineMatch = lineText.match(codeFileWithLineRegex)
  if (codeFileWithLineMatch) {
    return {
      fileName: codeFileWithLineMatch[1],
      line: parseInt(codeFileWithLineMatch[2], 10),
      rawMatch: codeFileWithLineMatch[0]
    }
  }

  // 3. Colon-separated log format (common in Java frameworks):
  // e.g., "FileLoaderFactory:loadConfigFromFiles:135", "SimpleStarter:<init>:116", "ScsServer-Scs:launchServer:294"
  // ClassName starts with uppercase letter
  const colonSepRegex =
    /(?:^|[\s\[\]])([A-Z][a-zA-Z0-9_$-]*):(?:<[a-zA-Z0-9_$]+>|[a-zA-Z_$][a-zA-Z0-9_$]*):(\d+)(?=\s|$|-|,|;|\]|\))/
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
  // e.g., "SimpleStarter:116", "FileLoaderFactory:135"
  const colonClassLineRegex =
    /(?:^|[\s\[\]])([A-Z][a-zA-Z0-9_$-]{2,}):(\d+)(?=\s|$|-|,|;|\]|\))/
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

  // 4. Dotted qualified class name with line number:
  // e.g., "com.example.service.UserService:45"
  const classRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*){1,})/g
  let classMatch: RegExpExecArray | null
  while ((classMatch = classRegex.exec(lineText)) !== null) {
    const fullClass = classMatch[1]
    const parts = fullClass.split('.')
    const lastPart = parts[parts.length - 1]

    if (/^[A-Z][a-zA-Z0-9_$]*$/.test(lastPart)) {
      const remainingStr = lineText.substring(classMatch.index! + fullClass.length)
      const lineMatch = remainingStr.match(/^:(\d+)/)
      if (lineMatch) {
        return {
          fileName: `${lastPart}.java`,
          className: fullClass,
          line: parseInt(lineMatch[1], 10),
          rawMatch: `${fullClass}:${lineMatch[1]}`
        }
      }
    }
  }

  // 5. Source code file name with extension (WITHOUT line number):
  // e.g., "UserService.java", "App.tsx", "main.py"
  const codeFileRegex = new RegExp(
    `(?<!\\.)([a-zA-Z0-9_-]+\\.(?:${CODE_EXT_PATTERN})(?![a-zA-Z0-9_]))`,
    'i'
  )
  const codeFileMatch = lineText.match(codeFileRegex)
  if (codeFileMatch) {
    return {
      fileName: codeFileMatch[1],
      line: 1,
      rawMatch: codeFileMatch[0]
    }
  }

  // 6. Colon-separated without line number:
  // e.g., "UserService:processRequest", "SimpleStarter:<init>"
  const colonNoLineRegex =
    /(?:^|[\s\[\]])([A-Z][a-zA-Z0-9_$-]{2,}):(?:<[a-zA-Z0-9_$]+>|[a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s|$|-|,|;|\]|\))/
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

  // 7. Qualified class name without line number:
  // e.g., "com.example.service.UserService"
  classRegex.lastIndex = 0
  while ((classMatch = classRegex.exec(lineText)) !== null) {
    const fullClass = classMatch[1]
    const parts = fullClass.split('.')
    const lastPart = parts[parts.length - 1]

    if (/^[A-Z][a-zA-Z0-9_$]*$/.test(lastPart)) {
      return {
        fileName: `${lastPart}.java`,
        className: fullClass,
        line: 1,
        rawMatch: fullClass
      }
    }
  }

  // 8. Generic / Data file name with extension AND line number:
  // e.g., "config.json:45", "settings.xml:12"
  const dataFileWithLineRegex = new RegExp(
    `(?<!\\.)([a-zA-Z0-9_-]+\\.(?:${DATA_EXT_PATTERN})(?![a-zA-Z0-9_]))::?(\\d+)`,
    'i'
  )
  const dataFileWithLineMatch = lineText.match(dataFileWithLineRegex)
  if (dataFileWithLineMatch) {
    return {
      fileName: dataFileWithLineMatch[1],
      line: parseInt(dataFileWithLineMatch[2], 10),
      rawMatch: dataFileWithLineMatch[0]
    }
  }

  // 9. Generic / Data file name with extension (WITHOUT line number):
  // e.g., "tcs-gui2.json", "log4j2.xml", "application.yml"
  const dataFileRegex = new RegExp(
    `(?<!\\.)([a-zA-Z0-9_-]+\\.(?:${DATA_EXT_PATTERN})(?![a-zA-Z0-9_]))`,
    'i'
  )
  const dataFileMatch = lineText.match(dataFileRegex)
  if (dataFileMatch) {
    return {
      fileName: dataFileMatch[1],
      line: 1,
      rawMatch: dataFileMatch[0]
    }
  }

  return null
}
