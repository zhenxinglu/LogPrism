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
  Popconfirm,
  DatePicker,
  InputNumber,
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
  CloseOutlined,
  VerticalRightOutlined,
  VerticalLeftOutlined,
  HighlightOutlined,
  EditOutlined,
  BranchesOutlined,
  CopyOutlined,
  ClearOutlined,
  KeyOutlined
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'

import { VirtualLogList, BookmarkData } from './VirtualLogList'
import { LogTimeline, LogLevel } from './LogTimeline'
import { SshConfig } from './RemoteLogModal'
import { parseStackReference } from '../utils/stackTraceParser'
import { KeywordHistoryInput } from './KeywordHistoryInput'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
import {
  TimestampFormat,
  TIMESTAMP_FORMATS,
  detectTimestampFormat
} from '../utils/logParser'
import { useLogFilterWorker } from '../hooks/useLogFilterWorker'

const { Text } = Typography



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

  // Context View state
  const [expandedContexts, setExpandedContexts] = useState<Record<number, number>>({})

  const startTimeStr = useMemo(
    () => (session.startTime ? session.startTime.format('HH:mm:ss.SSS') : null),
    [session.startTime]
  )
  const endTimeStr = useMemo(
    () => (session.endTime ? session.endTime.format('HH:mm:ss.SSS') : null),
    [session.endTime]
  )
  const detectedFormatId = session.detectedFormat ? session.detectedFormat.id : null

  const {
    filteredLines,
    unfilteredTimeLines,
    matchCount,
    levelCounts,
    detectedFormatId: workerDetectedFormatId
  } = useLogFilterWorker({
    content: session.content,
    includeKeywords: session.includeKeywords,
    excludeKeywords: session.excludeKeywords,
    isIncludeCaseSensitive: session.isIncludeCaseSensitive,
    isExcludeCaseSensitive: session.isExcludeCaseSensitive,
    selectedLogLevels: session.selectedLogLevels || DEFAULT_LOG_LEVELS,
    startTimeStr,
    endTimeStr,
    selectedFormatId: session.selectedFormatId || 'auto',
    detectedFormatId,
    expandedContexts
  })

  useEffect(() => {
    if (workerDetectedFormatId && session.selectedFormatId === 'auto') {
      const found = TIMESTAMP_FORMATS.find((f) => f.id === workerDetectedFormatId) || null
      if (found && session.detectedFormat?.id !== found.id) {
        onUpdateSession({ detectedFormat: found })
      }
    }
  }, [workerDetectedFormatId, session.selectedFormatId, session.detectedFormat, onUpdateSession])

  // Bookmarks drawer & rename modal
  const [bookmarksDrawerOpen, setBookmarksDrawerOpen] = useState(false)
  const [bookmarkSearchKeyword, setBookmarkSearchKeyword] = useState('')
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renameTargetIndex, setRenameTargetIndex] = useState<number | null>(null)
  const [renameInputVal, setRenameInputVal] = useState('')
  const [targetFlashLine, setTargetFlashLine] = useState<number | null>(null)

  // Keyboard Shortcuts Modal state
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false)

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

  const sessionRef = useRef(session)
  sessionRef.current = session

  const onUpdateSessionRef = useRef(onUpdateSession)
  onUpdateSessionRef.current = onUpdateSession

  const isShortcutsModalOpenRef = useRef(isShortcutsModalOpen)
  isShortcutsModalOpenRef.current = isShortcutsModalOpen

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
        if (total >= 10000) break
      }
      if (total >= 10000) break
    }
    return total
  }, [filteredLines, searchKeyword])

  const searchMatchesCountRef = useRef(searchMatchesCount)
  searchMatchesCountRef.current = searchMatchesCount

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (session.includeKeywords && session.includeKeywords.trim()) count++
    if (session.excludeKeywords && session.excludeKeywords.trim()) count++
    if (session.startTime || session.endTime) count++
    const currentLevels = session.selectedLogLevels || DEFAULT_LOG_LEVELS
    const hasDeselectedLevel = Object.values(currentLevels).some((v) => !v)
    if (hasDeselectedLevel) count++
    return count
  }, [session.includeKeywords, session.excludeKeywords, session.startTime, session.endTime, session.selectedLogLevels])

  const handleClearAllFilters = useCallback(() => {
    onUpdateSession({
      includeKeywords: '',
      excludeKeywords: '',
      startTime: null,
      endTime: null,
      selectedLogLevels: { ERROR: true, WARN: true, INFO: true, DEBUG: true, OTHER: true }
    })
  }, [onUpdateSession])

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
      const isModalOpen = isShortcutsModalOpenRef.current
      const isCtrlOrCmd = e.ctrlKey || e.metaKey
      const keyLower = e.key.toLowerCase()

      // 0. Ctrl+C: Copy active selection or fallback to highlighted word
      if (isCtrlOrCmd && keyLower === 'c' && !e.shiftKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return
        }
        const selection = window.getSelection()
        const selectedText = selection ? selection.toString() : ''
        if (selectedText) {
          return // Native copy will handle it
        }
        if (sessionRef.current?.highlightWord) {
          e.preventDefault()
          navigator.clipboard.writeText(sessionRef.current.highlightWord)
          message.success(t('common.copied', { defaultValue: 'Copied to clipboard' }))
          return
        }
      }

      // 1. Ctrl+I: Focus Include Keywords input
      if (isCtrlOrCmd && keyLower === 'i' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        setIsCollapsed(false)
        setTimeout(() => {
          const inputEl = document.getElementById('include-keywords-input') as HTMLInputElement
          if (inputEl) {
            inputEl.focus()
            inputEl.select()
          }
        }, 50)
        return
      }

      // 2. Ctrl+E: Focus Exclude Keywords input
      if (isCtrlOrCmd && keyLower === 'e' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        setIsCollapsed(false)
        setTimeout(() => {
          const inputEl = document.getElementById('exclude-keywords-input') as HTMLInputElement
          if (inputEl) {
            inputEl.focus()
            inputEl.select()
          }
        }, 50)
        return
      }

      // 3. Ctrl+Shift+F: Toggle Filter Panel
      if (isCtrlOrCmd && e.shiftKey && keyLower === 'f') {
        e.preventDefault()
        setIsCollapsed((prev) => !prev)
        return
      }

      // 4. Ctrl+F: Open search overlay & focus search input
      if (isCtrlOrCmd && !e.shiftKey && keyLower === 'f') {
        e.preventDefault()
        setSearchVisible(true)
        setTimeout(() => {
          const inputEl = document.getElementById('search-input') as HTMLInputElement
          if (inputEl) {
            inputEl.focus()
            inputEl.select()
          }
        }, 50)
        return
      }

      // 5. Ctrl+B: Toggle Bookmarks Drawer
      if (isCtrlOrCmd && !e.shiftKey && keyLower === 'b') {
        e.preventDefault()
        setBookmarksDrawerOpen((prev) => !prev)
        return
      }

      // 6. Ctrl+T: Toggle Density Timeline
      if (isCtrlOrCmd && !e.shiftKey && keyLower === 't') {
        e.preventDefault()
        if (onUpdateSessionRef.current && sessionRef.current) {
          onUpdateSessionRef.current({ showTimeline: !sessionRef.current.showTimeline })
        }
        return
      }

      // 7. Ctrl+/ or ?: Open Keyboard Shortcuts guide modal
      if (
        (isCtrlOrCmd && e.key === '/') ||
        (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey)
      ) {
        const target = e.target as HTMLElement
        if (e.key === '?' && target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return
        }
        e.preventDefault()
        setIsShortcutsModalOpen(true)
        return
      }

      // 8. F3: Search Next/Prev Match
      if (e.key === 'F3') {
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
        return
      }

      // 9. Escape: Unfocus input, close search/modal, or clear text highlight
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          target.blur()
          e.preventDefault()
          return
        }
        if (visible) {
          e.preventDefault()
          handleCloseSearch()
          return
        }
        if (isModalOpen) {
          e.preventDefault()
          setIsShortcutsModalOpen(false)
          return
        }
        if (sessionRef.current?.highlightWord) {
          e.preventDefault()
          if (onUpdateSessionRef.current) {
            onUpdateSessionRef.current({ highlightWord: '' })
          }
          try {
            window.getSelection()?.removeAllRanges()
          } catch {
            // ignore
          }
          return
        }
        const sel = window.getSelection()
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          e.preventDefault()
          sel.removeAllRanges()
          return
        }
      }
    }

    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const selection = window.getSelection()
      const selectedText = selection ? selection.toString() : ''
      if (!selectedText && sessionRef.current?.highlightWord) {
        e.clipboardData?.setData('text/plain', sessionRef.current.highlightWord)
        e.preventDefault()
        message.success(t('common.copied', { defaultValue: 'Copied to clipboard' }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('copy', handleCopy)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('copy', handleCopy)
    }
  }, [t])

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


  const [contextModalLine, setContextModalLine] = useState<{
    originalIndex: number
    text: string
    timestamp: string | null
  } | null>(null)
  const [contextModalRange, setContextModalRange] = useState<number>(10)

  const handleExpandContextInline = useCallback((targetIndex: number, count: number) => {
    setExpandedContexts((prev) => ({ ...prev, [targetIndex]: count }))
  }, [])

  const handleCollapseContextInline = useCallback((targetIndex: number) => {
    setExpandedContexts((prev) => {
      const copy = { ...prev }
      delete copy[targetIndex]
      return copy
    })
  }, [])

  const handleClearAllContexts = useCallback(() => {
    setExpandedContexts({})
  }, [])

  const handleOpenContextModal = useCallback(
    (originalIndex: number, text: string, timestamp: string | null) => {
      setContextModalLine({ originalIndex, text, timestamp })
      setContextModalRange(10)
    },
    []
  )

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
  const isAtBottomRef = useRef(true)
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



  // Reset attached-to-bottom state when session changes
  useEffect(() => {
    if (session.tailMode) {
      isAtBottomRef.current = true
    }
  }, [session.id, session.tailMode])

  // Auto-scroll to bottom when tailMode is enabled, lines update, and viewport is attached to bottom
  useEffect(() => {
    if (!session.tailMode || !logContainerRef.current || filteredLines.length === 0) {
      return
    }
    if (!isAtBottomRef.current) {
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
      message.success(t('bookmarks.renameSuccess'))
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
      isAtBottomRef.current = isAtBottom

      if (onScrollSync) {
        const percentage = el.scrollTop / maxScroll
        onScrollSync(percentage)
      }
    } else {
      isAtBottomRef.current = true
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
          background-color: ${isDark ? 'rgba(234, 179, 8, 0.35)' : '#fef08a'};
          color: ${isDark ? '#fef08a' : '#000000'};
          border-radius: 2px;
          padding: 0 2px;
          box-shadow: ${isDark ? '0 0 0 1px rgba(234, 179, 8, 0.5)' : '0 0 0 1px #fde047'};
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

          {/* Keyboard Shortcuts button */}
          <Tooltip title={t('header.keyboardShortcuts')}>
            <Button
              size="small"
              icon={<KeyOutlined />}
              onClick={() => setIsShortcutsModalOpen(true)}
            />
          </Tooltip>

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
          <Space align="center" size={8}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#f1f5f9' : '#1e293b' }}>
              {t('header.toggleFilterPanel')}
            </Text>
            {activeFilterCount > 0 && (
              <Tag
                color="blue"
                style={{
                  borderRadius: 10,
                  fontSize: 10,
                  padding: '0 8px',
                  margin: 0,
                  border: 'none',
                  lineHeight: '18px'
                }}
              >
                {activeFilterCount} Active
              </Tag>
            )}
          </Space>
          <Space align="center" size={8}>
            {activeFilterCount > 0 && (
              <Button
                size="small"
                type="link"
                icon={<ClearOutlined style={{ fontSize: 11 }} />}
                onClick={handleClearAllFilters}
                style={{
                  fontSize: 11,
                  padding: '0 4px',
                  color: isDark ? '#94a3b8' : '#64748b',
                  height: 22
                }}
              >
                {t('filter.clearFilters')}
              </Button>
            )}
            <Button
              type="text"
              size="small"
              icon={isCollapsed ? <DownOutlined /> : <UpOutlined />}
              onClick={() => setIsCollapsed(!isCollapsed)}
            />
          </Space>
        </div>

        {!isCollapsed && (
          <Row gutter={[16, 10]} style={{ marginTop: 8 }}>
            {/* Include Keywords */}
            <Col xs={24} sm={12}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 20 }}>
                  <Space size={4} align="center">
                    <Text style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>
                      {t('filter.includeKeywords')}
                    </Text>
                    <kbd
                      style={{
                        fontSize: 9,
                        fontFamily: 'monospace',
                        padding: '0 4px',
                        borderRadius: 3,
                        border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.15)',
                        color: isDark ? '#38bdf8' : '#0284c7',
                        background: isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(2, 132, 199, 0.08)'
                      }}
                    >
                      Ctrl+I
                    </kbd>
                  </Space>
                  <Tooltip title={t('filter.caseSensitiveTooltip')}>
                    <Space size={4} align="center" style={{ cursor: 'pointer' }}>
                      <Switch
                        size="small"
                        checked={session.isIncludeCaseSensitive}
                        onChange={(checked) => onUpdateSession({ isIncludeCaseSensitive: checked })}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: session.isIncludeCaseSensitive ? 600 : 400,
                          color: session.isIncludeCaseSensitive
                            ? (isDark ? '#38bdf8' : '#0284c7')
                            : (isDark ? '#64748b' : '#94a3b8')
                        }}
                      >
                        {t('filter.caseSensitive')}
                      </Text>
                    </Space>
                  </Tooltip>
                </div>
                <KeywordHistoryInput
                  id="include-keywords-input"
                  size="small"
                  placeholder={t('filter.includePlaceholder')}
                  value={session.includeKeywords}
                  onChange={(val) => onUpdateSession({ includeKeywords: val })}
                  storageKey="logprism_include_keyword_history"
                  isDark={isDark}
                  allowClear
                  style={{ borderRadius: 4 }}
                />
              </div>
            </Col>

            {/* Time Range Filter */}
            <Col xs={24} sm={12}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>
                    {t('filter.timeRange')}
                  </Text>
                  {(session.startTime || session.endTime) ? (
                    <Button
                      size="small"
                      type="link"
                      onClick={() => onUpdateSession({ startTime: null, endTime: null })}
                      style={{ fontSize: 11, padding: 0, height: 20, color: isDark ? '#38bdf8' : '#0284c7' }}
                    >
                      {t('filter.resetTime')}
                    </Button>
                  ) : (
                    <div style={{ height: 20 }} />
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                  <DatePicker.TimePicker
                    size="small"
                    value={session.startTime}
                    onChange={(val) => onUpdateSession({ startTime: val })}
                    format="HH:mm:ss.SSS"
                    placeholder="00:00:00.000"
                    style={{ width: 125, flexShrink: 0, borderRadius: 4 }}
                  />
                  <span style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }}>~</span>
                  <DatePicker.TimePicker
                    size="small"
                    value={session.endTime}
                    onChange={(val) => onUpdateSession({ endTime: val })}
                    format="HH:mm:ss.SSS"
                    placeholder="23:59:59.999"
                    style={{ width: 125, flexShrink: 0, borderRadius: 4 }}
                  />

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
                    <Button
                      size="small"
                      icon={<ClockCircleOutlined style={{ fontSize: 11 }} />}
                      style={{
                        borderRadius: 4,
                        fontSize: 11,
                        padding: '0 8px',
                        marginLeft: 4,
                        color: isDark ? '#cbd5e1' : '#475569'
                      }}
                    >
                      {activeFormat ? activeFormat.name : t('header.timestampFormat')}{' '}
                      <DownOutlined style={{ fontSize: 9 }} />
                    </Button>
                  </Dropdown>
                </div>
              </div>
            </Col>

            {/* Exclude Keywords */}
            <Col xs={24} sm={12}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 20 }}>
                  <Space size={4} align="center">
                    <Text style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>
                      {t('filter.excludeKeywords')}
                    </Text>
                    <kbd
                      style={{
                        fontSize: 9,
                        fontFamily: 'monospace',
                        padding: '0 4px',
                        borderRadius: 3,
                        border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.15)',
                        color: isDark ? '#38bdf8' : '#0284c7',
                        background: isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(2, 132, 199, 0.08)'
                      }}
                    >
                      Ctrl+E
                    </kbd>
                  </Space>
                  <Tooltip title={t('filter.caseSensitiveTooltip')}>
                    <Space size={4} align="center" style={{ cursor: 'pointer' }}>
                      <Switch
                        size="small"
                        checked={session.isExcludeCaseSensitive}
                        onChange={(checked) => onUpdateSession({ isExcludeCaseSensitive: checked })}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: session.isExcludeCaseSensitive ? 600 : 400,
                          color: session.isExcludeCaseSensitive
                            ? (isDark ? '#38bdf8' : '#0284c7')
                            : (isDark ? '#64748b' : '#94a3b8')
                        }}
                      >
                        {t('filter.caseSensitive')}
                      </Text>
                    </Space>
                  </Tooltip>
                </div>
                <KeywordHistoryInput
                  id="exclude-keywords-input"
                  size="small"
                  placeholder={t('filter.excludePlaceholder')}
                  value={session.excludeKeywords}
                  onChange={(val) => onUpdateSession({ excludeKeywords: val })}
                  storageKey="logprism_exclude_keyword_history"
                  isDark={isDark}
                  allowClear
                  style={{ borderRadius: 4 }}
                />
              </div>
            </Col>

            {/* Log Levels Checkboxes */}
            <Col xs={24} sm={12}>
              {(() => {
                const currentLogLevels = session.selectedLogLevels || DEFAULT_LOG_LEVELS
                const isAllSelected = (['ERROR', 'WARN', 'INFO', 'DEBUG', 'OTHER'] as LogLevel[]).every(
                  (lvl) => currentLogLevels[lvl]
                )
                const isErrorsWarnsSelected =
                  !!currentLogLevels.ERROR &&
                  !!currentLogLevels.WARN &&
                  !currentLogLevels.INFO &&
                  !currentLogLevels.DEBUG &&
                  !currentLogLevels.OTHER
                const isNoneSelected = (['ERROR', 'WARN', 'INFO', 'DEBUG', 'OTHER'] as LogLevel[]).every(
                  (lvl) => !currentLogLevels[lvl]
                )

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 22 }}>
                      <Text style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>
                        {t('filter.logLevels')}
                      </Text>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 3px',
                          borderRadius: 6,
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)'}`,
                          gap: 3
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSession({
                              selectedLogLevels: { ERROR: true, WARN: true, INFO: true, DEBUG: true, OTHER: true }
                            })
                          }
                          style={{
                            border: isAllSelected
                              ? `1px solid ${isDark ? '#3b82f6' : '#2563eb'}`
                              : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)'}`,
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: 10,
                            fontWeight: isAllSelected ? 600 : 400,
                            padding: '2px 8px',
                            borderRadius: 4,
                            lineHeight: '14px',
                            transition: 'all 0.15s ease',
                            color: isAllSelected
                              ? isDark ? '#60a5fa' : '#1d4ed8'
                              : isDark ? '#cbd5e1' : '#64748b',
                            backgroundColor: isAllSelected
                              ? isDark ? 'rgba(59, 130, 246, 0.22)' : '#eff6ff'
                              : isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.8)',
                            boxShadow: isAllSelected
                              ? isDark ? '0 0 6px rgba(59, 130, 246, 0.35)' : '0 1px 2px rgba(37, 99, 235, 0.15)'
                              : 'none'
                          }}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSession({
                              selectedLogLevels: { ERROR: true, WARN: true, INFO: false, DEBUG: false, OTHER: false }
                            })
                          }
                          style={{
                            border: isErrorsWarnsSelected
                              ? `1px solid ${isDark ? '#ef4444' : '#dc2626'}`
                              : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)'}`,
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: 10,
                            fontWeight: isErrorsWarnsSelected ? 600 : 400,
                            padding: '2px 8px',
                            borderRadius: 4,
                            lineHeight: '14px',
                            transition: 'all 0.15s ease',
                            color: isErrorsWarnsSelected
                              ? isDark ? '#fca5a5' : '#b91c1c'
                              : isDark ? '#cbd5e1' : '#64748b',
                            backgroundColor: isErrorsWarnsSelected
                              ? isDark ? 'rgba(239, 68, 68, 0.22)' : '#fef2f2'
                              : isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.8)',
                            boxShadow: isErrorsWarnsSelected
                              ? isDark ? '0 0 6px rgba(239, 68, 68, 0.35)' : '0 1px 2px rgba(220, 38, 26, 0.15)'
                              : 'none'
                          }}
                        >
                          Errors & Warns
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSession({
                              selectedLogLevels: { ERROR: false, WARN: false, INFO: false, DEBUG: false, OTHER: false }
                            })
                          }
                          style={{
                            border: isNoneSelected
                              ? `1px solid ${isDark ? 'rgba(255, 255, 255, 0.4)' : '#64748b'}`
                              : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)'}`,
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: 10,
                            fontWeight: isNoneSelected ? 600 : 400,
                            padding: '2px 8px',
                            borderRadius: 4,
                            lineHeight: '14px',
                            transition: 'all 0.15s ease',
                            color: isNoneSelected
                              ? isDark ? '#ffffff' : '#0f172a'
                              : isDark ? '#cbd5e1' : '#64748b',
                            backgroundColor: isNoneSelected
                              ? isDark ? 'rgba(255, 255, 255, 0.16)' : '#f1f5f9'
                              : isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.8)',
                            boxShadow: isNoneSelected
                              ? isDark ? '0 1px 4px rgba(0, 0, 0, 0.4)' : '0 1px 2px rgba(0, 0, 0, 0.1)'
                              : 'none'
                          }}
                        >
                          None
                        </button>
                      </div>
                    </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', minHeight: 24 }}>
                  {(['ERROR', 'WARN', 'INFO', 'DEBUG', 'OTHER'] as LogLevel[]).map((lvl) => {
                    const currentLogLevels = session.selectedLogLevels || DEFAULT_LOG_LEVELS
                    const isSelected = !!currentLogLevels[lvl]
                    const cfg = LEVEL_TOGGLE_CONFIG[lvl]
                    return (
                      <Button
                        key={lvl}
                        size="small"
                        icon={isSelected ? <CheckOutlined style={{ fontSize: 10 }} /> : null}
                        onClick={() =>
                          onUpdateSession({
                            selectedLogLevels: { ...currentLogLevels, [lvl]: !isSelected }
                          })
                        }
                        style={{
                          fontSize: 10,
                          height: 24,
                          padding: '0 7px',
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
                            : isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
                          boxShadow: isSelected
                            ? `0 2px 5px ${cfg.bgSolid}33`
                            : 'none',
                          opacity: isSelected ? 1 : 0.55,
                          transition: 'all 0.15s ease-in-out'
                        }}
                      >
                        {lvl} ({levelCounts[lvl] || 0})
                      </Button>
                    )
                  })}
                </div>
              </div>
            )
          })()}
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
          onHighlightWordChange={(word) => onUpdateSession({ highlightWord: word })}
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
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginRight: 8 }}>
            <span>{t('bookmarks.title')}</span>
            {Object.keys(session.bookmarkedLines || {}).length > 0 && (
              <Popconfirm
                title={t('bookmarks.confirmClearAll')}
                onConfirm={() => onUpdateSession({ bookmarkedLines: {} })}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Button type="text" danger size="small" icon={<DeleteOutlined />}>
                  {t('bookmarks.clearAll')}
                </Button>
              </Popconfirm>
            )}
          </div>
        }
        placement="right"
        open={bookmarksDrawerOpen}
        onClose={() => setBookmarksDrawerOpen(false)}
        width={380}
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
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
                      marginBottom: 8,
                      cursor: 'pointer',
                      backgroundColor: isDark ? '#1f1f1f' : '#ffffff',
                      transition: 'all 0.2s ease'
                    }}
                    className="bookmark-item-card"
                    onClick={() => {
                      setTargetFlashLine(bm.originalIndex)
                      setTimeout(() => setTargetFlashLine(null), 2000)
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Space size={6} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <Tag color="orange" style={{ margin: 0 }}>#{bm.originalIndex + 1}</Tag>
                        {bm.name ? (
                          <Tag
                            color="blue"
                            style={{
                              margin: 0,
                              cursor: 'pointer',
                              maxWidth: 160,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setRenameTargetIndex(bm.originalIndex)
                              setRenameInputVal(bm.name || '')
                              setRenameModalVisible(true)
                            }}
                            title={t('bookmarks.renameBookmark')}
                          >
                            🏷️ {bm.name}
                          </Tag>
                        ) : (
                          <Button
                            type="dashed"
                            size="small"
                            icon={<EditOutlined style={{ fontSize: 11 }} />}
                            style={{ fontSize: 11, height: 22, padding: '0 6px', color: isDark ? '#8c8c8c' : '#595959' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setRenameTargetIndex(bm.originalIndex)
                              setRenameInputVal('')
                              setRenameModalVisible(true)
                            }}
                          >
                            {t('bookmarks.addLabel')}
                          </Button>
                        )}
                      </Space>

                      <Space size={2} style={{ flexShrink: 0 }}>
                        <Tooltip title={t('bookmarks.renameBookmark')}>
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            style={{ color: isDark ? '#a6a6a6' : '#595959' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setRenameTargetIndex(bm.originalIndex)
                              setRenameInputVal(bm.name || '')
                              setRenameModalVisible(true)
                            }}
                          />
                        </Tooltip>
                        <Tooltip title={t('bookmarks.unpinLine')}>
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
                        </Tooltip>
                      </Space>
                    </div>

                    <Text style={{ fontSize: 12, color: isDark ? '#bfbfbf' : '#434343' }} ellipsis title={bm.text}>
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
          <Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
            {t('bookmarks.lineNum', {
              line: renameTargetIndex !== null ? renameTargetIndex + 1 : ''
            })}
            :
          </Text>
          {renameTargetIndex !== null && session.bookmarkedLines[renameTargetIndex] && (
            <div
              style={{
                padding: '6px 10px',
                borderRadius: 4,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5',
                marginBottom: 12,
                fontSize: 12,
                fontFamily: 'monospace',
                maxHeight: 60,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={session.bookmarkedLines[renameTargetIndex].text}
            >
              {session.bookmarkedLines[renameTargetIndex].text}
            </div>
          )}
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
            allowClear
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
            <Space size={6}>
              <VerticalRightOutlined style={{ color: '#10b981' }} />
              <span>{t('contextMenu.setStartTime')}</span>
            </Space>
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
            <Space size={6}>
              <VerticalLeftOutlined style={{ color: '#ef4444' }} />
              <span>{t('contextMenu.setEndTime')}</span>
            </Space>
          </div>

          {/* Mark Highlight Submenu */}
          <div className="menu-item has-submenu">
            <Space size={6}>
              <HighlightOutlined style={{ color: '#8b5cf6' }} />
              <span>{t('contextMenu.markHighlight')}</span>
            </Space>
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

          {/* View Context Submenu */}
          <div className="menu-item has-submenu">
            <Space size={6}>
              <BranchesOutlined style={{ color: '#a855f7' }} />
              <span>{t('contextMenu.viewContext')}</span>
            </Space>
            <div
              className="submenu"
              style={{
                left: contextMenuPos.submenuPlacement.left,
                right: contextMenuPos.submenuPlacement.right,
                top: contextMenuPos.submenuPlacement.top,
                bottom: contextMenuPos.submenuPlacement.bottom
              }}
            >
              <div
                className="submenu-item"
                onClick={() => {
                  handleExpandContextInline(contextMenu.originalIndex, 5)
                  setContextMenu(null)
                }}
              >
                <span style={{ flex: 1 }}>{t('contextMenu.context5Lines')}</span>
                {expandedContexts[contextMenu.originalIndex] === 5 && (
                  <span style={{ fontSize: 10, color: '#a855f7' }}>✓</span>
                )}
              </div>
              <div
                className="submenu-item"
                onClick={() => {
                  handleExpandContextInline(contextMenu.originalIndex, 10)
                  setContextMenu(null)
                }}
              >
                <span style={{ flex: 1 }}>{t('contextMenu.context10Lines')}</span>
                {expandedContexts[contextMenu.originalIndex] === 10 && (
                  <span style={{ fontSize: 10, color: '#a855f7' }}>✓</span>
                )}
              </div>
              <div
                className="submenu-item"
                onClick={() => {
                  handleExpandContextInline(contextMenu.originalIndex, 20)
                  setContextMenu(null)
                }}
              >
                <span style={{ flex: 1 }}>{t('contextMenu.context20Lines')}</span>
                {expandedContexts[contextMenu.originalIndex] === 20 && (
                  <span style={{ fontSize: 10, color: '#a855f7' }}>✓</span>
                )}
              </div>
              {expandedContexts[contextMenu.originalIndex] && (
                <div
                  className="submenu-item"
                  onClick={() => {
                    handleCollapseContextInline(contextMenu.originalIndex)
                    setContextMenu(null)
                  }}
                  style={{ color: isDark ? '#f87171' : '#dc2626' }}
                >
                  <span style={{ flex: 1 }}>{t('contextMenu.collapseContext')}</span>
                </div>
              )}
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
                  handleOpenContextModal(
                    contextMenu.originalIndex,
                    contextMenu.lineText,
                    contextMenu.timestamp
                  )
                  setContextMenu(null)
                }}
              >
                <span>{t('contextMenu.inspectInModal')}</span>
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
          {Object.keys(expandedContexts).length > 0 && (
            <Tag
              color="purple"
              closable
              onClose={handleClearAllContexts}
              style={{ margin: 0, fontSize: 10, cursor: 'pointer' }}
            >
              Context: {Object.keys(expandedContexts).length} active (Clear)
            </Tag>
          )}
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
              onChange={(checked) => {
                onUpdateSession({ tailMode: checked })
                if (checked) {
                  isAtBottomRef.current = true
                  if (logContainerRef.current) {
                    isProgrammaticScrollRef.current = true
                    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
                    setTimeout(() => {
                      isProgrammaticScrollRef.current = false
                    }, 100)
                  }
                }
              }}
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

      {/* Context View Modal */}
      {contextModalLine !== null && (() => {
        const rawLines = session.content ? session.content.split(/\r?\n/) : []
        const startLine = Math.max(0, contextModalLine.originalIndex - contextModalRange)
        const endLine = Math.min(rawLines.length - 1, contextModalLine.originalIndex + contextModalRange)
        const displayedLines = rawLines.slice(startLine, endLine + 1)
        const maxDigits = Math.max(String(endLine + 1).length, 3)

        const isInlineExpanded = Boolean(expandedContexts[contextModalLine.originalIndex])

        const handleCopyModalContext = () => {
          const textToCopy = displayedLines.join('\n')
          navigator.clipboard.writeText(textToCopy)
          message.success(t('contextModal.copySuccess'))
        }

        return (
          <Modal
            title={
              <Space>
                <BranchesOutlined style={{ color: '#a855f7' }} />
                <span>{t('contextModal.title', { line: contextModalLine.originalIndex + 1 })}</span>
              </Space>
            }
            open={true}
            onCancel={() => setContextModalLine(null)}
            width={900}
            footer={[
              <Button
                key="copy"
                icon={<CopyOutlined />}
                onClick={handleCopyModalContext}
              >
                {t('contextModal.copyContext')}
              </Button>,
              <Button
                key="inline"
                type={isInlineExpanded ? 'default' : 'primary'}
                danger={isInlineExpanded}
                onClick={() => {
                  if (isInlineExpanded) {
                    handleCollapseContextInline(contextModalLine.originalIndex)
                  } else {
                    handleExpandContextInline(contextModalLine.originalIndex, contextModalRange)
                  }
                }}
              >
                {isInlineExpanded
                  ? t('contextModal.collapseInline')
                  : t('contextModal.expandInline')}
              </Button>,
              <Button key="close" onClick={() => setContextModalLine(null)}>
                Close
              </Button>
            ]}
          >
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 500, fontSize: 13 }}>{t('contextModal.rangeLabel')}</span>
              <Radio.Group
                value={contextModalRange}
                onChange={(e) => setContextModalRange(e.target.value)}
                size="small"
              >
                <Radio.Button value={5}>±5</Radio.Button>
                <Radio.Button value={10}>±10</Radio.Button>
                <Radio.Button value={20}>±20</Radio.Button>
                <Radio.Button value={50}>±50</Radio.Button>
              </Radio.Group>
              <InputNumber
                min={1}
                max={200}
                value={contextModalRange}
                onChange={(val) => val && setContextModalRange(val)}
                size="small"
                style={{ width: 80 }}
              />
            </div>

            <div
              style={{
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: session.fontSize || 13,
                lineHeight: '1.6',
                maxHeight: '480px',
                overflowY: 'auto',
                backgroundColor: isDark ? '#0f0f11' : '#f8fafc',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '6px',
                padding: '8px 4px'
              }}
            >
              {displayedLines.map((lineText, idx) => {
                const currentOriginalIndex = startLine + idx
                const isTarget = currentOriginalIndex === contextModalLine.originalIndex
                return (
                  <div
                    key={currentOriginalIndex}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      backgroundColor: isTarget
                        ? (isDark ? 'rgba(234, 179, 8, 0.25)' : 'rgba(254, 240, 138, 0.75)')
                        : 'transparent',
                      borderLeft: isTarget
                        ? '4px solid #eab308'
                        : '4px solid transparent',
                      padding: '2px 8px',
                      borderRadius: '2px'
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        minWidth: `${maxDigits}ch`,
                        textAlign: 'right',
                        marginRight: '12px',
                        opacity: isTarget ? 0.95 : 0.45,
                        fontWeight: isTarget ? 700 : 400,
                        userSelect: 'none',
                        color: isTarget ? '#eab308' : 'inherit'
                      }}
                    >
                      {currentOriginalIndex + 1}
                    </span>
                    {isTarget ? (
                      <Tag color="gold" style={{ fontSize: 10, margin: '2px 6px 0 0', flexShrink: 0, fontWeight: 700 }}>
                        {t('contextModal.targetLineTag')}
                      </Tag>
                    ) : (
                      <Tag style={{ fontSize: 10, margin: '2px 6px 0 0', opacity: 0.65, flexShrink: 0 }}>
                        {t('contextModal.contextLineTag')}
                      </Tag>
                    )}
                    <span style={{ whiteSpace: session.wordWrap ? 'pre-wrap' : 'pre', wordBreak: session.wordWrap ? 'break-all' : 'normal', flex: 1 }}>
                      {lineText}
                    </span>
                  </div>
                )
              })}
            </div>
          </Modal>
        )
      })()}

      <KeyboardShortcutsModal
        open={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        isDark={isDark}
      />
    </div>
  )
}
