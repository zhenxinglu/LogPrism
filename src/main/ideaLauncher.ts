import { existsSync, readdirSync } from 'fs'
import { join, normalize } from 'path'
import { shell } from 'electron'
import { spawn } from 'child_process'

interface ResolveResult {
  success: boolean
  filePath?: string
  fileFound?: boolean
  reason?: 'NO_SOURCE_ROOT' | 'INVALID_SOURCE_ROOT' | 'FILE_NOT_FOUND' | 'SHELL_ERROR'
  message?: string
}

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'target',
  'build',
  'out',
  'dist',
  '.idea',
  '.gradle',
  '.mvn',
  'bin'
])

/**
 * Recursively search for target file in root and all sub-modules up to maxDepth = 30.
 * Supports exact relative package matching (e.g. com/company/pkg/MyClass.java)
 * as well as filename matching (e.g. MyClass.java).
 */
function findFileInRoot(
  dir: string,
  fileName: string,
  relClassPath?: string | null,
  depth = 0,
  maxDepth = 30
): { exactMatch: string | null; fallbackMatch: string | null } {
  let exactMatch: string | null = null
  let fallbackMatch: string | null = null

  if (depth > maxDepth) return { exactMatch: null, fallbackMatch: null }

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    const normalizedRel = relClassPath ? relClassPath.replace(/\\/g, '/').toLowerCase() : null
    const targetFileName = fileName.toLowerCase()

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue
        const res = findFileInRoot(join(dir, entry.name), fileName, relClassPath, depth + 1, maxDepth)
        if (res.exactMatch) return res
        if (!fallbackMatch && res.fallbackMatch) {
          fallbackMatch = res.fallbackMatch
        }
      } else if (entry.isFile()) {
        const entryNameLower = entry.name.toLowerCase()
        if (entryNameLower === targetFileName) {
          const fullPath = join(dir, entry.name)
          const normalizedFull = fullPath.replace(/\\/g, '/').toLowerCase()

          if (normalizedRel && normalizedRel.includes('/') && normalizedFull.endsWith(normalizedRel)) {
            return { exactMatch: fullPath, fallbackMatch: fullPath }
          }
          if (!fallbackMatch) {
            fallbackMatch = fullPath
          }
        }
      }
    }
  } catch (err) {
    // Ignore permission or access errors
  }

  return { exactMatch, fallbackMatch }
}

/**
 * Resolves the best CLI launcher (preferring idea.bat on Windows if available).
 */
export function getIdeaCliLauncher(ideaExe: string): string {
  // Direct use of idea64.exe works better for CLI options like --line
  // because idea.bat might pass them incorrectly to the JVM.
  return ideaExe
}

/**
 * Auto-detects IntelliJ IDEA executable (idea64.exe) on Windows/Linux/Mac
 */
export function detectIdeaExecutable(configuredPath?: string | null): string | null {
  if (configuredPath && configuredPath.trim() && existsSync(configuredPath.trim())) {
    return configuredPath.trim()
  }

  const candidates: string[] = []

  // Check LocalAppData JetBrains Toolbox path (Windows)
  const localAppData = process.env.LOCALAPPDATA
  if (localAppData) {
    const toolboxApps = join(localAppData, 'JetBrains', 'Toolbox', 'apps')
    if (existsSync(toolboxApps)) {
      for (const appFolder of ['IDEA-U', 'IDEA-C', 'IntelliJIDEA', 'IntelliJIDEA-Community']) {
        const fullFolder = join(toolboxApps, appFolder, 'ch-0')
        if (existsSync(fullFolder)) {
          try {
            const versions = readdirSync(fullFolder)
            for (const v of versions) {
              const binExe = join(fullFolder, v, 'bin', 'idea64.exe')
              if (existsSync(binExe)) candidates.push(binExe)
            }
          } catch (e) {}
        }
      }
    }
  }

  // Check Program Files / Program Files (x86) (Windows)
  const programFiles = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']]
  for (const pf of programFiles) {
    if (!pf) continue
    const jbDir = join(pf, 'JetBrains')
    if (existsSync(jbDir)) {
      try {
        const folders = readdirSync(jbDir)
        for (const f of folders) {
          if (f.toLowerCase().includes('intellij') || f.toLowerCase().includes('idea')) {
            const exePath = join(jbDir, f, 'bin', 'idea64.exe')
            if (existsSync(exePath)) candidates.push(exePath)
          }
        }
      } catch (e) {}
    }
  }

  if (candidates.length > 0) {
    return candidates[0]
  }

  return null
}

