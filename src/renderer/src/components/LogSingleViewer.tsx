import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react'
import {
  Button,
  Input,
  Space,
  Typography,
  Row,
  Col,
  message,
  Radio,
  Switch,
  Dropdown,
  Drawer,
  Empty,
  Tag,
  Tooltip,
  Modal,
  DatePicker,
  type MenuProps
} from 'antd'
import {
  FileOutlined,
  DownOutlined,
  UpOutlined,
  HistoryOutlined,
  CheckOutlined,
  DeleteOutlined,
  PushpinOutlined,
  PushpinFilled,
  ClockCircleOutlined,
  BarChartOutlined,
  CloudServerOutlined,
  GlobalOutlined,
  SwapOutlined,
  TagOutlined,
  CodeOutlined,
  FolderOpenOutlined,
  CloseOutlined
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'

import { VirtualLogList, LogLineData, BookmarkData } from './VirtualLogList'
import { LogTimeline, LogLevel, detectLogLevel } from './LogTimeline'
import { SshConfig } from './RemoteLogModal'
import { parseStackReference } from '../utils/stackTraceParser'

const { Text } = Typography

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

const PRESET_COLORS = [
  { nameKey: 'contextMenu.colorBlue', defaultName: 'Blue', value: 'blue', color: '#3b82f6', borderLeftColor: '#1d4ed8' },
  { nameKey: 'contextMenu.colorRed', defaultName: 'Red', value: 'red', color: '#ef4444', borderLeftColor: '#b91c1c' },
  { nameKey: 'contextMenu.colorGreen', defaultName: 'Green', value: 'green', color: '#10b981', borderLeftColor: '#047857' },
  { nameKey: 'contextMenu.colorOrange', defaultName: 'Orange', value: 'orange', color: '#f97316', borderLeftColor: '#c2410c' },
  { nameKey: 'contextMenu.colorPurple', defaultName: 'Purple', value: 'purple', color: '#8b5cf6', borderLeftColor: '#6d28d9' }
]

const LEVEL_TOGGLE_CONFIG: Record<
  LogLevel,
  { bgSolid: string; borderSolid: string }
> = {
  ERROR: { bgSolid: '#ef4444', borderSolid: '#dc2626' },
  WARN: { bgSolid: '#f97316', borderSolid: '#ea580c' },
  INFO: { bgSolid: '#3b82f6', borderSolid: '#2563eb' },
  DEBUG: { bgSolid: '#10b981', borderSolid: '#059669' },
  OTHER: { bgSolid: '#8b5cf6', borderSolid: '#7c3aed' }
}

const DEFAULT_LOG_LEVELS: Record<LogLevel, boolean> = {
  ERROR: true,
  WARN: true,
  INFO: true,
  DEBUG: true,
  OTHER: true
}

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

export interface LogTabSession {
  id: string
  title: string
  type: 'local' | 'remote'
  filePath?: string
  remoteConfig?: SshConfig
  content: string
  totalLines: number
  fileSize: number
  updateTime: string | null
  lastUpdateTimestamp: number | null
  includeKeywords: string
  excludeKeywords: string
  isIncludeCaseSensitive: boolean
  isExcludeCaseSensitive: boolean
  startTime: Dayjs | null
  endTime: Dayjs | null
  selectedLogLevels: Record<LogLevel, boolean>
  selectedFormatId: string
  detectedFormat: TimestampFormat | null
  markedLines: Record<number, string>
  bookmarkedLines: Record<number, BookmarkData>
  highlightWord: string
  tailMode: boolean
  wordWrap: boolean
  fontSize: number
  showLineNumbers: boolean
  showTimeline: boolean
}

interface LogSingleViewerProps {
  session: LogTabSession
  isDarkMode: boolean
  currentLang: 'en' | 'zh'
  onChangeLang: (lang: 'en' | 'zh') => void
  paneLabel?: string
  allTabs?: Array<{ id: string; title: string }>
  onSelectTabForPane?: (tabId: string) => void
  onUpdateSession: (updated: Partial<LogTabSession>) => void
  onOpenLogFile: () => void
  onOpenRemoteSsh: () => void
  onSelectRecentFile: (filePath: string) => void
  recentFiles: string[]
  onClearRecentFiles: () => void
  appVersion: string
  onCheckForUpdates: () => void
  onToggleTheme: () => void
  onScrollSync?: (percentage: number) => void
  scrollTopPercentage?: number | null
}

export const LogSingleViewer: React.FC<LogSingleViewerProps> = ({
  session,
  isDarkMode,
  currentLang,
  onChangeLang,
  paneLabel,
  allTabs = [],
  onSelectTabForPane,
  onUpdateSession,
  onOpenLogFile,
  onOpenRemoteSsh,
  onSelectRecentFile,
  recentFiles,
  onClearRecentFiles,
  appVersion,
  onCheckForUpdates,
  onToggleTheme,
  onScrollSync,
  scrollTopPercentage
}) => {
  const { t } = useTranslation()

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [timeAgoText, setTimeAgoText] = useState('')
  const logContainerRef = useRef<HTMLDivElement>(null)

  const [filteredLines, setFilteredLines] = useState<LogLineData[]>([])
  const [unfilteredTimeLines, setUnfilteredTimeLines] = useState<LogLineData[]>([])
  const [matchCount, setMatchCount] = useState(0)

  const [levelCounts, setLevelCounts] = useState<Record<LogLevel, number>>({
    ERROR: 0,
    WARN: 0,
    INFO: 0,
    DEBUG: 0,
    OTHER: 0
  })

  // Bookmarks drawer & rename modal
  const [bookmarksDrawerOpen, setBookmarksDrawerOpen] = useState(false)
  const [bookmarkSearchKeyword, setBookmarkSearchKeyword] = useState('')
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renameTargetIndex, setRenameTargetIndex] = useState<number | null>(null)
  const [renameInputVal, setRenameInputVal] = useState('')
  const [targetFlashLine, setTargetFlashLine] = useState<number | null>(null)

  // Floating search box states (Ctrl+F / F3)
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1)

  const searchVisibleRef = useRef(searchVisible)
  searchVisibleRef.current = searchVisible

  const searchQueryRef = useRef(searchQuery)
  searchQueryRef.current = searchQuery

  const searchKeywordRef = useRef(searchKeyword)
  searchKeywordRef.current = searchKeyword

  const searchMatchesCount = useMemo(() => {
    if (!searchKeyword || !filteredLines || filteredLines.length === 0) return 0
    const escapedWord = searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedWord, 'gi')
    let total = 0
    for (let i = 0; i < filteredLines.length; i++) {
      const text = filteredLines[i].text || ''
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = regex.exec(text)) !== null) {
        total++
        if (m.index === regex.lastIndex) regex.lastIndex++
      }
    }
    return total
  }, [filteredLines, searchKeyword])

  const searchMatchesCountRef = useRef(searchMatchesCount)
  searchMatchesCountRef.current = searchMatchesCount

  useEffect(() => {
    if (!searchVisible || !searchKeyword) {
      setCurrentMatchIndex(-1)
      return
    }
    setCurrentMatchIndex((prev) => {
      if (searchMatchesCount <= 0) return -1
      if (prev >= 0 && prev < searchMatchesCount) return prev
      return 0
    })
  }, [searchKeyword, searchVisible, searchMatchesCount])

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    setSearchKeyword(val)
  }

  const handleCloseSearch = () => {
    setSearchVisible(false)
    setSearchQuery('')
    setSearchKeyword('')
    setCurrentMatchIndex(-1)
  }

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (searchMatchesCount > 0) {
        if (e.shiftKey) {
          setCurrentMatchIndex((prev) => (prev - 1 + searchMatchesCount) % searchMatchesCount)
        } else {
          setCurrentMatchIndex((prev) => (prev + 1) % searchMatchesCount)
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCloseSearch()
    }
  }

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
        const target = e.target as HTMLElement
        if (
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
          target.id !== 'search-input'
        ) {
          return
        }
        e.preventDefault()
        if (!visible) {
          setSearchVisible(true)
        }
        if (count > 0) {
          if (e.shiftKey) {
            setCurrentMatchIndex((prev) => (prev - 1 + count) % count)
          } else {
            setCurrentMatchIndex((prev) => (prev + 1) % count)
          }
        }
      } else if (e.key === 'Escape') {
        if (visible) {
          e.preventDefault()
          handleCloseSearch()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Source Code Root & IntelliJ IDEA integration states
  const [sourceRootPath, setSourceRootPath] = useState<string | null>(null)
  const [ideaExecutablePath, setIdeaExecutablePath] = useState<string | null>(null)
  const [isSourceRootModalOpen, setIsSourceRootModalOpen] = useState<boolean>(false)

  useEffect(() => {
    if (window.api && window.api.getIdeaConfig) {
      window.api.getIdeaConfig().then(({ sourceRootPath, ideaExecutablePath }) => {
        if (sourceRootPath) setSourceRootPath(sourceRootPath)
        if (ideaExecutablePath) setIdeaExecutablePath(ideaExecutablePath)
      })
    }
  }, [])

  const handleBrowseSourceRoot = async () => {
    const selected = await window.api.selectSourceDirectory()
    if (selected) {
      setSourceRootPath(selected)
      message.success(`${t('idea.sourceRootTitle')}: ${selected}`)
    }
  }

  const handleBrowseIdeaExecutable = async () => {
    const selected = await window.api.selectIdeaExecutable()
    if (selected) {
      setIdeaExecutablePath(selected)
      message.success(t('idea.autoDetectSuccess', { path: selected }))
    }
  }

  const handleAutoDetectIdea = async () => {
    const detected = await window.api.detectIdeaExecutable()
    if (detected) {
      setIdeaExecutablePath(detected)
      message.success(t('idea.autoDetectSuccess', { path: detected }))
    } else {
      message.warning(t('idea.autoDetectFailed'))
    }
  }

  const handleOpenInIdea = async (fileName?: string, className?: string) => {
    const result = await window.api.openInIdea({ fileName, className })
    if (result.success) {
      if (result.fileFound && fileName) {
        message.success(`Opened ${fileName} in IntelliJ IDEA`)
      } else if (fileName) {
        message.info(
          `Opened project in IntelliJ IDEA (File '${fileName}' is a 3rd-party library dependency not in source root)`
        )
      } else {
        message.success('Opened project in IntelliJ IDEA')
      }
    } else if (result.reason === 'NO_SOURCE_ROOT') {
      setIsSourceRootModalOpen(true)
    } else if (result.reason === 'INVALID_SOURCE_ROOT') {
      message.error(result.message || 'Invalid source root directory')
      setIsSourceRootModalOpen(true)
    } else {
      message.error(result.message || 'Failed to open in IntelliJ IDEA')
    }
  }

  // Context menu state & positioning
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    originalIndex: number
    timestamp: string | null
    lineText: string
  } | null>(null)

  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [contextMenuPos, setContextMenuPos] = useState<{
    left: number
    top: number
    submenuPlacement: { left: string; right: string; top: string; bottom: string }
  }>({
    left: 0,
    top: 0,
    submenuPlacement: { left: 'calc(100% - 2px)', right: 'auto', top: '-4px', bottom: 'auto' }
  })

  const isDark = isDarkMode
  const isProgrammaticScrollRef = useRef(false)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Sync scroll from external prop if provided
  useEffect(() => {
    if (scrollTopPercentage !== undefined && scrollTopPercentage !== null && logContainerRef.current) {
      const container = logContainerRef.current
      const maxScroll = container.scrollHeight - container.clientHeight
      if (maxScroll <= 0) return
      const targetScrollTop = Math.round(scrollTopPercentage * maxScroll)

      if (Math.abs(container.scrollTop - targetScrollTop) > 3) {
        isProgrammaticScrollRef.current = true
        container.scrollTop = targetScrollTop

        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false
        }, 150)
      }
    }
  }, [scrollTopPercentage])

  // Context menu boundary positioning
  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return
    const menuEl = contextMenuRef.current
    const rect = menuEl.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = contextMenu.x
    let top = contextMenu.y

    if (left + rect.width > vw - 8) left = Math.max(8, vw - rect.width - 8)
    if (top + rect.height > vh - 8) top = Math.max(8, vh - rect.height - 8)
    if (left < 8) left = 8
    if (top < 8) top = 8

    const submenuWidth = 140
    const openSubmenuLeft = left + rect.width + submenuWidth > vw - 8

    const hasSubmenuItem = menuEl.querySelector('.has-submenu') as HTMLElement | null
    let openSubmenuUp = false
    if (hasSubmenuItem) {
      const itemRect = hasSubmenuItem.getBoundingClientRect()
      const estimatedSubmenuHeight = 210
      if (itemRect.top - 4 + estimatedSubmenuHeight > vh - 8) {
        openSubmenuUp = true
      }
    }

    setContextMenuPos({
      left,
      top,
      submenuPlacement: {
        left: openSubmenuLeft ? 'auto' : 'calc(100% - 2px)',
        right: openSubmenuLeft ? 'calc(100% - 2px)' : 'auto',
        top: openSubmenuUp ? 'auto' : '-4px',
        bottom: openSubmenuUp ? '-4px' : 'auto'
      }
    })
  }, [contextMenu])

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!contextMenu) return
    const handleMouseDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu])

  // Active timestamp format calculation
  const activeFormat = useMemo((): TimestampFormat | null => {
    if (session.selectedFormatId === 'auto') return session.detectedFormat
    return TIMESTAMP_FORMATS.find((f) => f.id === session.selectedFormatId) || null
  }, [session.selectedFormatId, session.detectedFormat])

  // Auto detect timestamp format when content changes
  useEffect(() => {
    if (!session.content) {
      onUpdateSession({ detectedFormat: null })
      return
    }
    const detected = detectTimestampFormat(session.content)
    onUpdateSession({ detectedFormat: detected })
  }, [session.content])

  // Time ago calculator for status bar
  useEffect(() => {
    if (!session.lastUpdateTimestamp) {
      setTimeAgoText('')
      return
    }
    const updateAgo = () => {
      const diffMs = Date.now() - session.lastUpdateTimestamp!
      const diffSec = Math.floor(diffMs / 1000)
      if (diffSec < 60) {
        setTimeAgoText(`(${diffSec}s)`)
      } else {
        const diffMin = Math.floor(diffSec / 60)
        if (diffMin < 60) {
          setTimeAgoText(`(${diffMin}m)`)
        } else {
          const diffHr = Math.floor(diffMin / 60)
          setTimeAgoText(`(${diffHr}h)`)
        }
      }
    }
    updateAgo()
    const interval = setInterval(updateAgo, 1000)
    return () => clearInterval(interval)
  }, [session.lastUpdateTimestamp])

  // Ctrl+Wheel zoom for font size
  useEffect(() => {
    const container = logContainerRef.current
    if (!container) return
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        if (e.deltaY < 0) {
          onUpdateSession({ fontSize: Math.min(session.fontSize + 1, 40) })
        } else if (e.deltaY > 0) {
          onUpdateSession({ fontSize: Math.max(session.fontSize - 1, 10) })
        }
      }
    }
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [session.fontSize, onUpdateSession])

  // Process logs with multi-line stack trace grouping & filters
  useEffect(() => {
    if (!session.content) {
      setFilteredLines([])
      setUnfilteredTimeLines([])
      setMatchCount(0)
      setLevelCounts({ ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, OTHER: 0 })
      return
    }

    const rawLines = session.content.split(/\r?\n/)
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
    setUnfilteredTimeLines(timelineData)

    // Prepare keyword lists
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

    const selectedLogLevels = session.selectedLogLevels || DEFAULT_LOG_LEVELS
    const includes = parseKeywords(session.includeKeywords || '', session.isIncludeCaseSensitive || false)
    const excludes = parseKeywords(session.excludeKeywords || '', session.isExcludeCaseSensitive || false)

    const startTimeStr = session.startTime ? session.startTime.format('HH:mm:ss.SSS') : null
    const endTimeStr = session.endTime ? session.endTime.format('HH:mm:ss.SSS') : null

    const isWithinTimeRange = (timeStr: string | null): boolean => {
      if (!timeStr) return true
      if (startTimeStr && timeStr < startTimeStr) return false
      if (endTimeStr && timeStr > endTimeStr) return false
      return true
    }

    const counts: Record<LogLevel, number> = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, OTHER: 0 }
    const resultLinesData: LogLineData[] = []
    const resultTextBlocks: string[] = []

    for (const entry of entries) {
      const fullBlockText = entry.lines.join('\n')
      const entryLevel = detectLogLevel(entry.headerLine)
      counts[entryLevel] += 1

      if (!selectedLogLevels[entryLevel]) continue
      if (!isWithinTimeRange(entry.timestamp)) continue

      if (includes.length > 0) {
        const targetText = session.isIncludeCaseSensitive
          ? fullBlockText
          : fullBlockText.toLowerCase()
        const hasMatch = includes.some((kw) => targetText.includes(kw))
        if (!hasMatch) continue
      }

      if (excludes.length > 0) {
        const targetText = session.isExcludeCaseSensitive
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

    setFilteredLines(resultLinesData)
    setMatchCount(resultTextBlocks.length)
    setLevelCounts(counts)
  }, [
    session.content,
    session.includeKeywords,
    session.excludeKeywords,
    session.isIncludeCaseSensitive,
    session.isExcludeCaseSensitive,
    session.startTime,
    session.endTime,
    session.selectedLogLevels,
    activeFormat
  ])

  // Auto-scroll to bottom when tailMode is enabled and lines update
  useEffect(() => {
    if (!session.tailMode || !logContainerRef.current || filteredLines.length === 0) {
      return
    }
    const timer = setTimeout(() => {
      if (logContainerRef.current) {
        isProgrammaticScrollRef.current = true
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
        setTimeout(() => {
          isProgrammaticScrollRef.current = false
        }, 100)
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [filteredLines, session.tailMode, session.id])

  // Toggle bookmark handler
  const handleToggleBookmark = useCallback(
    (originalIndex: number, text: string, timestamp: string | null) => {
      const isBookmarked = !!session.bookmarkedLines[originalIndex]
      const updated = { ...session.bookmarkedLines }
      if (isBookmarked) {
        delete updated[originalIndex]
        message.info(t('bookmarks.lineNum', { line: originalIndex + 1 }))
      } else {
        updated[originalIndex] = { originalIndex, text, timestamp }
        message.success(t('bookmarks.lineNum', { line: originalIndex + 1 }))
      }
      onUpdateSession({ bookmarkedLines: updated })
    },
    [session.bookmarkedLines, onUpdateSession, t]
  )

  const handleMarkLine = (originalIndex: number, colorValue: string | null) => {
    const updated = { ...session.markedLines }
    if (colorValue) {
      updated[originalIndex] = colorValue
    } else {
      delete updated[originalIndex]
    }
    onUpdateSession({ markedLines: updated })
  }

  const handleSaveBookmarkName = (originalIndex: number, name: string) => {
    const updated = { ...session.bookmarkedLines }
    if (updated[originalIndex]) {
      updated[originalIndex] = { ...updated[originalIndex], name: name.trim() || undefined }
      onUpdateSession({ bookmarkedLines: updated })
    }
  }

  const handleConfirmRenameModal = () => {
    if (renameTargetIndex !== null) {
      handleSaveBookmarkName(renameTargetIndex, renameInputVal)
      setRenameModalVisible(false)
      setRenameTargetIndex(null)
      setRenameInputVal('')
    }
  }

  // Scroll handler
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (isProgrammaticScrollRef.current) {
      return
    }

    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll > 0) {
      const isAtBottom = el.scrollTop >= maxScroll - 30
      if (!isAtBottom && session.tailMode) {
        onUpdateSession({ tailMode: false })
      } else if (isAtBottom && !session.tailMode) {
        onUpdateSession({ tailMode: true })
      }

      if (onScrollSync) {
        const percentage = el.scrollTop / maxScroll
        onScrollSync(percentage)
      }
    }
  }

  // Recent files dropdown items
  const recentFilesMenuItems: MenuProps['items'] = useMemo(() => {
    if (recentFiles.length === 0) {
      return [
        {
          key: 'no-recent',
          disabled: true,
          label: <Text type="secondary">{t('header.noRecentFiles')}</Text>
        }
      ]
    }
    const items: MenuProps['items'] = recentFiles.map((filePath) => {
      const fileName = filePath.split(/[/\\]/).pop() || filePath
      const isActive = filePath === session.filePath
      return {
        key: filePath,
        onClick: () => onSelectRecentFile(filePath),
        label: (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, maxWidth: 360 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: isActive ? 'bold' : 'normal', fontSize: 13 }}>{fileName}</div>
              <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>{filePath}</div>
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
      label: t('header.clearRecent'),
      onClick: onClearRecentFiles
    })
    return items
  }, [recentFiles, session.filePath, isDark, t, onSelectRecentFile, onClearRecentFiles])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: isDark ? '#0f0f11' : '#f5f5f7',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <style>{`
        .custom-context-menu {
          min-width: 170px;
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
          color: ${isDark ? '#f4f4f5' : '#1e293b'};
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
          min-width: 140px;
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
        .log-line.marked-blue {
          background-color: #3b82f6 !important;
          color: #ffffff !important;
          border-left: 4px solid #1d4ed8 !important;
        }
        .log-line.marked-red {
          background-color: #ef4444 !important;
          color: #ffffff !important;
          border-left: 4px solid #b91c1c !important;
        }
        .log-line.marked-green {
          background-color: #10b981 !important;
          color: #ffffff !important;
          border-left: 4px solid #047857 !important;
        }
        .log-line.marked-orange {
          background-color: #f97316 !important;
          color: #ffffff !important;
          border-left: 4px solid #c2410c !important;
        }
        .log-line.marked-purple {
          background-color: #8b5cf6 !important;
          color: #ffffff !important;
          border-left: 4px solid #6d28d9 !important;
        }
        .log-line .log-bookmark-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .log-line:hover .log-bookmark-btn:not(.active) {
          color: #faad14 !important;
          background-color: ${isDark ? 'rgba(250, 173, 20, 0.25)' : 'rgba(250, 173, 20, 0.15)'} !important;
        }
        .log-bookmark-btn.active {
          transform: scale(1.05);
        }
        .log-bookmark-btn.active:hover {
          transform: scale(1.18);
          box-shadow: 0 0 12px rgba(250, 173, 20, 0.95) !important;
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
        .log-highlight {
          background-color: ${isDark ? '#854d0e' : '#fef08a'};
          color: ${isDark ? '#ffffff' : '#000000'};
          border-radius: 2px;
          padding: 0 2px;
        }
      `}</style>

      {/* Pane Header Badge & Tab Switcher (if split view) */}
      {paneLabel && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 12px',
            backgroundColor: isDark ? '#18181c' : '#ffffff',
            borderBottom: isDark ? '1px solid #262626' : '1px solid #e8e8e8',
            fontSize: 12
          }}
        >
          <Space>
            <Tag color={paneLabel === 'Pane A' ? 'blue' : 'purple'} style={{ margin: 0, fontWeight: 600 }}>
              {paneLabel}
            </Tag>
            <Text style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#e0e0e0' : '#1f2937' }}>
              {session.title}
            </Text>
          </Space>

          {allTabs.length > 1 && onSelectTabForPane && (
            <Dropdown
              menu={{
                items: allTabs.map((tab) => ({
                  key: tab.id,
                  label: tab.title,
                  onClick: () => onSelectTabForPane(tab.id)
                }))
              }}
            >
              <Button type="text" size="small" icon={<SwapOutlined />}>
                {t('splitView.selectTabPrompt')}
              </Button>
            </Dropdown>
          )}
        </div>
      )}

      {/* Control Header Bar */}
      <div
        style={{
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
          borderRadius: 6,
          padding: '6px 12px',
          margin: '6px 8px 4px 8px',
          background: isDark ? 'rgba(24, 24, 28, 0.6)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8
        }}
      >
        <Space size="middle">
          <Button type="primary" icon={<FileOutlined />} onClick={onOpenLogFile}>
            {t('header.openFile')}
          </Button>

          <Dropdown menu={{ items: recentFilesMenuItems }} trigger={['click']}>
            <Button icon={<HistoryOutlined />}>
              {t('header.recentFiles')} <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>

          <Button icon={<CloudServerOutlined />} onClick={onOpenRemoteSsh}>
            {t('header.remoteSsh')}
          </Button>

          <Button
            icon={<CodeOutlined style={{ color: sourceRootPath ? '#3b82f6' : undefined }} />}
            onClick={() => setIsSourceRootModalOpen(true)}
            title={sourceRootPath || t('idea.sourceRootTitle')}
          >
            {t('idea.sourceRootTitle')}
          </Button>

          {session.filePath && (
            <Text style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }} ellipsis title={session.filePath}>
              {session.filePath}
            </Text>
          )}
        </Space>

        <Space size="small">
          {/* Timeline density button */}
          <Tooltip title={t('header.toggleTimeline')}>
            <Button
              type={session.showTimeline ? 'primary' : 'default'}
              size="small"
              icon={<BarChartOutlined />}
              onClick={() => onUpdateSession({ showTimeline: !session.showTimeline })}
            />
          </Tooltip>

          {/* Bookmarks Drawer button */}
          <Tooltip title={t('header.bookmarksDrawer')}>
            <Button
              size="small"
              icon={<PushpinOutlined />}
              onClick={() => setBookmarksDrawerOpen(true)}
            >
              {Object.keys(session.bookmarkedLines).length > 0 && (
                <Tag color="orange" style={{ margin: '0 0 0 4px', fontSize: 10 }}>
                  {Object.keys(session.bookmarkedLines).length}
                </Tag>
              )}
            </Button>
          </Tooltip>

          {/* Timestamp format dropdown */}
          <Dropdown
            menu={{
              items: [
                {
                  key: 'auto',
                  label: `${t('header.autoDetected')} ${session.detectedFormat ? `(${session.detectedFormat.name})` : ''}`,
                  onClick: () => onUpdateSession({ selectedFormatId: 'auto' })
                },
                { type: 'divider' },
                ...TIMESTAMP_FORMATS.map((fmt) => ({
                  key: fmt.id,
                  label: `${fmt.name} - e.g. ${fmt.example}`,
                  onClick: () => onUpdateSession({ selectedFormatId: fmt.id })
                }))
              ]
            }}
          >
            <Button size="small" icon={<ClockCircleOutlined />}>
              {activeFormat ? activeFormat.name : t('header.timestampFormat')} <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>

          {/* Language Switch */}
          <Dropdown
            menu={{
              items: [
                { key: 'en', label: 'English', onClick: () => onChangeLang('en') },
                { key: 'zh', label: '中文 (Chinese)', onClick: () => onChangeLang('zh') }
              ]
            }}
          >
            <Button size="small" icon={<GlobalOutlined />}>
              {currentLang === 'zh' ? '中文' : 'EN'}
            </Button>
          </Dropdown>
        </Space>
      </div>

      {/* Density Timeline */}
      {session.showTimeline && unfilteredTimeLines.length > 0 && (
        <div style={{ margin: '0 8px 4px 8px' }}>
          <LogTimeline
            lines={unfilteredTimeLines}
            startTime={session.startTime}
            endTime={session.endTime}
            selectedLogLevels={session.selectedLogLevels || DEFAULT_LOG_LEVELS}
            onSelectTimeRange={(start, end) => {
              onUpdateSession({ startTime: start, endTime: end })
            }}
            onResetTimeRange={() => {
              onUpdateSession({ startTime: null, endTime: null })
            }}
            isDark={isDark}
          />
        </div>
      )}

      {/* Filter Panel */}
      <div
        style={{
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
          borderRadius: 6,
          padding: isCollapsed ? '4px 12px' : '8px 12px',
          margin: '0 8px 6px 8px',
          background: isDark ? 'rgba(24, 24, 28, 0.6)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)'
        }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onDoubleClick={() => setIsCollapsed(!isCollapsed)}
        >
          <Space>
            <Text style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#f1f5f9' : '#1e293b' }}>
              {t('header.toggleFilterPanel')}
            </Text>
          </Space>
          <Button
            type="text"
            size="small"
            icon={isCollapsed ? <DownOutlined /> : <UpOutlined />}
            onClick={() => setIsCollapsed(!isCollapsed)}
          />
        </div>

        {!isCollapsed && (
          <Row gutter={[12, 8]} style={{ marginTop: 6 }}>
            {/* Include Keywords */}
            <Col xs={24} sm={12} lg={8}>
              <Space direction="vertical" style={{ width: '100%' }} size={2}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                    {t('filter.includeKeywords')}
                  </Text>
                  <Space size={4} align="center">
                    <Switch
                      size="small"
                      checked={session.isIncludeCaseSensitive}
                      onChange={(checked) => onUpdateSession({ isIncludeCaseSensitive: checked })}
                    />
                    <Text style={{ fontSize: 11, color: session.isIncludeCaseSensitive ? (isDark ? '#e2e8f0' : '#1e293b') : (isDark ? '#94a3b8' : '#64748b') }}>
                      {t('filter.caseSensitive')}
                    </Text>
                  </Space>
                </div>
                <Input
                  size="small"
                  placeholder={t('filter.includePlaceholder')}
                  value={session.includeKeywords}
                  onChange={(e) => onUpdateSession({ includeKeywords: e.target.value })}
                  allowClear
                />
              </Space>
            </Col>

            {/* Exclude Keywords */}
            <Col xs={24} sm={12} lg={8}>
              <Space direction="vertical" style={{ width: '100%' }} size={2}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                    {t('filter.excludeKeywords')}
                  </Text>
                  <Space size={4} align="center">
                    <Switch
                      size="small"
                      checked={session.isExcludeCaseSensitive}
                      onChange={(checked) => onUpdateSession({ isExcludeCaseSensitive: checked })}
                    />
                    <Text style={{ fontSize: 11, color: session.isExcludeCaseSensitive ? (isDark ? '#e2e8f0' : '#1e293b') : (isDark ? '#94a3b8' : '#64748b') }}>
                      {t('filter.caseSensitive')}
                    </Text>
                  </Space>
                </div>
                <Input
                  size="small"
                  placeholder={t('filter.excludePlaceholder')}
                  value={session.excludeKeywords}
                  onChange={(e) => onUpdateSession({ excludeKeywords: e.target.value })}
                  allowClear
                />
              </Space>
            </Col>

            {/* Time Range Filter */}
            <Col xs={24} sm={24} lg={12}>
              <Space direction="vertical" style={{ width: '100%' }} size={2}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                    {t('filter.timeRange')}
                  </Text>
                  {(session.startTime || session.endTime) && (
                    <Button
                      size="small"
                      type="link"
                      onClick={() => onUpdateSession({ startTime: null, endTime: null })}
                      style={{ fontSize: 11, padding: 0 }}
                    >
                      {t('filter.resetTime')}
                    </Button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DatePicker.TimePicker
                    size="small"
                    value={session.startTime}
                    onChange={(val) => onUpdateSession({ startTime: val })}
                    format="HH:mm:ss.SSS"
                    placeholder="00:00:00.000"
                    style={{ flex: 1 }}
                  />
                  <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>~</span>
                  <DatePicker.TimePicker
                    size="small"
                    value={session.endTime}
                    onChange={(val) => onUpdateSession({ endTime: val })}
                    format="HH:mm:ss.SSS"
                    placeholder="23:59:59.999"
                    style={{ flex: 1 }}
                  />
                </div>
              </Space>
            </Col>

            {/* Log Levels Checkboxes */}
            <Col xs={24} sm={24} lg={12}>
              <Space direction="vertical" style={{ width: '100%' }} size={2}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                    {t('filter.logLevels')}
                  </Text>
                  <Space size={4}>
                    <Button
                      size="small"
                      type="link"
                      onClick={() =>
                        onUpdateSession({
                          selectedLogLevels: { ERROR: true, WARN: true, INFO: true, DEBUG: true, OTHER: true }
                        })
                      }
                      style={{ fontSize: 11, padding: 0 }}
                    >
                      All
                    </Button>
                    <Button
                      size="small"
                      type="link"
                      onClick={() =>
                        onUpdateSession({
                          selectedLogLevels: { ERROR: true, WARN: true, INFO: false, DEBUG: false, OTHER: false }
                        })
                      }
                      style={{ fontSize: 11, padding: 0, color: '#ef4444' }}
                    >
                      Errors & Warns
                    </Button>
                    <Button
                      size="small"
                      type="link"
                      onClick={() =>
                        onUpdateSession({
                          selectedLogLevels: { ERROR: false, WARN: false, INFO: false, DEBUG: false, OTHER: false }
                        })
                      }
                      style={{ fontSize: 11, padding: 0, color: isDark ? '#a1a1aa' : '#64748b' }}
                    >
                      {t('filter.clearFilters')}
                    </Button>
                  </Space>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['ERROR', 'WARN', 'INFO', 'DEBUG', 'OTHER'] as LogLevel[]).map((lvl) => {
                    const currentLogLevels = session.selectedLogLevels || DEFAULT_LOG_LEVELS
                    const isSelected = !!currentLogLevels[lvl]
                    const cfg = LEVEL_TOGGLE_CONFIG[lvl]
                    return (
                      <Button
                        key={lvl}
                        size="small"
                        icon={isSelected ? <CheckOutlined style={{ fontSize: 11 }} /> : null}
                        onClick={() =>
                          onUpdateSession({
                            selectedLogLevels: { ...currentLogLevels, [lvl]: !isSelected }
                          })
                        }
                        style={{
                          fontSize: 11,
                          height: 24,
                          padding: '0 10px',
                          borderRadius: 12,
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected
                            ? '#ffffff'
                            : isDark ? '#94a3b8' : '#64748b',
                          backgroundColor: isSelected
                            ? cfg.bgSolid
                            : isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                          borderColor: isSelected
                            ? cfg.borderSolid
                            : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                          boxShadow: isSelected
                            ? `0 2px 6px ${cfg.bgSolid}40`
                            : 'none',
                          opacity: isSelected ? 1 : 0.6,
                          transition: 'all 0.15s ease-in-out'
                        }}
                      >
                        {lvl} ({levelCounts[lvl] || 0})
                      </Button>
                    )
                  })}
                </div>
              </Space>
            </Col>
          </Row>
        )}
      </div>

      {/* Main Log Display Container Wrapper */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          position: 'relative',
          margin: '0 8px 6px 8px'
        }}
      >
        <VirtualLogList
          lines={filteredLines}
          fontSize={session.fontSize}
          wordWrap={session.wordWrap}
          showLineNumbers={session.showLineNumbers}
          maxLineDigits={Math.max(String(session.totalLines || filteredLines.length).length, 3)}
          highlightWord={session.highlightWord}
          searchKeyword={searchKeyword}
          currentMatchIndex={currentMatchIndex}
          markedLines={session.markedLines || {}}
          bookmarkedLines={session.bookmarkedLines || {}}
          targetFlashLine={targetFlashLine}
          onToggleBookmark={handleToggleBookmark}
          onContextMenu={(e, originalIndex, timestamp, text) => {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, originalIndex, timestamp, lineText: text })
          }}
          onScroll={handleScroll}
          containerRef={logContainerRef}
          isDark={isDark}
        />

        {/* Floating Search Box (Ctrl+F / F3) */}
        {searchVisible && (
          <div
            style={{
              position: 'absolute',
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
              gap: 6,
              backdropFilter: 'blur(8px)'
            }}
          >
            <Input
              id="search-input"
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyDown={handleSearchInputKeyDown}
              style={{ width: 220 }}
              size="small"
              allowClear
              autoFocus
              suffix={
                <span
                  style={{
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: 11,
                    userSelect: 'none'
                  }}
                >
                  {searchMatchesCount > 0
                    ? t('search.matchCount', {
                        current: currentMatchIndex + 1,
                        total: searchMatchesCount
                      })
                    : searchQuery && searchKeyword === searchQuery
                      ? t('search.noMatches')
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
              title={t('search.prevMatch')}
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
              title={t('search.nextMatch')}
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={handleCloseSearch}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={t('search.closeSearch')}
            />
          </div>
        )}
      </div>

      {/* Bookmarks Drawer */}
      <Drawer
        title={t('bookmarks.title')}
        placement="right"
        open={bookmarksDrawerOpen}
        onClose={() => setBookmarksDrawerOpen(false)}
        width={360}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
          <Input
            placeholder={t('bookmarks.searchPlaceholder')}
            value={bookmarkSearchKeyword}
            onChange={(e) => setBookmarkSearchKeyword(e.target.value)}
            allowClear
          />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {Object.keys(session.bookmarkedLines || {}).length === 0 ? (
              <Empty description={t('bookmarks.noBookmarks')} />
            ) : (
              Object.values(session.bookmarkedLines || {})
                .filter((bm) =>
                  bookmarkSearchKeyword
                    ? (bm.name || '').toLowerCase().includes(bookmarkSearchKeyword.toLowerCase()) ||
                      bm.text.toLowerCase().includes(bookmarkSearchKeyword.toLowerCase())
                    : true
                )
                .map((bm) => (
                  <div
                    key={bm.originalIndex}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
                      marginBottom: 8,
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setTargetFlashLine(bm.originalIndex)
                      setTimeout(() => setTargetFlashLine(null), 2000)
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Tag color="orange">#{bm.originalIndex + 1}</Tag>
                      {bm.name && <Tag color="blue">{bm.name}</Tag>}
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleBookmark(bm.originalIndex, bm.text, bm.timestamp)
                        }}
                      />
                    </div>
                    <Text style={{ fontSize: 11, marginTop: 4 }} ellipsis title={bm.text}>
                      {bm.text}
                    </Text>
                  </div>
                ))
            )}
          </div>
        </div>
      </Drawer>

      {/* Rename Bookmark Modal */}
      <Modal
        title={
          <Space>
            <TagOutlined style={{ color: '#eab308' }} />
            <span>{t('bookmarks.editLabelTitle')}</span>
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
            {t('bookmarks.lineNum', {
              line: renameTargetIndex !== null ? renameTargetIndex + 1 : ''
            })}
            :
          </Text>
          <Input
            placeholder={t('bookmarks.editLabelPlaceholder')}
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

      {/* Source Root Modal for IntelliJ IDEA */}
      <Modal
        title={
          <Space>
            <CodeOutlined style={{ color: '#3b82f6' }} />
            <span>{t('idea.sourceRootTitle')}</span>
          </Space>
        }
        open={isSourceRootModalOpen}
        onCancel={() => setIsSourceRootModalOpen(false)}
        onOk={() => setIsSourceRootModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsSourceRootModalOpen(false)}>
            {t('common.confirm')}
          </Button>
        ]}
        destroyOnClose
        width={560}
      >
        <Space direction="vertical" style={{ width: '100%', paddingTop: 8 }} size="middle">
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('idea.noSourceRootMsg')}
          </Text>
          <div>
            <Text strong style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>
              {t('idea.sourceRootTitle')}
            </Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                value={sourceRootPath || ''}
                onChange={(e) => {
                  const val = e.target.value
                  setSourceRootPath(val)
                  window.api.setIdeaConfig({ sourceRootPath: val })
                }}
                placeholder={t('idea.sourceRootPlaceholder')}
                style={{ flex: 1 }}
              />
              <Button icon={<FolderOpenOutlined />} onClick={handleBrowseSourceRoot}>
                {t('idea.browse')}
              </Button>
            </div>
          </div>

          <div>
            <Text strong style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>
              {t('idea.exePathTitle')}
            </Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                value={ideaExecutablePath || ''}
                onChange={(e) => {
                  const val = e.target.value
                  setIdeaExecutablePath(val)
                  window.api.setIdeaConfig({ ideaExecutablePath: val })
                }}
                placeholder={t('idea.exePathPlaceholder')}
                style={{ flex: 1 }}
              />
              <Button icon={<FileOutlined />} onClick={handleBrowseIdeaExecutable}>
                {t('idea.browse')}
              </Button>
              <Button type="dashed" onClick={handleAutoDetectIdea}>
                {t('idea.autoDetect')}
              </Button>
            </div>
          </div>
        </Space>
      </Modal>

      {/* Row Right-Click Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="custom-context-menu"
          style={{
            position: 'fixed',
            left: contextMenuPos.left,
            top: contextMenuPos.top,
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Pin Line / Add Bookmark */}
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
              <PushpinFilled style={{ color: '#faad14' }} />
              <span>
                {(session.bookmarkedLines || {})[contextMenu.originalIndex]
                  ? t('contextMenu.unpinLine')
                  : t('contextMenu.pinLine')}
              </span>
            </Space>
          </div>

          {/* Rename Bookmark (if bookmarked) */}
          {(session.bookmarkedLines || {})[contextMenu.originalIndex] && (
            <div
              className="menu-item"
              onClick={() => {
                const bm = (session.bookmarkedLines || {})[contextMenu.originalIndex]
                setRenameTargetIndex(contextMenu.originalIndex)
                setRenameInputVal(bm?.name || '')
                setRenameModalVisible(true)
                setContextMenu(null)
              }}
            >
              <Space size={6}>
                <TagOutlined style={{ color: '#eab308' }} />
                <span>{t('contextMenu.renameBookmark')}</span>
              </Space>
            </div>
          )}

          {/* Set as Start Time */}
          <div
            className={`menu-item ${!contextMenu.timestamp ? 'disabled' : ''}`}
            onClick={() => {
              if (contextMenu.timestamp) {
                const parsed = dayjs(contextMenu.timestamp, 'HH:mm:ss.SSS')
                if (parsed.isValid()) {
                  onUpdateSession({ startTime: parsed })
                  message.success(`${t('contextMenu.setStartTime')}: ${contextMenu.timestamp}`)
                }
                setContextMenu(null)
              }
            }}
          >
            {t('contextMenu.setStartTime')}
          </div>

          {/* Set as End Time */}
          <div
            className={`menu-item ${!contextMenu.timestamp ? 'disabled' : ''}`}
            onClick={() => {
              if (contextMenu.timestamp) {
                const parsed = dayjs(contextMenu.timestamp, 'HH:mm:ss.SSS')
                if (parsed.isValid()) {
                  onUpdateSession({ endTime: parsed })
                  message.success(`${t('contextMenu.setEndTime')}: ${contextMenu.timestamp}`)
                }
                setContextMenu(null)
              }
            }}
          >
            {t('contextMenu.setEndTime')}
          </div>

          {/* Mark Highlight Submenu */}
          <div className="menu-item has-submenu">
            {t('contextMenu.markHighlight')}
            <div
              className="submenu"
              style={{
                left: contextMenuPos.submenuPlacement.left,
                right: contextMenuPos.submenuPlacement.right,
                top: contextMenuPos.submenuPlacement.top,
                bottom: contextMenuPos.submenuPlacement.bottom
              }}
            >
              {PRESET_COLORS.map((color) => {
                const isCurrentColor = session.markedLines[contextMenu.originalIndex] === color.value
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
                    <span style={{ flex: 1 }}>
                      {t(color.nameKey, { defaultValue: color.defaultName })}
                    </span>
                    {isCurrentColor && <span style={{ fontSize: 10, color: '#3b82f6' }}>✓</span>}
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
                {t('contextMenu.clearMark')}
              </div>
            </div>
          </div>

          {/* Open in IntelliJ IDEA */}
          {(() => {
            const stackRef = parseStackReference(contextMenu.lineText)
            const menuLabel = stackRef
              ? t('contextMenu.openInIdea', { file: stackRef.fileName })
              : t('contextMenu.openInIdeaProject')

            return (
              <>
                <div
                  style={{
                    height: 1,
                    background: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
                    margin: '4px 0'
                  }}
                />
                <div
                  className="menu-item"
                  onClick={() => {
                    handleOpenInIdea(stackRef?.fileName, stackRef?.className)
                    setContextMenu(null)
                  }}
                >
                  <Space size={6}>
                    <CodeOutlined style={{ color: '#3b82f6' }} />
                    <span>{menuLabel}</span>
                  </Space>
                </div>
                <div
                  className="menu-item"
                  onClick={() => {
                    setIsSourceRootModalOpen(true)
                    setContextMenu(null)
                  }}
                >
                  <Space size={6}>
                    <FolderOpenOutlined style={{ color: '#eab308' }} />
                    <span>{t('contextMenu.configureSourceRoot')}</span>
                  </Space>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* Status Bar */}
      <div
        style={{
          background: isDark ? '#0f0f11' : '#f1f5f9',
          borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '2px 12px',
          fontSize: 11,
          color: isDark ? '#71717a' : '#64748b'
        }}
      >
        <Space size="middle">
          <span>v{appVersion}</span>
          <span>{t('statusBar.matchesFound', { count: matchCount })}</span>
          {session.updateTime && (
            <Tag color="cyan" style={{ margin: 0, fontSize: 10 }}>
              {t('statusBar.fileUpdated', { time: session.updateTime, ago: timeAgoText })}
            </Tag>
          )}
        </Space>

        <Space size="middle" align="center">
          <Space size={4} align="center">
            <Switch
              size="small"
              checked={session.tailMode}
              onChange={(checked) => onUpdateSession({ tailMode: checked })}
            />
            <span style={{ fontSize: 11, color: session.tailMode ? (isDark ? '#e4e4e7' : '#1e293b') : (isDark ? '#71717a' : '#64748b') }}>
              {t('statusBar.tailMode')}
            </span>
          </Space>
          <Space size={4} align="center">
            <Switch
              size="small"
              checked={session.wordWrap}
              onChange={(checked) => onUpdateSession({ wordWrap: checked })}
            />
            <span style={{ fontSize: 11, color: session.wordWrap ? (isDark ? '#e4e4e7' : '#1e293b') : (isDark ? '#71717a' : '#64748b') }}>
              {t('statusBar.wordWrap')}
            </span>
          </Space>
          <Radio.Group
            size="small"
            value={isDark ? 'dark' : 'light'}
            onChange={() => onToggleTheme()}
          >
            <Radio.Button value="dark">{t('statusBar.darkTheme')}</Radio.Button>
            <Radio.Button value="light">{t('statusBar.lightTheme')}</Radio.Button>
          </Radio.Group>
          <Button type="link" size="small" onClick={onCheckForUpdates} style={{ padding: 0, fontSize: 11 }}>
            {t('statusBar.checkForUpdates')}
          </Button>
        </Space>
      </div>
    </div>
  )
}
