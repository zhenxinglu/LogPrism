import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Button,
  Input,
  DatePicker,
  Space,
  Typography,
  Layout,
  Row,
  Col,
  message,
  ConfigProvider,
  theme,
  Radio,
  Checkbox,
  Modal,
  Progress,
  Spin,
  Dropdown,
  Drawer,
  Empty,
  Tag,
  type MenuProps
} from 'antd'
import {
  FileOutlined,
  DownOutlined,
  UpOutlined,
  RightOutlined,
  CloseOutlined,
  HistoryOutlined,
  CheckOutlined,
  DeleteOutlined,
  PushpinOutlined,
  PushpinFilled,
  EditOutlined,
  TagOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'

const { Text } = Typography
const { Content, Footer } = Layout

interface LogViewerProps {}

interface LogLineData {
  text: string
  originalIndex: number
  timestamp: string | null
}

interface BookmarkData {
  originalIndex: number
  text: string
  timestamp: string | null
  name?: string
}

const PRESET_COLORS = [
  { name: 'Blue', value: 'blue', color: '#3b82f6', borderLeftColor: '#1d4ed8' },
  { name: 'Red', value: 'red', color: '#ef4444', borderLeftColor: '#b91c1c' },
  { name: 'Green', value: 'green', color: '#10b981', borderLeftColor: '#047857' },
  { name: 'Orange', value: 'orange', color: '#f97316', borderLeftColor: '#c2410c' },
  { name: 'Purple', value: 'purple', color: '#8b5cf6', borderLeftColor: '#6d28d9' }
]

const defaultStart = dayjs('00:00:00', 'HH:mm:ss')
const defaultEnd = dayjs('23:59:59.999', 'HH:mm:ss.SSS')

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export interface TimestampFormat {
  id: string
  name: string
  example: string
  regex: RegExp
  extractTime: (matchStr: string, fullMatch: string) => string | null
}

const formatTimestamp = (raw: string): string => {
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

const TIMESTAMP_FORMATS: TimestampFormat[] = [
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

const detectTimestampFormat = (content: string): TimestampFormat | null => {
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

const LogViewer: React.FC<LogViewerProps> = () => {
  const [includeKeywords, setIncludeKeywords] = useState('')
  const [excludeKeywords, setExcludeKeywords] = useState('')
  const [isIncludeCaseSensitive, setIsIncludeCaseSensitive] = useState(false)
  const [isExcludeCaseSensitive, setIsExcludeCaseSensitive] = useState(false)
  const [startTime, setStartTime] = useState<Dayjs | null>(defaultStart)
  const [endTime, setEndTime] = useState<Dayjs | null>(defaultEnd)
  const [logContent, setLogContent] = useState('')
  const [detectedFormat, setDetectedFormat] = useState<TimestampFormat | null>(null)
  const [selectedFormatId, setSelectedFormatId] = useState<string>('auto')

  const activeFormat = useMemo((): TimestampFormat | null => {
    if (selectedFormatId === 'auto') return detectedFormat
    return TIMESTAMP_FORMATS.find((f) => f.id === selectedFormatId) || null
  }, [selectedFormatId, detectedFormat])

  const [filteredContent, setFilteredContent] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [updateTime, setUpdateTime] = useState<string | null>(null)
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<number | null>(null)
  const [timeAgoText, setTimeAgoText] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('themeMode') as 'dark' | 'light') || 'dark'
  })
  const [isInitialized, setIsInitialized] = useState(false)
  const [fontSize, setFontSize] = useState<number>(13)
  const [wordWrap, setWordWrap] = useState<boolean>(true)
  const [highlightWord, setHighlightWord] = useState<string>('')
  const [tailMode, setTailMode] = useState<boolean>(true)
  const [isTailSuspended, setIsTailSuspended] = useState<boolean>(false)
  const [hasNewLogs, setHasNewLogs] = useState<boolean>(false)
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const isUpdatingFromFileWatcherRef = useRef(false)
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false)
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  // App version
  const [appVersion, setAppVersion] = useState<string>('')

  // Update check states
  const [updateModalVisible, setUpdateModalVisible] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string } | null>(null)
  const [downloadPercent, setDownloadPercent] = useState<number>(0)
  const [updateErrorMsg, setUpdateErrorMsg] = useState<string>('')

  useEffect(() => {
    // Listen to updater IPC events
    const unsubChecking = window.api.onUpdaterEvent('updater:checking', () => {
      setUpdateStatus('checking')
      setUpdateModalVisible(true)
    })

    const unsubAvailable = window.api.onUpdaterEvent('updater:available', (info) => {
      setUpdateInfo(info)
      setUpdateStatus('available')
      setUpdateModalVisible(true)
    })

    const unsubNotAvailable = window.api.onUpdaterEvent('updater:not-available', () => {
      setUpdateStatus('not-available')
      setUpdateModalVisible(true)
    })

    const unsubProgress = window.api.onUpdaterEvent('updater:progress', (progressObj) => {
      setUpdateStatus('downloading')
      setDownloadPercent(Math.round(progressObj.percent || 0))
    })

    const unsubDownloaded = window.api.onUpdaterEvent('updater:downloaded', (info) => {
      setUpdateInfo(info)
      setUpdateStatus('downloaded')
    })

    const unsubError = window.api.onUpdaterEvent('updater:error', (errorText) => {
      setUpdateErrorMsg(errorText || 'Failed to update')
      setUpdateStatus('error')
      setUpdateModalVisible(true)
    })

    return () => {
      unsubChecking()
      unsubAvailable()
      unsubNotAvailable()
      unsubProgress()
      unsubDownloaded()
      unsubError()
    }
  }, [])

  const handleCheckForUpdates = async () => {
    setUpdateErrorMsg('')
    setUpdateInfo(null)
    setDownloadPercent(0)
    setUpdateStatus('checking')
    setUpdateModalVisible(true)
    try {
      await window.api.checkForUpdates()
    } catch (err) {
      setUpdateErrorMsg(err instanceof Error ? err.message : String(err))
      setUpdateStatus('error')
    }
  }

  const handleDownloadUpdate = async () => {
    setUpdateStatus('downloading')
    setDownloadPercent(0)
    try {
      await window.api.downloadUpdate()
    } catch (err) {
      setUpdateErrorMsg(err instanceof Error ? err.message : String(err))
      setUpdateStatus('error')
    }
  }

  const handleInstallUpdate = async () => {
    try {
      await window.api.quitAndInstall()
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err))
    }
  }

  // Search states
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchMatchesCount, setSearchMatchesCount] = useState(0)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1)

  // Refs to prevent keydown listener recreation
  const searchVisibleRef = useRef(false)
  const searchQueryRef = useRef('')
  const searchKeywordRef = useRef('')
  const searchMatchesCountRef = useRef(0)
  const filteredContentRef = useRef('')

  const [filteredLines, setFilteredLines] = useState<LogLineData[]>([])
  const [markedLines, setMarkedLines] = useState<Record<number, string>>({})
  const [bookmarkedLines, setBookmarkedLines] = useState<Record<number, BookmarkData>>({})
  const [bookmarksDrawerOpen, setBookmarksDrawerOpen] = useState(false)
  const [targetFlashLine, setTargetFlashLine] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    originalIndex: number
    timestamp: string | null
    lineText: string
  } | null>(null)

  const handleToggleBookmark = useCallback(
    (originalIndex: number, text: string, timestamp: string | null) => {
      const isBookmarked = !!bookmarkedLines[originalIndex]
      if (isBookmarked) {
        setBookmarkedLines((prev) => {
          const updated = { ...prev }
          delete updated[originalIndex]
          return updated
        })
        message.info(`Removed bookmark for Line #${originalIndex + 1}`)
      } else {
        setBookmarkedLines((prev) => ({
          ...prev,
          [originalIndex]: { originalIndex, text, timestamp }
        }))
        message.success(`Bookmarked Line #${originalIndex + 1}`)
      }
    },
    [bookmarkedLines]
  )

  const handleRemoveBookmark = useCallback((originalIndex: number) => {
    setBookmarkedLines((prev) => {
      const updated = { ...prev }
      delete updated[originalIndex]
      return updated
    })
  }, [])

  const handleClearAllBookmarks = useCallback(() => {
    setBookmarkedLines({})
    message.success('Cleared all bookmarks')
  }, [])

  const handleJumpToBookmark = useCallback((originalIndex: number) => {
    const container = logContainerRef.current
    if (!container) return
    const lineEl = container.querySelector(`[data-original-index="${originalIndex}"]`)
    if (lineEl) {
      lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTargetFlashLine(originalIndex)
      setTimeout(() => {
        setTargetFlashLine(null)
      }, 3000)
    } else {
      message.warning(`Line #${originalIndex + 1} is currently hidden by active filters`)
    }
  }, [])

  const [editingBookmarkIndex, setEditingBookmarkIndex] = useState<number | null>(null)
  const [editingBookmarkName, setEditingBookmarkName] = useState<string>('')
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renameTargetIndex, setRenameTargetIndex] = useState<number | null>(null)
  const [renameInputVal, setRenameInputVal] = useState<string>('')

  const handleSaveBookmarkName = useCallback((originalIndex: number, newName: string) => {
    setBookmarkedLines((prev) => {
      if (!prev[originalIndex]) return prev
      const updated = { ...prev }
      const trimmed = newName.trim()
      updated[originalIndex] = {
        ...updated[originalIndex],
        name: trimmed ? trimmed : undefined
      }
      return updated
    })
    setEditingBookmarkIndex(null)
    setEditingBookmarkName('')
    message.success('Bookmark name updated')
  }, [])

  const handleOpenRenameModal = useCallback(
    (originalIndex: number) => {
      const bm = bookmarkedLines[originalIndex]
      setRenameTargetIndex(originalIndex)
      setRenameInputVal(bm?.name || '')
      setRenameModalVisible(true)
    },
    [bookmarkedLines]
  )

  const handleConfirmRenameModal = useCallback(() => {
    if (renameTargetIndex !== null) {
      handleSaveBookmarkName(renameTargetIndex, renameInputVal)
      setRenameModalVisible(false)
      setRenameTargetIndex(null)
      setRenameInputVal('')
    }
  }, [renameTargetIndex, renameInputVal, handleSaveBookmarkName])

  useEffect(() => {
    searchVisibleRef.current = searchVisible
  }, [searchVisible])

  useEffect(() => {
    searchQueryRef.current = searchQuery
  }, [searchQuery])

  useEffect(() => {
    searchKeywordRef.current = searchKeyword
  }, [searchKeyword])

  useEffect(() => {
    searchMatchesCountRef.current = searchMatchesCount
  }, [searchMatchesCount])

  useEffect(() => {
    filteredContentRef.current = filteredContent
  }, [filteredContent])

  useEffect(() => {
    const container = logContainerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        if (e.deltaY < 0) {
          setFontSize((prev) => Math.min(prev + 1, 40))
        } else if (e.deltaY > 0) {
          setFontSize((prev) => Math.max(prev - 1, 10))
        }
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [])

  // Load settings on startup
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const version = await window.api.getAppVersion()
        setAppVersion(version)
      } catch (err) {
        console.error('Failed to get app version:', err)
      }

      try {
        const config = await window.api.getSettings()
        if (config) {
          if (config.includeKeywords !== undefined) setIncludeKeywords(config.includeKeywords)
          if (config.excludeKeywords !== undefined) setExcludeKeywords(config.excludeKeywords)
          if (config.isIncludeCaseSensitive !== undefined)
            setIsIncludeCaseSensitive(config.isIncludeCaseSensitive)
          if (config.isExcludeCaseSensitive !== undefined)
            setIsExcludeCaseSensitive(config.isExcludeCaseSensitive)
          if (config.startTime !== undefined && config.startTime !== null) {
            setStartTime(dayjs(config.startTime, 'HH:mm:ss.SSS'))
          } else if (config.startTime === null) {
            setStartTime(null)
          }
          if (config.endTime !== undefined && config.endTime !== null) {
            setEndTime(dayjs(config.endTime, 'HH:mm:ss.SSS'))
          } else if (config.endTime === null) {
            setEndTime(null)
          }
          if (config.themeMode !== undefined) setThemeMode(config.themeMode)
          if (config.fontSize !== undefined) setFontSize(config.fontSize)
          if (config.wordWrap !== undefined) setWordWrap(config.wordWrap)
          if (config.tailMode !== undefined) setTailMode(config.tailMode)
        }
      } catch (err) {
        console.error('Failed to initialize settings:', err)
      } finally {
        setIsInitialized(true)
      }
    }
    initializeSettings()
  }, [])

  // Auto-save settings on change (debounced)
  useEffect(() => {
    if (!isInitialized) return

    const saveTimer = setTimeout(() => {
      window.api.saveSettings({
        includeKeywords,
        excludeKeywords,
        isIncludeCaseSensitive,
        isExcludeCaseSensitive,
        startTime: startTime ? startTime.format('HH:mm:ss.SSS') : null,
        endTime: endTime ? endTime.format('HH:mm:ss.SSS') : null,
        themeMode,
        fontSize,
        wordWrap,
        tailMode
      })
      localStorage.setItem('themeMode', themeMode)
    }, 500)

    return () => clearTimeout(saveTimer)
  }, [
    isInitialized,
    includeKeywords,
    excludeKeywords,
    isIncludeCaseSensitive,
    isExcludeCaseSensitive,
    startTime,
    endTime,
    themeMode,
    fontSize,
    wordWrap,
    tailMode
  ])

  const isDark = themeMode === 'dark'

  const styles = {
    layout: {
      height: '100vh',
      background: isDark ? '#0f0f11' : '#f5f5f7'
    },
    filterContainer: {
      border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
      borderRadius: 8,
      padding: '6px 12px',
      marginBottom: 8,
      background: isDark ? 'rgba(24, 24, 28, 0.6)' : 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(20px)',
      boxShadow: isDark ? '0 8px 32px 0 rgba(0, 0, 0, 0.4)' : '0 4px 16px 0 rgba(0, 0, 0, 0.05)'
    },
    headerText: {
      fontSize: 14,
      color: isDark ? '#f1f5f9' : '#1e293b'
    },
    labelText: {
      minWidth: 130,
      color: isDark ? '#94a3b8' : '#64748b'
    },
    logContainer: {
      background: isDark ? '#09090b' : '#ffffff',
      color: isDark ? '#e4e4e7' : '#1e293b',
      fontFamily: 'Fira Code, JetBrains Mono, ui-monospace, monospace',
      fontSize: `${fontSize}px`,
      lineHeight: '1.5',
      flex: 1,
      overflow: 'auto',
      borderRadius: 8,
      padding: '10px 12px',
      border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.08)',
      minHeight: 0
    },
    footer: {
      background: isDark ? '#0f0f11' : '#f1f5f9',
      borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.08)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '2px 12px',
      color: isDark ? '#71717a' : '#64748b'
    },
    footerText: {
      color: isDark ? '#71717a' : '#64748b'
    },
    searchBox: {
      position: 'absolute' as const,
      top: 12,
      right: 20,
      zIndex: 1000,
      background: isDark ? 'rgba(30, 30, 35, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)',
      borderRadius: 6,
      padding: '6px 12px',
      boxShadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.5)' : '0 10px 30px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      backdropFilter: 'blur(10px)',
      animation: 'fadeIn 0.2s ease'
    }
  }

  useEffect(() => {
    const autoLoadLastFile = async () => {
      const res = await window.api.getLastFile()
      if (res) {
        if (res.recentFiles) {
          setRecentFiles(res.recentFiles)
        }
        if (res.filePath && res.content !== null) {
          setCurrentFilePath(res.filePath)
          setIsTailSuspended(false)
          setHasNewLogs(false)
          setLogContent(res.content)
        }
      }
    }
    autoLoadLastFile()
  }, [])

  useEffect(() => {
    const unsubscribe = window.api.onLogFileChanged((newContent: string): void => {
      isUpdatingFromFileWatcherRef.current = true
      setLogContent(newContent)
      const now = dayjs()
      setUpdateTime(now.format('HH:mm:ss'))
      setLastUpdateTimestamp(now.valueOf())
    })
    return (): void => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!logContent) {
      setDetectedFormat(null)
      return
    }
    const detected = detectTimestampFormat(logContent)
    setDetectedFormat(detected)
  }, [logContent])

  useEffect(() => {
    if (!lastUpdateTimestamp) {
      setTimeAgoText('')
      return
    }

    const updateAgo = (): void => {
      const diffMs = Date.now() - lastUpdateTimestamp
      const diffSec = Math.floor(diffMs / 1000)
      if (diffSec < 60) {
        setTimeAgoText(`(${diffSec} second${diffSec !== 1 ? 's' : ''} ago)`)
      } else {
        const diffMin = Math.floor(diffSec / 60)
        if (diffMin < 60) {
          setTimeAgoText(`(${diffMin} minute${diffMin !== 1 ? 's' : ''} ago)`)
        } else {
          const diffHr = Math.floor(diffMin / 60)
          setTimeAgoText(`(${diffHr} hour${diffHr !== 1 ? 's' : ''} ago)`)
        }
      }
    }

    updateAgo()
    const interval = setInterval(updateAgo, 1000)
    return (): void => clearInterval(interval)
  }, [lastUpdateTimestamp])

  const handleOpenLogFile = async (): Promise<void> => {
    const res = await window.api.openLogFile()
    if (res && res.content !== null) {
      setCurrentFilePath(res.filePath)
      setRecentFiles(res.recentFiles || [])
      setIsTailSuspended(false)
      setHasNewLogs(false)
      setLogContent(res.content)
      setFilteredContent('')
      setMatchCount(0)
      setUpdateTime(null)
      setLastUpdateTimestamp(null)
      setMarkedLines({})
      setBookmarkedLines({})
      setContextMenu(null)
    }
  }

  const handleSelectRecentFile = async (filePath: string): Promise<void> => {
    if (filePath === currentFilePath) return
    const res = await window.api.openFileByPath(filePath)
    if (res.success && res.content !== undefined) {
      setCurrentFilePath(res.filePath || filePath)
      if (res.recentFiles) {
        setRecentFiles(res.recentFiles)
      }
      setIsTailSuspended(false)
      setHasNewLogs(false)
      setLogContent(res.content)
      setFilteredContent('')
      setMatchCount(0)
      setUpdateTime(null)
      setLastUpdateTimestamp(null)
      setMarkedLines({})
      setBookmarkedLines({})
      setContextMenu(null)
    } else {
      message.error(res.error || 'Failed to open recent file. File may no longer exist.')
      const updatedList = await window.api.getRecentFiles()
      setRecentFiles(updatedList)
    }
  }

  const handleClearRecentFiles = async (): Promise<void> => {
    await window.api.clearRecentFiles()
    setRecentFiles([])
    message.success('Recent files history cleared')
  }

  const recentFilesMenuItems: MenuProps['items'] = useMemo(() => {
    if (recentFiles.length === 0) {
      return [
        {
          key: 'no-recent',
          disabled: true,
          label: <Text type="secondary">No recent files</Text>
        }
      ]
    }

    const items: MenuProps['items'] = recentFiles.map((filePath) => {
      const fileName = filePath.split(/[/\\]/).pop() || filePath
      const isActive = filePath === currentFilePath

      return {
        key: filePath,
        onClick: () => handleSelectRecentFile(filePath),
        label: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              maxWidth: 400
            }}
            title={filePath}
          >
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: isActive ? 'bold' : 'normal', fontSize: 13 }}>
                {fileName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: isDark ? '#94a3b8' : '#64748b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {filePath}
              </div>
            </div>
            {isActive && <CheckOutlined style={{ color: '#3b82f6', fontSize: 12 }} />}
          </div>
        )
      }
    })

    items.push({ type: 'divider' })
    items.push({
      key: 'clear-history',
      danger: true,
      icon: <DeleteOutlined />,
      label: 'Clear History',
      onClick: handleClearRecentFiles
    })

    return items
  }, [recentFiles, currentFilePath, isDark])

  const triggerSearch = (query: string) => {
    if (query.trim() === '') {
      setSearchKeyword('')
      setSearchMatchesCount(0)
      setCurrentMatchIndex(-1)
      return
    }

    const escapedWord = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedWord, 'gi')
    const matches = filteredContentRef.current.match(regex)
    const count = matches ? matches.length : 0

    setSearchKeyword(query)
    setSearchMatchesCount(count)
    setCurrentMatchIndex(count > 0 ? 0 : -1)
  }

  const handleCloseSearch = () => {
    setSearchVisible(false)
    setSearchKeyword('')
    setSearchMatchesCount(0)
    setCurrentMatchIndex(-1)
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    if (!val) {
      setSearchKeyword('')
      setSearchMatchesCount(0)
      setCurrentMatchIndex(-1)
    }
  }

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (searchQuery !== searchKeyword) {
        triggerSearch(searchQuery)
      } else if (searchMatchesCount > 0) {
        if (e.shiftKey) {
          setCurrentMatchIndex((prev) => (prev - 1 + searchMatchesCount) % searchMatchesCount)
        } else {
          setCurrentMatchIndex((prev) => (prev + 1) % searchMatchesCount)
        }
      }
    }
  }

  const handleSetStartTime = (timestamp: string) => {
    const parsed = dayjs(timestamp, 'HH:mm:ss.SSS')
    if (parsed.isValid()) {
      setStartTime(parsed)
      message.success(`Start time set to ${timestamp}`)
    } else {
      message.error('Invalid timestamp format')
    }
  }

  const handleSetEndTime = (timestamp: string) => {
    const parsed = dayjs(timestamp, 'HH:mm:ss.SSS')
    if (parsed.isValid()) {
      setEndTime(parsed)
      message.success(`End time set to ${timestamp}`)
    } else {
      message.error('Invalid timestamp format')
    }
  }

  const handleMarkLine = (originalIndex: number, color: string | null) => {
    setMarkedLines((prev) => {
      const updated = { ...prev }
      if (color) {
        updated[originalIndex] = color
      } else {
        delete updated[originalIndex]
      }
      return updated
    })
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLPreElement>) => {
    const target = e.target as HTMLElement
    const lineEl = target.closest('.log-line')
    if (!lineEl) return

    e.preventDefault()

    const originalIndexStr = lineEl.getAttribute('data-original-index')
    if (originalIndexStr === null) return
    const originalIndex = parseInt(originalIndexStr, 10)
    const timestamp = lineEl.getAttribute('data-timestamp') || null

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      originalIndex,
      timestamp,
      lineText: lineEl.textContent || ''
    })
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setContextMenu(null)
    const container = e.currentTarget
    if (!container) return

    // Calculate if scrolled close to the bottom (within a 15px threshold)
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 15

    if (tailMode) {
      if (isAtBottom) {
        if (isTailSuspended) {
          setIsTailSuspended(false)
          setHasNewLogs(false)
        }
      } else {
        if (!isTailSuspended) {
          setIsTailSuspended(true)
        }
      }
    }

    // Calculate button visibility (50px threshold)
    const scrollTopVal = container.scrollTop
    const scrollBottomVal = container.scrollHeight - scrollTopVal - container.clientHeight
    setShowScrollTop(scrollTopVal > 50)
    setShowScrollBottom(scrollBottomVal > 50)
  }

  const handleScrollToTop = useCallback(() => {
    setTailMode((prevTail) => {
      if (prevTail) {
        setIsTailSuspended(true)
      }
      return prevTail
    })
    const container = logContainerRef.current
    if (container) {
      container.scrollTop = 0
    }
  }, [])

  const handleScrollToBottom = useCallback(() => {
    setTailMode((prevTail) => {
      if (prevTail) {
        setIsTailSuspended(false)
        setHasNewLogs(false)
      }
      return prevTail
    })
    setTimeout(() => {
      const container = logContainerRef.current
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }, 0)
  }, [])

  const handleResumeTail = () => {
    handleScrollToBottom()
  }

  const handleTailModeChange = (checked: boolean) => {
    setTailMode(checked)
    if (checked) {
      setIsTailSuspended(false)
      setHasNewLogs(false)
    }
  }

  useEffect(() => {
    const container = logContainerRef.current
    if (!container || !filteredContent) return

    if (tailMode) {
      if (!isTailSuspended) {
        container.scrollTop = container.scrollHeight
      } else if (isUpdatingFromFileWatcherRef.current) {
        setHasNewLogs(true)
      }
    }
    // Reset file watcher update flag
    isUpdatingFromFileWatcherRef.current = false
  }, [filteredContent, tailMode, isTailSuspended, fontSize, wordWrap])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const visible = searchVisibleRef.current
      const count = searchMatchesCountRef.current

      // Ctrl+F or Cmd+F
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchVisible(true)
        setTimeout(() => {
          const inputEl = document.getElementById('search-input') as HTMLInputElement
          if (inputEl) {
            inputEl.focus()
            inputEl.select()
          }
        }, 50)
      } else if (e.key === 'F3') {
        e.preventDefault()
        if (visible) {
          const query = searchQueryRef.current
          const kw = searchKeywordRef.current
          if (query !== kw) {
            triggerSearch(query)
          } else if (count > 0) {
            if (e.shiftKey) {
              setCurrentMatchIndex((prev) => (prev - 1 + count) % count)
            } else {
              setCurrentMatchIndex((prev) => (prev + 1) % count)
            }
          }
        }
      } else if (e.key === 'Escape') {
        setContextMenu(null)
        if (visible) {
          e.preventDefault()
          handleCloseSearch()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Home') {
        const active = document.activeElement
        if (active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA') {
          e.preventDefault()
          handleScrollToTop()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'End') {
        const active = document.activeElement
        if (active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA') {
          e.preventDefault()
          handleScrollToBottom()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleScrollToTop, handleScrollToBottom])

  useEffect(() => {
    if (currentMatchIndex >= 0) {
      const activeElement = logContainerRef.current?.querySelector(
        `[data-match-index="${currentMatchIndex}"]`
      )
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
      }
    }
  }, [currentMatchIndex])

  useEffect(() => {
    if (!searchVisible || !searchKeyword || !filteredContent) {
      setSearchMatchesCount(0)
      setCurrentMatchIndex(-1)
      return
    }

    const escapedWord = searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedWord, 'gi')
    const matches = filteredContent.match(regex)
    const count = matches ? matches.length : 0

    setSearchMatchesCount(count)
    setCurrentMatchIndex((prev) => {
      if (count <= 0) return -1
      if (prev >= 0 && prev < count) return prev
      return 0
    })
  }, [filteredContent, searchKeyword, searchVisible])

  const handleDoubleClick = (): void => {
    const selection = window.getSelection()
    if (!selection) return
    const text = selection.toString().trim()
    // Verify it's a single word (no whitespace inside, not empty, and not too long)
    if (text && text.length > 0 && text.length < 100 && !/\s/.test(text)) {
      setHighlightWord(text)
    }
  }

  const handlePreClick = useCallback(
    (e: React.MouseEvent<HTMLPreElement>): void => {
      const target = e.target as HTMLElement
      const btn = target.closest('.log-bookmark-btn')
      if (btn) {
        e.stopPropagation()
        const originalIndexStr = btn.getAttribute('data-bookmark-index')
        if (originalIndexStr !== null) {
          const idx = parseInt(originalIndexStr, 10)
          const lineData = filteredLines.find((l) => l.originalIndex === idx)
          const lineEl = btn.closest('.log-line')
          const text = lineData ? lineData.text : lineEl?.textContent?.replace(/^[📌📍]\s*/, '') || ''
          const ts = lineData ? lineData.timestamp : lineEl?.getAttribute('data-timestamp') || null
          handleToggleBookmark(idx, text, ts)
        }
      }
    },
    [filteredLines, handleToggleBookmark]
  )

  useEffect(() => {
    const handleDocumentClick = (): void => {
      setContextMenu(null)
      const selection = window.getSelection()
      if (!selection || selection.toString().trim() === '') {
        setHighlightWord('')
      }
    }

    const handleWindowBlur = (): void => {
      setContextMenu(null)
    }

    document.addEventListener('click', handleDocumentClick)
    window.addEventListener('blur', handleWindowBlur)
    return (): void => {
      document.removeEventListener('click', handleDocumentClick)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  const highlightedHtml = useMemo((): string => {
    if (!logContent) return 'Please open a log file first...'

    if (searchVisible && searchKeyword) {
      const escapedWord = searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escapedWord})`, 'gi')
      const parts = filteredContent.split(regex)

      let matchIdx = 0
      return parts
        .map((part, index): string => {
          if (index % 2 === 1) {
            const isCurrent = matchIdx === currentMatchIndex
            const className = isCurrent ? 'search-match search-match-active' : 'search-match'
            const rendered = `<mark class="${className}" data-match-index="${matchIdx}">${escapeHtml(part)}</mark>`
            matchIdx++
            return rendered
          }
          return escapeHtml(part)
        })
        .join('')
    }

    if (!highlightWord) return escapeHtml(filteredContent)

    // Escape regex special characters to safely build RegExp
    const escapedWord = highlightWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escapedWord})`, 'g')
    const parts = filteredContent.split(regex)

    return parts
      .map((part, index): string => {
        if (index % 2 === 1) {
          return `<mark class="log-highlight">${escapeHtml(part)}</mark>`
        }
        return escapeHtml(part)
      })
      .join('')
  }, [filteredContent, highlightWord, logContent, searchVisible, searchKeyword, currentMatchIndex])

  // Save/restore selection range around innerHTML update to prevent losing user text selection
  const saveSelection = useCallback((): {
    startNode: Node
    startOffset: number
    endNode: Node
    endOffset: number
  } | null => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
    const pre = preRef.current
    if (!pre) return null
    const range = selection.getRangeAt(0)
    if (!pre.contains(range.commonAncestorContainer)) return null

    // Convert DOM range to text offsets relative to pre.textContent
    const getTextOffset = (node: Node, offset: number): number => {
      let textOffset = 0
      const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT)
      let current: Node | null
      while ((current = walker.nextNode()) !== null) {
        if (current === node) {
          return textOffset + offset
        }
        textOffset += (current as Text).length
      }
      return textOffset
    }

    return {
      startNode: range.startContainer,
      startOffset: getTextOffset(range.startContainer, range.startOffset),
      endNode: range.endContainer,
      endOffset: getTextOffset(range.endContainer, range.endOffset)
    }
  }, [])

  const restoreSelection = useCallback(
    (saved: { startOffset: number; endOffset: number } | null): void => {
      if (!saved) return
      const pre = preRef.current
      if (!pre) return
      const selection = window.getSelection()
      if (!selection) return

      // Find text nodes and rebuild range from text offsets
      const findNodeAtOffset = (targetOffset: number): { node: Node; offset: number } | null => {
        let textOffset = 0
        const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT)
        let current: Node | null
        while ((current = walker.nextNode()) !== null) {
          const len = (current as Text).length
          if (textOffset + len >= targetOffset) {
            return { node: current, offset: targetOffset - textOffset }
          }
          textOffset += len
        }
        return null
      }

      const start = findNodeAtOffset(saved.startOffset)
      const end = findNodeAtOffset(saved.endOffset)
      if (!start || !end) return

      try {
        const range = document.createRange()
        range.setStart(start.node, start.offset)
        range.setEnd(end.node, end.offset)
        selection.removeAllRanges()
        selection.addRange(range)
      } catch {
        // Ignore — node structure may have changed
      }
    },
    []
  )

  const renderedLinesHtml = useMemo((): string => {
    if (!logContent) return 'Please open a log file first...'
    const htmlLines = highlightedHtml.split('\n')
    return htmlLines
      .map((htmlLine, idx): string => {
        const lineData = filteredLines[idx]
        if (!lineData) return htmlLine

        const originalIndex = lineData.originalIndex
        const timestamp = lineData.timestamp

        // Determine if this line is marked
        const markColor = markedLines[originalIndex]
        const markedClass = markColor ? ` marked-${markColor}` : ''

        // Determine if this line is bookmarked
        const isBookmarked = !!bookmarkedLines[originalIndex]
        const bookmarkData = bookmarkedLines[originalIndex]
        const bookmarkedClass = isBookmarked ? ' is-bookmarked' : ''

        // Determine if this line is flashing
        const flashClass = targetFlashLine === originalIndex ? ' flash-highlight' : ''

        const bookmarkTitle = isBookmarked
          ? bookmarkData?.name
            ? `Bookmark: ${bookmarkData.name}`
            : 'Remove Bookmark (Pin)'
          : 'Bookmark Line (Pin)'

        const bookmarkBtn = `<span class="log-bookmark-btn${isBookmarked ? ' active' : ''}" title="${escapeHtml(bookmarkTitle)}" data-bookmark-index="${originalIndex}">${isBookmarked ? '📌' : '📍'}</span>`

        return `<div class="log-line${markedClass}${bookmarkedClass}${flashClass}" data-original-index="${originalIndex}" data-timestamp="${timestamp || ''}">${bookmarkBtn}${htmlLine || ' '}</div>`
      })
      .join('')
  }, [highlightedHtml, filteredLines, markedLines, bookmarkedLines, targetFlashLine, logContent])

  // Update innerHTML directly (bypassing React reconcile) while preserving selection
  useEffect(() => {
    const pre = preRef.current
    if (!pre) return

    const saved = saveSelection()
    pre.innerHTML = renderedLinesHtml
    if (saved) {
      restoreSelection(saved)
    }
  }, [renderedLinesHtml, saveSelection, restoreSelection])

  useEffect(() => {
    if (!logContent) {
      setFilteredContent('')
      setFilteredLines([])
      setMatchCount(0)
      return
    }
    const lines = logContent.split(/\r?\n/)
    // Helper function for parsing keywords: supports keywords with spaces enclosed in quotes
    const parseKeywords = (input: string): string[] => {
      const keywords: string[] = []
      const regex = /"([^"]+)"|(\S+)/g
      let match
      while ((match = regex.exec(input)) !== null) {
        const val = match[1] !== undefined ? match[1] : match[2]
        if (val) {
          keywords.push(val)
        }
      }
      return keywords
    }

    // Process keywords
    const includeArr = parseKeywords(includeKeywords)
    const excludeArr = parseKeywords(excludeKeywords)

    const targetIncludeArr = isIncludeCaseSensitive
      ? includeArr
      : includeArr.map((k) => k.toLowerCase())
    const targetExcludeArr = isExcludeCaseSensitive
      ? excludeArr
      : excludeArr.map((k) => k.toLowerCase())

    // Process time range
    const start = startTime ? startTime.format('HH:mm:ss.SSS') : '00:00:00.000'
    const end = endTime ? endTime.format('HH:mm:ss.SSS') : '23:59:59.999'

    const formatTimestamp = (raw: string): string => {
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

    interface LogEntry {
      timestamp: string | null
      lines: { text: string; originalIndex: number }[]
    }

    const entries: LogEntry[] = []
    let currentEntry: LogEntry | null = null

    lines.forEach((line, index) => {
      let ts: string | null = null
      if (activeFormat) {
        const m = line.match(activeFormat.regex)
        if (m) {
          ts = activeFormat.extractTime(m[1] || m[0], m[0])
        }
      } else {
        const fallbackRegex = /^\[?(?:\d{4}[-/]\d{2}[-/]\d{2}[\sT])?(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)/
        const m = line.match(fallbackRegex)
        if (m) {
          ts = formatTimestamp(m[1])
        }
      }

      if (ts) {
        currentEntry = {
          timestamp: ts,
          lines: [{ text: line, originalIndex: index }]
        }
        entries.push(currentEntry)
      } else {
        if (currentEntry) {
          currentEntry.lines.push({ text: line, originalIndex: index })
        } else {
          currentEntry = {
            timestamp: null,
            lines: [{ text: line, originalIndex: index }]
          }
          entries.push(currentEntry)
        }
      }
    })

    const filteredData: LogLineData[] = []

    entries.forEach((entry) => {
      // Validate time range
      if (entry.timestamp !== null) {
        if (entry.timestamp < start || entry.timestamp > end) return
      }

      const hasInclude = targetIncludeArr.length > 0
      const hasExclude = targetExcludeArr.length > 0

      if (hasInclude || hasExclude) {
        const fullText = entry.lines.map((l) => l.text).join('\n')

        // Validate include keywords
        if (hasInclude) {
          const targetIncludeText = isIncludeCaseSensitive ? fullText : fullText.toLowerCase()
          if (!targetIncludeArr.some((k) => targetIncludeText.includes(k))) return
        }

        // Validate exclude keywords
        if (hasExclude) {
          const targetExcludeText = isExcludeCaseSensitive ? fullText : fullText.toLowerCase()
          if (targetExcludeArr.some((k) => targetExcludeText.includes(k))) return
        }
      }

      entry.lines.forEach((l) => {
        filteredData.push({
          text: l.text,
          originalIndex: l.originalIndex,
          timestamp: entry.timestamp
        })
      })
    })

    setFilteredLines(filteredData)
    setFilteredContent(filteredData.map((d) => d.text).join('\n'))
    setMatchCount(filteredData.length)
  }, [
    logContent,
    includeKeywords,
    excludeKeywords,
    isIncludeCaseSensitive,
    isExcludeCaseSensitive,
    startTime,
    endTime,
    activeFormat
  ])

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
          colorBgContainer: isDark ? '#18181c' : '#ffffff',
          colorBgElevated: isDark ? '#27272a' : '#ffffff',
          colorBgLayout: isDark ? '#0f0f11' : '#f5f5f7',
          borderRadius: 8
        }
      }}
    >
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(3px); }
        }
        .log-highlight {
          background-color: ${isDark ? '#eab308' : '#fef08a'};
          color: #000000;
          border-radius: 2px;
          padding: 0 2px;
          font-weight: 500;
        }
        .search-match {
          background-color: ${isDark ? '#854d0e' : '#fef08a'};
          color: ${isDark ? '#ffffff' : '#000000'};
          border-radius: 2px;
          padding: 0 1px;
        }
        .search-match-active {
          background-color: ${isDark ? '#ea580c' : '#f97316'};
          color: #ffffff;
          font-weight: bold;
        }

        .log-line {
          display: block;
          padding: 0 4px;
          transition: background-color 0.15s ease;
          border-left: 3px solid transparent;
        }
        .log-line:hover {
          background-color: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'};
        }
        .log-line.marked-blue {
          background-color: #3b82f6;
          color: #ffffff;
          border-left-color: #1d4ed8;
        }
        .log-line.marked-red {
          background-color: #ef4444;
          color: #ffffff;
          border-left-color: #b91c1c;
        }
        .log-line.marked-green {
          background-color: #10b981;
          color: #ffffff;
          border-left-color: #047857;
        }
        .log-line.marked-orange {
          background-color: #f97316;
          color: #ffffff;
          border-left-color: #c2410c;
        }
        .log-line.marked-purple {
          background-color: #8b5cf6;
          color: #ffffff;
          border-left-color: #6d28d9;
        }
        @keyframes flashBg {
          0% { background-color: ${isDark ? 'rgba(234, 179, 8, 0.75)' : 'rgba(253, 224, 71, 0.95)'}; }
          25% { background-color: ${isDark ? 'rgba(234, 179, 8, 0.2)' : 'rgba(254, 240, 138, 0.4)'}; }
          50% { background-color: ${isDark ? 'rgba(234, 179, 8, 0.75)' : 'rgba(253, 224, 71, 0.95)'}; }
          75% { background-color: ${isDark ? 'rgba(234, 179, 8, 0.35)' : 'rgba(254, 240, 138, 0.5)'}; }
          100% { background-color: transparent; }
        }
        .log-line.flash-highlight {
          animation: flashBg 3s ease-out;
        }
        .log-bookmark-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          margin-right: 6px;
          cursor: pointer;
          opacity: 0.25;
          transition: opacity 0.15s ease, transform 0.15s ease;
          user-select: none;
          font-size: 11px;
          vertical-align: middle;
        }
        .log-line:hover .log-bookmark-btn {
          opacity: 0.7;
        }
        .log-bookmark-btn:hover {
          opacity: 1 !important;
          transform: scale(1.25);
        }
        .log-bookmark-btn.active {
          opacity: 1;
        }
        .log-line.is-bookmarked {
          border-left: 3px solid ${isDark ? '#eab308' : '#eab308'} !important;
          background-color: ${isDark ? 'rgba(234, 179, 8, 0.1)' : 'rgba(234, 179, 8, 0.08)'};
        }
        .bookmark-item {
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .bookmark-item:hover {
          border-color: ${isDark ? 'rgba(234, 179, 8, 0.5)' : '#fde047'} !important;
          box-shadow: ${isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.06)'};
          transform: translateY(-1px);
        }
        
        /* Context menu and submenu styles: enhance border outline and hover background to increase contrast against main window */
        .custom-context-menu {
          min-width: 140px;
          background: ${isDark ? 'rgba(38, 38, 44, 0.96)' : 'rgba(255, 255, 255, 0.98)'};
          backdrop-filter: blur(16px);
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)'};
          border-radius: 8px;
          padding: 4px 0;
          box-shadow: 0 12px 32px 4px rgba(0, 0, 0, ${isDark ? '0.75' : '0.18'}),
                      0 0 0 1px ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          font-size: 13px;
          color: ${isDark ? '#f4f4f5' : '#1e293b'};
          user-select: none;
        }
        .menu-item {
          padding: 8px 14px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .menu-item:hover {
          background: ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)'};
          color: ${isDark ? '#ffffff' : '#000000'};
        }
        .menu-item.disabled {
          color: ${isDark ? '#71717a' : '#9ca3af'};
          cursor: not-allowed;
        }
        .menu-item.disabled:hover {
          background: transparent;
          color: ${isDark ? '#71717a' : '#9ca3af'};
        }
        .menu-item.has-submenu::after {
          content: '▶';
          font-size: 9px;
          color: ${isDark ? '#a1a1aa' : '#94a3b8'};
          margin-left: 8px;
        }
        .menu-item.has-submenu:hover .submenu {
          display: block;
        }
        .submenu {
          display: none;
          position: absolute;
          top: -4px;
          min-width: 110px;
          background: ${isDark ? 'rgba(38, 38, 44, 0.98)' : 'rgba(255, 255, 255, 0.98)'};
          backdrop-filter: blur(16px);
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)'};
          border-radius: 8px;
          padding: 4px 0;
          box-shadow: 0 12px 32px 4px rgba(0, 0, 0, ${isDark ? '0.75' : '0.18'}),
                      0 0 0 1px ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'};
        }
        .submenu-item {
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.15s ease, color 0.15s ease;
          color: ${isDark ? '#f4f4f5' : '#1e293b'};
        }
        .submenu-item:hover {
          background: ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)'};
          color: ${isDark ? '#ffffff' : '#000000'};
        }
      `}</style>
      <Layout style={styles.layout}>
        <Content
          style={{
            padding: '2px 8px 8px 8px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            position: 'relative'
          }}
        >
          <div style={styles.filterContainer}>
            <Row gutter={[12, 8]}>
              <Col span={24}>
                <div
                  onDoubleClick={() => setIsCollapsed(!isCollapsed)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <Space size={6}>
                    {isCollapsed ? (
                      <RightOutlined
                        style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}
                      />
                    ) : (
                      <DownOutlined
                        style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}
                      />
                    )}
                    <b style={styles.headerText}>Filters</b>
                  </Space>
                  <Button
                    type="text"
                    size="small"
                    icon={isCollapsed ? <DownOutlined /> : <UpOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsCollapsed(!isCollapsed)
                    }}
                    style={{
                      color: isDark ? '#94a3b8' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                  />
                </div>
              </Col>
              {!isCollapsed && (
                <>
                  <Col span={24}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Text style={styles.labelText}>Include Keywords:</Text>
                      <Input
                        value={includeKeywords}
                        onChange={(e) => setIncludeKeywords(e.target.value)}
                        placeholder="e.g. error, warning"
                        style={{ flex: 1, marginLeft: 8 }}
                      />
                      <Button
                        type={isIncludeCaseSensitive ? 'primary' : 'default'}
                        onClick={() => setIsIncludeCaseSensitive(!isIncludeCaseSensitive)}
                        style={{ marginLeft: 8, fontWeight: 'bold' }}
                        title="Match Case"
                      >
                        Aa
                      </Button>
                    </div>
                  </Col>
                  <Col span={24}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Text style={styles.labelText}>Exclude Keywords:</Text>
                      <Input
                        value={excludeKeywords}
                        onChange={(e) => setExcludeKeywords(e.target.value)}
                        placeholder="e.g. debug, info"
                        style={{ flex: 1, marginLeft: 8 }}
                      />
                      <Button
                        type={isExcludeCaseSensitive ? 'primary' : 'default'}
                        onClick={() => setIsExcludeCaseSensitive(!isExcludeCaseSensitive)}
                        style={{ marginLeft: 8, fontWeight: 'bold' }}
                        title="Match Case"
                      >
                        Aa
                      </Button>
                    </div>
                  </Col>
                  <Col span={24}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0 8px' }}>
                      <Text style={styles.labelText}>Time Range:</Text>
                      <DatePicker.TimePicker
                        value={startTime}
                        onChange={setStartTime}
                        format="HH:mm:ss.SSS"
                        placeholder="00:00:00.000"
                        style={{ width: 150 }}
                      />
                      <span style={{ margin: '0 4px', color: isDark ? '#94a3b8' : '#64748b' }}>
                        to
                      </span>
                      <DatePicker.TimePicker
                        value={endTime}
                        onChange={setEndTime}
                        format="HH:mm:ss.SSS"
                        placeholder="23:59:59.999"
                        style={{ width: 150 }}
                      />
                      <div
                        style={{
                          marginLeft: 12,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Text style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                          Detected Format:
                        </Text>
                        <Dropdown
                          menu={{
                            items: [
                              {
                                key: 'auto',
                                label: (
                                  <span>
                                    <b>Auto Detect</b>{' '}
                                    {detectedFormat
                                      ? `(${detectedFormat.name})`
                                      : '(No format detected)'}
                                  </span>
                                ),
                                onClick: () => setSelectedFormatId('auto')
                              },
                              { type: 'divider' },
                              ...TIMESTAMP_FORMATS.map((fmt) => ({
                                key: fmt.id,
                                label: (
                                  <span>
                                    {fmt.name}{' '}
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                      e.g. {fmt.example}
                                    </Text>
                                  </span>
                                ),
                                onClick: () => setSelectedFormatId(fmt.id)
                              }))
                            ],
                            selectedKeys: [selectedFormatId]
                          }}
                          trigger={['click']}
                        >
                          <Tag
                            color={activeFormat ? 'blue' : 'default'}
                            style={{
                              cursor: 'pointer',
                              margin: 0,
                              padding: '2px 8px',
                              fontSize: 12
                            }}
                          >
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            {activeFormat ? activeFormat.name : 'Not Detected'}
                            {selectedFormatId !== 'auto' && ' (Manual)'}
                          </Tag>
                        </Dropdown>
                      </div>
                    </div>
                  </Col>


                </>
              )}
            </Row>
          </div>
          <div ref={logContainerRef} style={styles.logContainer} onScroll={handleScroll}>
            <pre
              ref={preRef}
              onClick={handlePreClick}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              style={{
                margin: 0,
                whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                wordBreak: wordWrap ? 'break-all' : 'normal'
              }}
            />
          </div>
          {contextMenu && (
            <div
              className="custom-context-menu"
              style={{
                position: 'fixed',
                left: contextMenu.x,
                top: contextMenu.y,
                zIndex: 10000
              }}
            >
              <div
                className="menu-item"
                onClick={() => {
                  handleToggleBookmark(
                    contextMenu.originalIndex,
                    contextMenu.lineText,
                    contextMenu.timestamp
                  )
                  setContextMenu(null)
                }}
              >
                <Space size={6}>
                  <span>📌</span>
                  <span>
                    {bookmarkedLines[contextMenu.originalIndex] ? 'Unpin Line' : 'Pin Line (Bookmark)'}
                  </span>
                </Space>
              </div>
              {bookmarkedLines[contextMenu.originalIndex] && (
                <div
                  className="menu-item"
                  onClick={() => {
                    handleOpenRenameModal(contextMenu.originalIndex)
                    setContextMenu(null)
                  }}
                >
                  <Space size={6}>
                    <TagOutlined style={{ color: '#eab308' }} />
                    <span>Rename Bookmark</span>
                  </Space>
                </div>
              )}
              <div
                className={`menu-item ${!contextMenu.timestamp ? 'disabled' : ''}`}
                onClick={() => {
                  if (contextMenu.timestamp) {
                    handleSetStartTime(contextMenu.timestamp)
                    setContextMenu(null)
                  }
                }}
              >
                Set as Start Time
              </div>
              <div
                className={`menu-item ${!contextMenu.timestamp ? 'disabled' : ''}`}
                onClick={() => {
                  if (contextMenu.timestamp) {
                    handleSetEndTime(contextMenu.timestamp)
                    setContextMenu(null)
                  }
                }}
              >
                Set as End Time
              </div>
              <div className="menu-item has-submenu">
                Mark this line
                <div
                  className="submenu"
                  style={{
                    left: contextMenu.x + 260 > window.innerWidth ? '-112px' : '138px'
                  }}
                >
                  {PRESET_COLORS.map((color) => {
                    const isCurrentColor = markedLines[contextMenu.originalIndex] === color.value
                    return (
                      <div
                        key={color.value}
                        className="submenu-item"
                        onClick={() => {
                          handleMarkLine(contextMenu.originalIndex, color.value)
                          setContextMenu(null)
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            width: 24,
                            height: 12,
                            borderRadius: '2px',
                            backgroundColor: color.color,
                            borderLeft: `3px solid ${color.borderLeftColor || 'transparent'}`
                          }}
                        />
                        <span style={{ flex: 1 }}>{color.name}</span>
                        {isCurrentColor && (
                          <span style={{ fontSize: 10, color: '#3b82f6' }}>✓</span>
                        )}
                      </div>
                    )
                  })}
                  <div
                    style={{
                      height: 1,
                      background: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
                      margin: '4px 0'
                    }}
                  />
                  <div
                    className="submenu-item"
                    onClick={() => {
                      handleMarkLine(contextMenu.originalIndex, null)
                      setContextMenu(null)
                    }}
                    style={{ color: isDark ? '#f87171' : '#dc2626' }}
                  >
                    Clear Mark
                  </div>
                </div>
              </div>
            </div>
          )}
          {isTailSuspended && hasNewLogs && (
            <div
              onClick={handleResumeTail}
              style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                background: isDark ? 'rgba(16, 185, 129, 0.9)' : 'rgba(5, 150, 105, 0.95)',
                backdropFilter: 'blur(8px)',
                color: '#ffffff',
                padding: '6px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
                boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                zIndex: 999,
                animation: 'fadeIn 0.2s ease',
                fontWeight: 500,
                fontSize: 12,
                userSelect: 'none',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)'
              }}
            >
              <DownOutlined style={{ animation: 'bounce 1s infinite' }} /> New logs available (Click
              to scroll down)
            </div>
          )}
          {/* Scroll Navigation Buttons */}
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              right: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              zIndex: 999
            }}
          >
            {showScrollTop && (
              <Button
                type="default"
                shape="circle"
                icon={<UpOutlined />}
                onClick={handleScrollToTop}
                style={{
                  background: isDark ? 'rgba(30, 30, 35, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  backdropFilter: 'blur(8px)',
                  color: isDark ? '#e4e4e7' : '#1e293b',
                  animation: 'fadeIn 0.2s ease',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Scroll to Top (Ctrl+Home)"
              />
            )}
            {showScrollBottom && (
              <Button
                type="default"
                shape="circle"
                icon={<DownOutlined />}
                onClick={handleScrollToBottom}
                style={{
                  background: isDark ? 'rgba(30, 30, 35, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  backdropFilter: 'blur(8px)',
                  color: isDark ? '#e4e4e7' : '#1e293b',
                  animation: 'fadeIn 0.2s ease',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Scroll to Bottom (Ctrl+End)"
              />
            )}
          </div>
          {searchVisible && (
            <div style={styles.searchBox}>
              <Input
                id="search-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                onKeyDown={handleSearchInputKeyDown}
                style={{ width: 200 }}
                size="small"
                allowClear
                suffix={
                  <span
                    style={{
                      color: isDark ? '#94a3b8' : '#64748b',
                      fontSize: 11,
                      userSelect: 'none'
                    }}
                  >
                    {searchMatchesCount > 0
                      ? `${currentMatchIndex + 1}/${searchMatchesCount}`
                      : searchQuery && searchKeyword === searchQuery
                        ? '0/0'
                        : ''}
                  </span>
                }
              />
              <Button
                type="text"
                size="small"
                icon={<UpOutlined />}
                onClick={() => {
                  if (searchMatchesCount > 0) {
                    setCurrentMatchIndex(
                      (prev) => (prev - 1 + searchMatchesCount) % searchMatchesCount
                    )
                  }
                }}
                disabled={searchMatchesCount === 0}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Previous Match (Shift+F3)"
              />
              <Button
                type="text"
                size="small"
                icon={<DownOutlined />}
                onClick={() => {
                  if (searchMatchesCount > 0) {
                    setCurrentMatchIndex((prev) => (prev + 1) % searchMatchesCount)
                  }
                }}
                disabled={searchMatchesCount === 0}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Next Match (F3)"
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCloseSearch}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Close (Esc)"
              />
            </div>
          )}
        </Content>
        <Footer style={styles.footer}>
          <Space size="middle">
            {appVersion && (
              <Text style={{ ...styles.footerText, marginRight: 8, opacity: 0.8 }}>
                v{appVersion}
              </Text>
            )}
            <Text style={styles.footerText}>Found {matchCount} matches</Text>
            {updateTime && (
              <Space size={6} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    animation: 'pulse 2s infinite'
                  }}
                />
                <Text style={{ color: isDark ? '#34d399' : '#059669', fontSize: 12 }}>
                  File updates on {updateTime} {timeAgoText}
                </Text>
              </Space>
            )}
          </Space>
          <Space size="middle" style={{ display: 'flex', alignItems: 'center' }}>
            <Button icon={<FileOutlined />} onClick={handleOpenLogFile} size="small">
              Open Log File
            </Button>
            <Dropdown menu={{ items: recentFilesMenuItems }} trigger={['click']}>
              <Button icon={<HistoryOutlined />} size="small">
                Recent Files <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
            <Button
              size="small"
              icon={
                <PushpinOutlined
                  style={{
                    color: Object.keys(bookmarkedLines).length > 0 ? '#eab308' : undefined
                  }}
                />
              }
              onClick={() => setBookmarksDrawerOpen(true)}
            >
              Bookmarks ({Object.keys(bookmarkedLines).length})
            </Button>
            <Button
              type="text"
              size="small"
              onClick={handleCheckForUpdates}
              style={{ color: isDark ? '#94a3b8' : '#475569', padding: '0 4px', fontSize: 12 }}
            >
              Check for Updates
            </Button>
            <Checkbox
              checked={tailMode}
              onChange={(e) => handleTailModeChange(e.target.checked)}
              style={{ color: isDark ? '#94a3b8' : '#475569' }}
            >
              Tail Mode
            </Checkbox>
            <Checkbox
              checked={wordWrap}
              onChange={(e) => setWordWrap(e.target.checked)}
              style={{ color: isDark ? '#94a3b8' : '#475569' }}
            >
              Word Wrap
            </Checkbox>
            <Radio.Group
              value={themeMode}
              onChange={(e) => setThemeMode(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small"
            >
              <Radio.Button value="dark">Dark</Radio.Button>
              <Radio.Button value="light">Light</Radio.Button>
            </Radio.Group>
          </Space>
        </Footer>
        <Modal
          title="Check for Updates"
          open={updateModalVisible}
          onCancel={() => setUpdateModalVisible(false)}
          footer={null}
          destroyOnClose
          styles={{
            body: {
              padding: '12px 0 0 0',
              color: isDark ? '#e4e4e7' : '#1e293b'
            }
          }}
        >
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            {updateStatus === 'checking' && (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Spin size="large" />
                <Text>Checking for updates...</Text>
              </Space>
            )}

            {updateStatus === 'available' && (
              <Space direction="vertical" size="middle" style={{ width: '100%', textAlign: 'left' }}>
                <Text strong style={{ fontSize: 16 }}>
                  A new version is available!
                </Text>
                <div>
                  <Text style={{ display: 'block' }}>
                    New Version: <strong style={{ color: '#3b82f6' }}>v{updateInfo?.version}</strong>
                  </Text>
                  {updateInfo?.releaseNotes && (
                    <div style={{
                      marginTop: 12,
                      padding: 8,
                      background: isDark ? '#18181c' : '#f5f5f7',
                      borderRadius: 4,
                      maxHeight: 150,
                      overflowY: 'auto',
                      border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                      fontSize: 12
                    }}>
                      <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>
                        {updateInfo.releaseNotes}
                      </pre>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', marginTop: 12 }}>
                  <Space>
                    <Button onClick={() => setUpdateModalVisible(false)}>Later</Button>
                    <Button type="primary" onClick={handleDownloadUpdate}>
                      Download Update
                    </Button>
                  </Space>
                </div>
              </Space>
            )}

            {updateStatus === 'not-available' && (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <span style={{ fontSize: 40, color: '#10b981' }}>✓</span>
                <Text strong style={{ fontSize: 16 }}>
                  You are on the latest version!
                </Text>
                <Text type="secondary">LogPrism v{appVersion} is up to date.</Text>
                <div style={{ textAlign: 'right', marginTop: 12, width: '100%' }}>
                  <Button type="primary" onClick={() => setUpdateModalVisible(false)}>
                    OK
                  </Button>
                </div>
              </Space>
            )}

            {updateStatus === 'downloading' && (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Text>Downloading update...</Text>
                <Progress percent={downloadPercent} status="active" />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Please do not close the application during the download.
                </Text>
              </Space>
            )}

            {updateStatus === 'downloaded' && (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <span style={{ fontSize: 40, color: '#10b981' }}>⚡</span>
                <Text strong style={{ fontSize: 16 }}>
                  Update Downloaded!
                </Text>
                <Text>The application needs to restart to apply the update.</Text>
                <div style={{ textAlign: 'right', marginTop: 12, width: '100%' }}>
                  <Space>
                    <Button onClick={() => setUpdateModalVisible(false)}>Later</Button>
                    <Button type="primary" onClick={handleInstallUpdate}>
                      Restart and Install
                    </Button>
                  </Space>
                </div>
              </Space>
            )}

            {updateStatus === 'error' && (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <span style={{ fontSize: 40, color: '#ef4444' }}>⚠</span>
                <Text strong style={{ fontSize: 16 }}>
                  Update Failed
                </Text>
                <Text type="danger" style={{ display: 'block', wordBreak: 'break-all' }}>
                  {updateErrorMsg}
                </Text>
                <div style={{ textAlign: 'right', marginTop: 12, width: '100%' }}>
                  <Space>
                    <Button onClick={() => setUpdateModalVisible(false)}>Close</Button>
                    <Button type="primary" onClick={handleCheckForUpdates}>
                      Retry
                    </Button>
                  </Space>
                </div>
              </Space>
            )}
          </div>
        </Modal>
        <Drawer
          title={
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%'
              }}
            >
              <Space size={8}>
                <PushpinFilled style={{ color: '#eab308', fontSize: 16 }} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>
                  Bookmarks & Pins ({Object.keys(bookmarkedLines).length})
                </span>
              </Space>
              {Object.keys(bookmarkedLines).length > 0 && (
                <Button
                  type="link"
                  danger
                  size="small"
                  onClick={handleClearAllBookmarks}
                  style={{ padding: 0 }}
                >
                  Clear All
                </Button>
              )}
            </div>
          }
          placement="right"
          width={400}
          onClose={() => setBookmarksDrawerOpen(false)}
          open={bookmarksDrawerOpen}
          styles={{
            body: {
              padding: '12px',
              background: isDark ? '#09090b' : '#f8fafc'
            }
          }}
        >
          {Object.keys(bookmarkedLines).length === 0 ? (
            <Empty
              description={
                <Text type="secondary" style={{ fontSize: 13 }}>
                  No bookmarks added yet. Click 📍 on any log line or right-click to pin lines.
                </Text>
              }
              style={{ marginTop: 60 }}
            />
          ) : (
            <div>
              {Object.values(bookmarkedLines)
                .sort((a, b) => a.originalIndex - b.originalIndex)
                .map((bm) => {
                  const isEditing = editingBookmarkIndex === bm.originalIndex
                  return (
                    <div
                      key={bm.originalIndex}
                      onClick={() => handleJumpToBookmark(bm.originalIndex)}
                      className="bookmark-item"
                      style={{
                        padding: '10px 12px',
                        marginBottom: 8,
                        borderRadius: 6,
                        border: isDark
                          ? '1px solid rgba(255, 255, 255, 0.08)'
                          : '1px solid rgba(0, 0, 0, 0.08)',
                        background: isDark ? '#18181c' : '#ffffff',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 6
                        }}
                      >
                        <Space size={8} wrap style={{ flex: 1, minWidth: 0 }}>
                          <Text strong style={{ fontSize: 12, color: '#eab308' }}>
                            #Line {bm.originalIndex + 1}
                          </Text>
                          {bm.timestamp && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {bm.timestamp}
                            </Text>
                          )}
                          {bm.name && !isEditing && (
                            <Tag color="warning" style={{ fontSize: 11, margin: 0 }}>
                              🏷️ {bm.name}
                            </Tag>
                          )}
                        </Space>
                        <Space size={4} onClick={(e) => e.stopPropagation()}>
                          {!isEditing ? (
                            <>
                              <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => {
                                  setEditingBookmarkIndex(bm.originalIndex)
                                  setEditingBookmarkName(bm.name || '')
                                }}
                                style={{ color: isDark ? '#94a3b8' : '#64748b' }}
                                title="Rename Bookmark"
                              />
                              <Button
                                type="text"
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemoveBookmark(bm.originalIndex)}
                                style={{ color: isDark ? '#94a3b8' : '#64748b' }}
                                title="Remove Bookmark"
                              />
                            </>
                          ) : (
                            <>
                              <Button
                                type="primary"
                                size="small"
                                icon={<CheckOutlined />}
                                onClick={() =>
                                  handleSaveBookmarkName(bm.originalIndex, editingBookmarkName)
                                }
                                title="Save Name"
                              />
                              <Button
                                type="default"
                                size="small"
                                icon={<CloseOutlined />}
                                onClick={() => {
                                  setEditingBookmarkIndex(null)
                                  setEditingBookmarkName('')
                                }}
                                title="Cancel"
                              />
                            </>
                          )}
                        </Space>
                      </div>
                      {isEditing && (
                        <div
                          style={{ marginBottom: 6 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            size="small"
                            placeholder="Enter custom bookmark name..."
                            value={editingBookmarkName}
                            onChange={(e) => setEditingBookmarkName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveBookmarkName(bm.originalIndex, editingBookmarkName)
                              } else if (e.key === 'Escape') {
                                setEditingBookmarkIndex(null)
                                setEditingBookmarkName('')
                              }
                            }}
                            autoFocus
                          />
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 12,
                          fontFamily: 'Fira Code, JetBrains Mono, monospace',
                          color: isDark ? '#e4e4e7' : '#1e293b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {bm.text || '(empty line)'}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </Drawer>
        <Modal
          title={
            <Space>
              <TagOutlined style={{ color: '#eab308' }} />
              <span>Rename Bookmark</span>
            </Space>
          }
          open={renameModalVisible}
          onOk={handleConfirmRenameModal}
          onCancel={() => {
            setRenameModalVisible(false)
            setRenameTargetIndex(null)
            setRenameInputVal('')
          }}
          destroyOnClose
        >
          <div style={{ paddingTop: 8 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
              Enter a custom name/tag for Line #{renameTargetIndex !== null ? renameTargetIndex + 1 : ''}:
            </Text>
            <Input
              placeholder="e.g. Database Timeout, Error Start"
              value={renameInputVal}
              onChange={(e) => setRenameInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmRenameModal()
                }
              }}
              autoFocus
            />
          </div>
        </Modal>
      </Layout>
    </ConfigProvider>
  )
}

export default LogViewer