/**
 * Launch IDEA via CLI executable.
 */
function launchIdeaCli(ideaExe: string, targetPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cliLauncher = getIdeaCliLauncher(ideaExe)
    const normalizedTarget = normalize(targetPath)

    const args: string[] = [normalizedTarget]

    console.log('[IDEA Launcher] Executing:', cliLauncher, args.join(' '))

    try {
      const child = spawn(cliLauncher, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
      child.unref()
      child.on('error', (err) => {
        console.error('[IDEA Launcher] Failed to spawn:', err)
        resolve(false)
      })
      resolve(true)
    } catch (err) {
      console.error('[IDEA Launcher] Exception during spawn:', err)
      resolve(false)
    }
  })
}

/**
 * Resolves file path and opens it in IntelliJ IDEA using CLI or URL Scheme.
 */
export async function openInIdea(
  sourceRootPath: string | null | undefined,
  ideaExecutablePath: string | null | undefined,
  fileName?: string,
  className?: string
): Promise<ResolveResult> {
  console.log('[IDEA] openInIdea called with:', {
    sourceRootPath,
    ideaExecutablePath,
    fileName,
    className
  })

  if (!sourceRootPath || !sourceRootPath.trim()) {
    return { success: false, reason: 'NO_SOURCE_ROOT', message: 'Source root path is not set.' }
  }

  const root = normalize(sourceRootPath.trim())
  if (!existsSync(root)) {
    return {
      success: false,
      reason: 'INVALID_SOURCE_ROOT',
      message: `Source root directory does not exist: ${root}`
    }
  }

  let resolvedPath: string | null = null
  let fileFound = false

  if (fileName && fileName.trim()) {
    let relClassPath: string | null = null
    if (className && className.includes('.')) {
      const packageParts = className.split('.')
      const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '.java'
      relClassPath = packageParts.join('/') + ext
    }

    console.log('[IDEA] Searching for file in root:', { fileName, relClassPath, root })

    const { exactMatch, fallbackMatch } = findFileInRoot(root, fileName, relClassPath)
    resolvedPath = exactMatch || fallbackMatch

    if (resolvedPath) {
      fileFound = true
      console.log('[IDEA] Found source file at:', resolvedPath)
    } else {
      console.log('[IDEA] Source file not found in root:', fileName)
    }
  }

  const targetPath = resolvedPath || root

  console.log('[IDEA] Final target:', { targetPath, fileFound })

  // Prioritize CLI executable if available (configured or auto-detected)
  const ideaExe = detectIdeaExecutable(ideaExecutablePath)
  if (ideaExe) {
    console.log('[IDEA] Using CLI executable:', ideaExe)
    const cliSuccess = await launchIdeaCli(ideaExe, targetPath)
    if (cliSuccess) {
      return { success: true, filePath: targetPath, fileFound }
    }
  }

  // Fallback to URL Scheme (idea://open?file=...)
  const normalizedFile = targetPath.replace(/\\/g, '/')
  const url = `idea://open?file=${encodeURIComponent(normalizedFile)}`

  console.log('[IDEA] Trying URL scheme:', url)

  try {
    await shell.openExternal(url)
    return { success: true, filePath: targetPath, fileFound }
  } catch (urlErr) {
    console.warn('[IDEA] URL scheme failed:', urlErr)
  }

  return {
    success: false,
    reason: 'SHELL_ERROR',
    message:
      'Failed to launch IntelliJ IDEA. Please check your idea64.exe path in Source Root settings.'
  }
}
