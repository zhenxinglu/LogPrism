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
  Spin
} from 'antd'
import {
  FileOutlined,
  ReloadOutlined,
  DownOutlined,
  UpOutlined,
  RightOutlined,
  CloseOutlined
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

const LogViewer: React.FC<LogViewerProps> = () => {
  const [includeKeywords, setIncludeKeywords] = useState('')
  const [excludeKeywords, setExcludeKeywords] = useState('')
  const [isIncludeCaseSensitive, setIsIncludeCaseSensitive] = useState(false)
  const [isExcludeCaseSensitive, setIsExcludeCaseSensitive] = useState(false)
  const [startTime, setStartTime] = useState<Dayjs | null>(defaultStart)
  const [endTime, setEndTime] = useState<Dayjs | null>(defaultEnd)
  const [logContent, setLogContent] = useState('')
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
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    originalIndex: number
    timestamp: string | null
    lineText: string
  } | null>(null)

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
        setIsTailSuspended(false)
        setHasNewLogs(false)
        setLogContent(res.content)
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
    const content = await window.api.openLogFile()
    if (content !== null) {
      setIsTailSuspended(false)
      setHasNewLogs(false)
      setLogContent(content)
      setFilteredContent('')
      setMatchCount(0)
      setUpdateTime(null)
      setLastUpdateTimestamp(null)
      setMarkedLines({})
      setContextMenu(null)
    }
  }

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
    if (!logContent) return '请先打开日志文件...'

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
    if (!logContent) return '请先打开日志文件...'
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

        return `<div class="log-line${markedClass}" data-original-index="${originalIndex}" data-timestamp="${timestamp || ''}">${htmlLine || ' '}</div>`
      })
      .join('')
  }, [highlightedHtml, filteredLines, markedLines, logContent])

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
    // 关键词解析辅助函数：支持 "" 括住带空格的关键词
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

    // 关键词处理
    const includeArr = parseKeywords(includeKeywords)
    const excludeArr = parseKeywords(excludeKeywords)

    const targetIncludeArr = isIncludeCaseSensitive
      ? includeArr
      : includeArr.map((k) => k.toLowerCase())
    const targetExcludeArr = isExcludeCaseSensitive
      ? excludeArr
      : excludeArr.map((k) => k.toLowerCase())

    // 时间处理
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

    // Regex to match timestamp at line start
    const timestampRegex = /^\[?(?:\d{4}[-/]\d{2}[-/]\d{2}[\sT])?(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)/

    lines.forEach((line, index) => {
      const m = line.match(timestampRegex)
      if (m) {
        const ts = formatTimestamp(m[1])
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
      // 时间区间校验
      if (entry.timestamp !== null) {
        if (entry.timestamp < start || entry.timestamp > end) return
      }

      const hasInclude = targetIncludeArr.length > 0
      const hasExclude = targetExcludeArr.length > 0

      if (hasInclude || hasExclude) {
        const fullText = entry.lines.map((l) => l.text).join('\n')

        // 包含关键词校验
        if (hasInclude) {
          const targetIncludeText = isIncludeCaseSensitive ? fullText : fullText.toLowerCase()
          if (!targetIncludeArr.some((k) => targetIncludeText.includes(k))) return
        }

        // 排除关键词校验
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
    endTime
  ])

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
          colorBgContainer: isDark ? '#18181c' : '#ffffff',
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
        
        .custom-context-menu {
          min-width: 140px;
          background: ${isDark ? 'rgba(24, 24, 28, 0.95)' : 'rgba(255, 255, 255, 0.98)'};
          backdrop-filter: blur(12px);
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'};
          border-radius: 8px;
          padding: 4px 0;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          font-size: 13px;
          color: ${isDark ? '#e4e4e7' : '#1e293b'};
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
          background: ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'};
          color: ${isDark ? '#ffffff' : '#000000'};
        }
        .menu-item.disabled {
          color: ${isDark ? '#52525b' : '#a1a1aa'};
          cursor: not-allowed;
        }
        .menu-item.disabled:hover {
          background: transparent;
          color: ${isDark ? '#52525b' : '#a1a1aa'};
        }
        .menu-item.has-submenu::after {
          content: '▶';
          font-size: 9px;
          color: ${isDark ? '#71717a' : '#94a3b8'};
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
          background: ${isDark ? 'rgba(24, 24, 28, 0.98)' : 'rgba(255, 255, 255, 0.98)'};
          backdrop-filter: blur(12px);
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'};
          border-radius: 8px;
          padding: 4px 0;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        .submenu-item {
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.15s ease, color 0.15s ease;
          color: ${isDark ? '#e4e4e7' : '#1e293b'};
        }
        .submenu-item:hover {
          background: ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'};
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
                    title={isCollapsed ? '展开 / Expand' : '折叠 / Collapse'}
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
                        title="大小写敏感 / Match Case"
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
                        title="大小写敏感 / Match Case"
                      >
                        Aa
                      </Button>
                    </div>
                  </Col>
                  <Col span={24}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Text style={styles.labelText}>Time Range:</Text>
                      <DatePicker.TimePicker
                        value={startTime}
                        onChange={setStartTime}
                        format="HH:mm:ss.SSS"
                        placeholder="00:00:00.000"
                        style={{ width: 150, marginLeft: 8 }}
                      />
                      <span style={{ margin: '0 12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                        to
                      </span>
                      <DatePicker.TimePicker
                        value={endTime}
                        onChange={setEndTime}
                        format="HH:mm:ss.SSS"
                        placeholder="23:59:59.999"
                        style={{ width: 150 }}
                      />
                    </div>
                  </Col>

                  <Col span={24}>
                    <b style={styles.headerText}>Operations</b>
                  </Col>
                  <Col span={24}>
                    <Space size="middle">
                      <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={() => message.success('过滤结果已是最新的实时内容')}
                      >
                        Real-time Filtered
                      </Button>
                      <Button icon={<FileOutlined />} onClick={handleOpenLogFile}>
                        Open Log File
                      </Button>
                    </Space>
                  </Col>
                </>
              )}
            </Row>
          </div>
          <div ref={logContainerRef} style={styles.logContainer} onScroll={handleScroll}>
            <pre
              ref={preRef}
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
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
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
      </Layout>
    </ConfigProvider>
  )
}

export default LogViewer
