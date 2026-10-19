import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { PushpinFilled, PushpinOutlined } from '@ant-design/icons'
import { message } from 'antd'
import type { LogLevel } from './LogTimeline'
import { detectPayload } from '../utils/payloadDetector'

export const INLINE_PAYLOAD_HEIGHT = 280

export interface LogLineData {
  text: string
  originalIndex: number
  timestamp: string | null
  level?: LogLevel
  isContext?: boolean
  contextTargetIndex?: number
}

export interface BookmarkData {
  originalIndex: number
  text: string
  timestamp: string | null
  name?: string
}

interface VirtualLogListProps {
  lines: LogLineData[]
  fontSize: number
  wordWrap: boolean
  showLineNumbers: boolean
  maxLineDigits: number
  highlightWord: string
  onHighlightWordChange?: (word: string) => void
  searchKeyword: string
  currentMatchIndex: number
  markedLines: Record<number, string>
  bookmarkedLines: Record<number, BookmarkData>
  targetFlashLine: number | null
  onToggleBookmark: (originalIndex: number, text: string, timestamp: string | null) => void
  onContextMenu: (
    e: React.MouseEvent<HTMLDivElement>,
    originalIndex: number,
    timestamp: string | null,
    text: string
  ) => void
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  isDark: boolean
  expandedPayloadLines?: Record<number, boolean>
  onToggleExpandPayload?: (originalIndex: number) => void
  onOpenPayloadDrawer?: (originalIndex: number, text: string) => void
  onHoverLine?: (originalIndex: number, text: string) => void
}

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

interface SavedSelection {
  startLineIndex: number
  startCharOffset: number
  endLineIndex: number
  endCharOffset: number
  text: string
}

function getCharOffsetInElement(container: Node, targetNode: Node, targetOffset: number): number {
  if (!container.contains(targetNode) && container !== targetNode) {
    if (targetNode.compareDocumentPosition(container) & Node.DOCUMENT_POSITION_FOLLOWING) {
      return 0
    } else {
      return container.textContent?.length || 0
    }
  }

  let charCount = 0
  const treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  let currentNode = treeWalker.nextNode()

  while (currentNode) {
    if (currentNode === targetNode) {
      return charCount + Math.min(targetOffset, currentNode.textContent?.length || 0)
    }
    charCount += currentNode.textContent?.length || 0
    currentNode = treeWalker.nextNode()
  }

  if (targetNode.nodeType === Node.ELEMENT_NODE) {
    let offsetCount = 0
    for (let i = 0; i < targetNode.childNodes.length; i++) {
      if (i === targetOffset) break
      offsetCount += targetNode.childNodes[i].textContent?.length || 0
    }
    let total = 0
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
    let n = walker.nextNode()
    while (n) {
      if (targetNode.contains(n)) {
        return total + offsetCount
      }
      total += n.textContent?.length || 0
      n = walker.nextNode()
    }
    return total + offsetCount
  }

  return charCount
}

function getNodeAndOffsetAtChar(
  container: Node,
  targetCharOffset: number
): { node: Node; offset: number } | null {
  const treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  let currentNode = treeWalker.nextNode()
  let charCount = 0
  let lastNode: Node | null = null
  let lastLength = 0

  while (currentNode) {
    const textLen = currentNode.textContent?.length || 0
    if (charCount + textLen >= targetCharOffset) {
      return {
        node: currentNode,
        offset: Math.min(Math.max(0, targetCharOffset - charCount), textLen)
      }
    }
    charCount += textLen
    lastNode = currentNode
    lastLength = textLen
    currentNode = treeWalker.nextNode()
  }

  if (lastNode) {
    return { node: lastNode, offset: lastLength }
  }
  return null
}

export const VirtualLogList: React.FC<VirtualLogListProps> = ({
  lines,
  fontSize,
  wordWrap,
  showLineNumbers,
  maxLineDigits,
  highlightWord,
  onHighlightWordChange,
  searchKeyword,
  currentMatchIndex,
  markedLines,
  bookmarkedLines,
  targetFlashLine,
  onToggleBookmark,
  onContextMenu,
  onScroll,
  containerRef,
  isDark,
  expandedPayloadLines,
  onToggleExpandPayload,
  onOpenPayloadDrawer,
  onHoverLine
}) => {
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)
  const [containerWidth, setContainerWidth] = useState(800)

  const lineCount = lines.length
  // Line height estimation based on font size (lineHeight = 1.5)
  const lineHeight = Math.max(18, Math.round(fontSize * 1.5))
  const overscan = 20 // Buffer lines above and below viewport

  // Measure container height and width on resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateDimensions = () => {
      setContainerHeight(el.clientHeight || 600)
      setContainerWidth(el.clientWidth || 800)
    }
    updateDimensions()

    const observer = new ResizeObserver(updateDimensions)
    observer.observe(el)
    return () => observer.disconnect()
  }, [containerRef])

  // Keep scrollTop synced if container scroll position changes programmatically
  useEffect(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [lines, containerRef])

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop)
      onScroll(e)
    },
    [onScroll]
  )

  let cachedCanvasCtx: CanvasRenderingContext2D | null = null
  function getCanvasContext(fontSize: number): CanvasRenderingContext2D | null {
    if (typeof document === 'undefined') return null
    if (!cachedCanvasCtx) {
      const canvas = document.createElement('canvas')
      cachedCanvasCtx = canvas.getContext('2d')
    }
    if (cachedCanvasCtx) {
      cachedCanvasCtx.font = `${fontSize}px "Fira Code", "JetBrains Mono", ui-monospace, monospace`
    }
    return cachedCanvasCtx
  }

  // Calculate layout (heights, offsets, and max width for horizontal scrolling)
  const { itemHeights, itemOffsets, totalHeight, maxLineWidth, isUniform } = useMemo(() => {
    const lineNumWidth = showLineNumbers ? maxLineDigits * fontSize * 0.65 + 30 : 30
    const bookmarkWidth = 28
    const containerPaddingAndScrollbar = 50
    const availableTextWidth = Math.max(
      100,
      containerWidth - lineNumWidth - bookmarkWidth - containerPaddingAndScrollbar
    )

    const hasExpandedPayload = Object.values(expandedPayloadLines || {}).some(Boolean)

    // Fast path: When word wrap is off and no payloads are expanded, all row heights are identical (lineHeight)
    if (!wordWrap && !hasExpandedPayload) {
      let maxTextLength = 0
      const sampleLimit = Math.min(lineCount, 1000)
      for (let i = 0; i < sampleLimit; i++) {
        const len = lines[i]?.text?.length || 0
        if (len > maxTextLength) maxTextLength = len
      }
      const charWidth = fontSize * 0.6
      const estimatedMaxLineWidth = maxTextLength * charWidth + lineNumWidth + bookmarkWidth + 40

      return {
        itemHeights: null,
        itemOffsets: null,
        totalHeight: lineCount * lineHeight,
        maxLineWidth: estimatedMaxLineWidth,
        isUniform: true
      }
    }

    // Dynamic path for word-wrap mode or when payloads are expanded inline
    const heights = new Float64Array(lineCount)
    const offsets = new Float64Array(lineCount + 1)
    offsets[0] = 0

    let charWidth = fontSize * 0.6
    const ctx = getCanvasContext(fontSize)
    if (ctx) {
      charWidth = ctx.measureText('M').width || fontSize * 0.6
    }

    const isAscii = /^[\x00-\x7F]*$/
    let maxTextWidth = 0

    for (let i = 0; i < lineCount; i++) {
      const text = lines[i].text || ''
      let textWidth = 0
      if (isAscii.test(text)) {
        textWidth = text.length * charWidth
      } else if (ctx) {
        textWidth = ctx.measureText(text).width
      } else {
        textWidth = text.length * charWidth
      }

      if (textWidth > maxTextWidth) {
        maxTextWidth = textWidth
      }

      let wraps = 1
      if (wordWrap && availableTextWidth > 0) {
        wraps = Math.max(1, Math.ceil(textWidth / availableTextWidth))
      }

      let h = wraps * lineHeight
      if (expandedPayloadLines && expandedPayloadLines[lines[i].originalIndex]) {
        h += INLINE_PAYLOAD_HEIGHT
      }
      heights[i] = h
      offsets[i + 1] = offsets[i] + h
    }

    const maxTotalLineWidth = maxTextWidth + lineNumWidth + bookmarkWidth + 40

    return {
      itemHeights: heights,
      itemOffsets: offsets,
      totalHeight: offsets[lineCount] || 0,
      maxLineWidth: maxTotalLineWidth,
      isUniform: false
    }
  }, [
    lineCount,
    lines,
    wordWrap,
    fontSize,
    showLineNumbers,
    maxLineDigits,
    containerWidth,
    lineHeight,
    expandedPayloadLines
  ])

  // Binary search or direct math to find visible line indices
  const startIndex = useMemo(() => {
    const target = Math.max(0, scrollTop - overscan * lineHeight)
    if (isUniform || !itemOffsets) {
      return Math.max(0, Math.floor(target / lineHeight))
    }
    let low = 0
    let high = itemOffsets.length - 2
    let ans = 0
    while (low <= high) {
      const mid = (low + high) >> 1
      if (itemOffsets[mid] <= target) {
        ans = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return ans
  }, [isUniform, itemOffsets, scrollTop, lineHeight, overscan])

  const endIndex = useMemo(() => {
    const target = scrollTop + containerHeight + overscan * lineHeight
    if (isUniform || !itemOffsets) {
      return Math.min(lineCount, Math.ceil(target / lineHeight))
    }
    let low = startIndex
    let high = itemOffsets.length - 2
    let ans = lineCount
    while (low <= high) {
      const mid = (low + high) >> 1
      if (itemOffsets[mid] >= target) {
        ans = mid
        high = mid - 1
      } else {
        low = mid + 1
      }
    }
    return Math.min(lineCount, ans + 1)
  }, [
    isUniform,
    itemOffsets,
    startIndex,
    scrollTop,
    containerHeight,
    lineHeight,
    lineCount,
    overscan
  ])

  const visibleLines = useMemo(() => {
    return lines.slice(startIndex, endIndex)
  }, [lines, startIndex, endIndex])

  // Calculate start match index for each line and location of all matches across all lines
  const { lineMatchStartIndices, searchMatchLocations } = useMemo(() => {
    if (!searchKeyword || !lines || lines.length === 0) {
      return { lineMatchStartIndices: [], searchMatchLocations: [] }
    }
    const escapedWord = searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedWord, 'gi')
    const startIndices = new Array<number>(lines.length)
    const locations: { lineIndex: number; matchInLineIndex: number; globalIndex: number }[] = []
    let cumulative = 0
    const MAX_SEARCH_LOCATIONS = 5000

    for (let i = 0; i < lines.length; i++) {
      startIndices[i] = cumulative
      const text = lines[i].text || ''
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      let matchInLineIndex = 0
      while ((m = regex.exec(text)) !== null) {
        if (locations.length < MAX_SEARCH_LOCATIONS) {
          locations.push({
            lineIndex: i,
            matchInLineIndex,
            globalIndex: cumulative + matchInLineIndex
          })
        }
        matchInLineIndex++
        if (m.index === regex.lastIndex) {
          regex.lastIndex++
        }
      }
      cumulative += matchInLineIndex
    }
    return { lineMatchStartIndices: startIndices, searchMatchLocations: locations }
  }, [lines, searchKeyword])

  const lastSetTimeRef = useRef<number>(0)
  const savedSelectionRef = useRef<SavedSelection | null>(null)

  const captureSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
    const range = selection.getRangeAt(0)
    const selectedText = selection.toString()
    if (!selectedText) return null

    const startNode = range.startContainer
    const endNode = range.endContainer

    const startLineDiv = (
      startNode.nodeType === Node.ELEMENT_NODE ? (startNode as Element) : startNode.parentElement
    )?.closest('[data-line-index]')
    const endLineDiv = (
      endNode.nodeType === Node.ELEMENT_NODE ? (endNode as Element) : endNode.parentElement
    )?.closest('[data-line-index]')

    if (startLineDiv && endLineDiv) {
      const startLineIndex = parseInt(startLineDiv.getAttribute('data-line-index') || '-1', 10)
      const endLineIndex = parseInt(endLineDiv.getAttribute('data-line-index') || '-1', 10)

      const startTextEl = startLineDiv.querySelector('.log-text-content')
      const endTextEl = endLineDiv.querySelector('.log-text-content')

      if (startLineIndex >= 0 && endLineIndex >= 0 && startTextEl && endTextEl) {
        const startCharOffset = getCharOffsetInElement(
          startTextEl,
          range.startContainer,
          range.startOffset
        )
        const endCharOffset = getCharOffsetInElement(endTextEl, range.endContainer, range.endOffset)

        return {
          startLineIndex,
          startCharOffset,
          endLineIndex,
          endCharOffset,
          text: selectedText
        }
      }
    }
    return null
  }, [])

  const handleSelection = useCallback(() => {
    if (!onHighlightWordChange) return
    const selection = window.getSelection()
    if (!selection) return
    const selectedText = selection.toString().trim()
    if (selectedText && !selectedText.includes('\n') && selectedText.length <= 200) {
      lastSetTimeRef.current = Date.now()
      const selInfo = captureSelection()
      if (selInfo) {
        savedSelectionRef.current = selInfo
      }
      if (selectedText !== highlightWord) {
        onHighlightWordChange(selectedText)
      }
    } else if (!selectedText && highlightWord) {
      if (Date.now() - lastSetTimeRef.current > 350) {
        onHighlightWordChange('')
      }
    }
  }, [highlightWord, onHighlightWordChange, captureSelection])

  // Synchronously restore DOM text selection across re-renders
  useLayoutEffect(() => {
    if (!savedSelectionRef.current) return
    const saved = savedSelectionRef.current
    const container = containerRef.current
    if (!container) return

    const startLineEl = container.querySelector(
      `[data-line-index="${saved.startLineIndex}"] .log-text-content`
    )
    const endLineEl = container.querySelector(
      `[data-line-index="${saved.endLineIndex}"] .log-text-content`
    )
    if (!startLineEl || !endLineEl) {
      savedSelectionRef.current = null
      return
    }

    const startPoint = getNodeAndOffsetAtChar(startLineEl, saved.startCharOffset)
    const endPoint = getNodeAndOffsetAtChar(endLineEl, saved.endCharOffset)

    if (startPoint && endPoint) {
      try {
        const sel = window.getSelection()
        if (sel) {
          const newRange = document.createRange()
          newRange.setStart(startPoint.node, startPoint.offset)
          newRange.setEnd(endPoint.node, endPoint.offset)
          sel.removeAllRanges()
          sel.addRange(newRange)
        }
      } catch {
        // Fallback silently if range setting fails
      }
    }
    savedSelectionRef.current = null
  }, [highlightWord, lines, searchKeyword, currentMatchIndex, containerRef])

  const renderHighlightedText = useCallback(
    (text: string, lineIndex: number) => {
      const highlightInText = (plainText: string, word: string, className: string): string => {
        if (!word) return escapeHtml(plainText)
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`(${escapedWord})`, 'gi')
        const parts = plainText.split(regex)
        return parts
          .map((part, index) => {
            if (index % 2 === 1) {
              return `<mark class="${className}">${escapeHtml(part)}</mark>`
            }
            return escapeHtml(part)
          })
          .join('')
      }

      if (!searchKeyword && !highlightWord) {
        return escapeHtml(text)
      }

      if (!searchKeyword && highlightWord) {
        return highlightInText(text, highlightWord, 'log-highlight')
      }

      if (searchKeyword && !highlightWord) {
        const escapedWord = searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`(${escapedWord})`, 'gi')
        const parts = text.split(regex)
        let matchIdx = lineMatchStartIndices[lineIndex] ?? 0
        return parts
          .map((part, index) => {
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

      const escapedSearch = searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const searchRegex = new RegExp(`(${escapedSearch})`, 'gi')
      const parts = text.split(searchRegex)
      let matchIdx = lineMatchStartIndices[lineIndex] ?? 0

      return parts
        .map((part, index) => {
          if (index % 2 === 1) {
            const isCurrent = matchIdx === currentMatchIndex
            const className = isCurrent ? 'search-match search-match-active' : 'search-match'
            const rendered = `<mark class="${className}" data-match-index="${matchIdx}">${escapeHtml(part)}</mark>`
            matchIdx++
            return rendered
          } else {
            return highlightInText(part, highlightWord, 'log-highlight')
          }
        })
        .join('')
    },
    [searchKeyword, lineMatchStartIndices, currentMatchIndex, highlightWord]
  )

  // Scroll to target line when currentMatchIndex changes
  useEffect(() => {
    if (
      currentMatchIndex >= 0 &&
      currentMatchIndex < searchMatchLocations.length &&
      (isUniform || (itemOffsets && itemOffsets.length > 0))
    ) {
      const target = searchMatchLocations[currentMatchIndex]
      const targetLineIdx = target.lineIndex
      const lineTop =
        isUniform || !itemOffsets ? targetLineIdx * lineHeight : itemOffsets[targetLineIdx]
      const lineH =
        isUniform || !itemHeights ? lineHeight : itemHeights[targetLineIdx] || lineHeight

      const container = containerRef.current
      if (!container) return

      const cHeight = container.clientHeight || containerHeight
      const currentScrollTop = container.scrollTop

      const isVisible =
        lineTop >= currentScrollTop + 10 && lineTop + lineH <= currentScrollTop + cHeight - 10

      if (!isVisible) {
        const targetScrollTop = Math.max(
          0,
          lineTop - Math.floor(cHeight / 2) + Math.floor(lineH / 2)
        )
        container.scrollTop = targetScrollTop
        setScrollTop(targetScrollTop)
      }

      const scrollActiveMatch = () => {
        const activeElement = container.querySelector(`[data-match-index="${currentMatchIndex}"]`)
        if (activeElement) {
          activeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          })
        }
      }

      requestAnimationFrame(scrollActiveMatch)
    }
  }, [
    currentMatchIndex,
    searchMatchLocations,
    isUniform,
    itemOffsets,
    itemHeights,
    containerRef,
    containerHeight,
    lineHeight
  ])

  // Scroll to target line when targetFlashLine changes
  useEffect(() => {
    if (targetFlashLine !== null && lines.length > 0) {
      const idx = lines.findIndex((l) => l.originalIndex === targetFlashLine)
      if (idx !== -1) {
        const lineTop = isUniform || !itemOffsets ? idx * lineHeight : itemOffsets[idx]
        const lineH = isUniform || !itemHeights ? lineHeight : itemHeights[idx] || lineHeight
        const container = containerRef.current
        if (container) {
          const cHeight = container.clientHeight || containerHeight
          const targetScrollTop = Math.max(
            0,
            lineTop - Math.floor(cHeight / 2) + Math.floor(lineH / 2)
          )
          container.scrollTop = targetScrollTop
          setScrollTop(targetScrollTop)
        }
      }
    }
  }, [
    targetFlashLine,
    lines,
    isUniform,
    itemOffsets,
    itemHeights,
    containerRef,
    containerHeight,
    lineHeight
  ])

  const renderLevelBadge = (level?: LogLevel) => {
    if (!level || level === 'OTHER') return null
    let bgColor = 'rgba(100, 116, 139, 0.15)'
    let textColor = '#64748b'
    let borderColor = 'rgba(100, 116, 139, 0.3)'

    if (level === 'ERROR') {
      bgColor = isDark ? 'rgba(244, 63, 94, 0.25)' : '#ffe4e6'
      textColor = isDark ? '#fb7185' : '#e11d48'
      borderColor = isDark ? 'rgba(244, 63, 94, 0.45)' : '#fda4af'
    } else if (level === 'WARN') {
      bgColor = isDark ? 'rgba(234, 179, 8, 0.25)' : '#fef9c3'
      textColor = isDark ? '#facc15' : '#ca8a04'
      borderColor = isDark ? 'rgba(234, 179, 8, 0.45)' : '#fef08a'
    } else if (level === 'INFO') {
      bgColor = isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff'
      textColor = isDark ? '#60a5fa' : '#2563eb'
      borderColor = isDark ? 'rgba(59, 130, 246, 0.4)' : '#bfdbfe'
    } else if (level === 'DEBUG') {
      bgColor = isDark ? 'rgba(16, 185, 129, 0.2)' : '#f0fdf4'
      textColor = isDark ? '#34d399' : '#16a34a'
      borderColor = isDark ? 'rgba(16, 185, 129, 0.4)' : '#bbf7d0'
    }

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '0 5px',
          marginRight: '6px',
          borderRadius: '3px',
          fontSize: '0.78em',
          fontWeight: 700,
          lineHeight: '1.4',
          backgroundColor: bgColor,
          color: textColor,
          border: `1px solid ${borderColor}`,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          verticalAlign: 'middle'
        }}
      >
        {level}
      </span>
    )
  }

  const contentWidth = wordWrap ? '100%' : `${Math.max(containerWidth, maxLineWidth)}px`

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      onScroll={handleScroll}
      onDoubleClick={handleSelection}
      onMouseUp={handleSelection}
      style={{
        background: isDark ? '#09090b' : '#ffffff',
        color: isDark ? '#e4e4e7' : '#1e293b',
        fontFamily: 'Fira Code, JetBrains Mono, ui-monospace, monospace',
        fontSize: `${fontSize}px`,
        lineHeight: '1.5',
        flex: 1,
        overflow: 'auto',
        borderRadius: 8,
        padding: '8px 4px',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.08)',
        minHeight: 0,
        position: 'relative'
      }}
    >
      {lineCount === 0 ? (
        <div style={{ padding: '20px', color: isDark ? '#71717a' : '#94a3b8' }}>
          No matching log entries...
        </div>
      ) : (
        <div
          style={{
            height: `${totalHeight}px`,
            position: 'relative',
            width: contentWidth,
            minWidth: '100%'
          }}
        >
          {visibleLines.map((item, idx) => {
            const actualIndex = startIndex + idx
            const topOffset =
              isUniform || !itemOffsets ? actualIndex * lineHeight : itemOffsets[actualIndex]
            const height = isUniform || !itemHeights ? lineHeight : itemHeights[actualIndex]
            const originalIndex = item.originalIndex
            const markColor = (markedLines || {})[originalIndex]
            const isBookmarked = !!(bookmarkedLines || {})[originalIndex]
            const bookmarkData = (bookmarkedLines || {})[originalIndex]
            const isFlashing = targetFlashLine === originalIndex

            const bookmarkTitle = isBookmarked
              ? bookmarkData?.name
                ? `Bookmark: ${bookmarkData.name}`
                : 'Remove Bookmark (Pin)'
              : 'Bookmark Line (Pin)'

            const isPayloadExpanded = !!(
              expandedPayloadLines && expandedPayloadLines[originalIndex]
            )
            const detectedPayload =
              isPayloadExpanded || item.text.includes('{') || item.text.includes('<')
                ? detectPayload(item.text)
                : null

            let className = 'log-line'
            if (markColor) className += ` marked-${markColor}`
            if (isBookmarked) className += ' is-bookmarked'
            if (isFlashing) className += ' flash-highlight'
            if (item.isContext) className += ' is-context-line'
            if (isPayloadExpanded) className += ' has-expanded-payload'

            const lineStyle: React.CSSProperties = {
              position: 'absolute',
              top: `${topOffset}px`,
              left: 0,
              width: contentWidth,
              minWidth: '100%',
              height: `${height}px`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '4px solid transparent'
            }

            if (markColor) {
              const colorMap: Record<string, { bg: string; text: string; border: string }> = {
                blue: { bg: '#3b82f6', text: '#ffffff', border: '#1d4ed8' },
                red: { bg: '#ef4444', text: '#ffffff', border: '#b91c1c' },
                green: { bg: '#10b981', text: '#ffffff', border: '#047857' },
                orange: { bg: '#f97316', text: '#ffffff', border: '#c2410c' },
                purple: { bg: '#8b5cf6', text: '#ffffff', border: '#6d28d9' }
              }
              const config = colorMap[markColor]
              if (config) {
                lineStyle.backgroundColor = config.bg
                lineStyle.color = config.text
                lineStyle.borderLeft = `4px solid ${config.border}`
              }
            } else if (item.isContext) {
              lineStyle.backgroundColor = isDark
                ? 'rgba(168, 85, 247, 0.12)'
                : 'rgba(168, 85, 247, 0.06)'
              lineStyle.borderLeft = isDark ? '4px dashed #a855f7' : '4px dashed #9333ea'
              lineStyle.opacity = 0.9
            } else if (item.level === 'ERROR') {
              lineStyle.backgroundColor = isDark ? 'rgba(244, 63, 94, 0.32)' : '#ffe4e6'
              lineStyle.borderLeft = isDark ? '4px solid #f43f5e' : '4px solid #e11d48'
            } else if (item.level === 'WARN') {
              lineStyle.backgroundColor = isDark ? 'rgba(234, 179, 8, 0.24)' : '#fef9c3'
              lineStyle.borderLeft = isDark ? '4px solid #eab308' : '4px solid #ca8a04'
            }

            return (
              <div
                key={`${originalIndex}-${actualIndex}`}
                className={className}
                data-original-index={originalIndex}
                data-line-index={actualIndex}
                data-timestamp={item.timestamp || ''}
                data-level={item.level || 'OTHER'}
                onContextMenu={(e) => onContextMenu(e, originalIndex, item.timestamp, item.text)}
                onMouseEnter={() => onHoverLine?.(originalIndex, item.text)}
                style={lineStyle}
              >
                {/* Main Log Line Content Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    width: '100%',
                    lineHeight: `${lineHeight}px`,
                    whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                    wordBreak: wordWrap ? 'break-all' : 'normal'
                  }}
                >
                  {showLineNumbers && (
                    <span
                      className="log-line-num"
                      style={{
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        display: 'inline-block',
                        minWidth: `${maxLineDigits}ch`,
                        textAlign: 'right',
                        marginRight: '8px',
                        opacity: 0.45,
                        fontSize: '0.9em',
                        color: 'inherit',
                        alignSelf: 'stretch'
                      }}
                    >
                      {originalIndex + 1}
                    </span>
                  )}
                  {item.isContext && (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0 5px',
                        marginRight: '6px',
                        borderRadius: '3px',
                        fontSize: '0.75em',
                        fontWeight: 600,
                        lineHeight: '1.4',
                        backgroundColor: isDark
                          ? 'rgba(168, 85, 247, 0.25)'
                          : 'rgba(147, 51, 234, 0.15)',
                        color: isDark ? '#c084fc' : '#7e22ce',
                        border: isDark
                          ? '1px solid rgba(168, 85, 247, 0.4)'
                          : '1px solid rgba(147, 51, 234, 0.3)',
                        userSelect: 'none',
                        flexShrink: 0
                      }}
                    >
                      Context
                    </span>
                  )}
                  <span
                    className={`log-bookmark-btn${isBookmarked ? ' active' : ''}`}
                    title={bookmarkTitle}
                    data-bookmark-index={originalIndex}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleBookmark(originalIndex, item.text, item.timestamp)
                    }}
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                      marginRight: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      backgroundColor: isBookmarked ? '#faad14' : 'transparent',
                      color: isBookmarked
                        ? '#141414'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.3)'
                          : 'rgba(0, 0, 0, 0.3)',
                      boxShadow: isBookmarked ? '0 0 8px rgba(250, 173, 20, 0.65)' : 'none',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}
                  >
                    {isBookmarked ? (
                      <PushpinFilled style={{ fontSize: '12px' }} />
                    ) : (
                      <PushpinOutlined style={{ fontSize: '12px' }} />
                    )}
                  </span>
                  {isBookmarked && bookmarkData?.name && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: 'rgba(250, 173, 20, 0.15)',
                        color: isDark ? '#fadb14' : '#d48806',
                        border: '1px solid rgba(250, 173, 20, 0.4)',
                        borderRadius: '3px',
                        fontSize: '11px',
                        padding: '0 5px',
                        marginRight: '6px',
                        lineHeight: '18px',
                        height: '18px',
                        fontWeight: 500,
                        userSelect: 'none',
                        flexShrink: 0
                      }}
                      title={`Bookmark Label: ${bookmarkData.name}`}
                    >
                      🏷️ {bookmarkData.name}
                    </span>
                  )}
                  {renderLevelBadge(item.level)}
                  {/* Inline Payload Badge */}
                  {detectedPayload && (
                    <span
                      className="log-payload-badge"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleExpandPayload?.(originalIndex)
                      }}
                      title={`Click to ${isPayloadExpanded ? 'collapse' : 'expand'} formatted ${detectedPayload.type.toUpperCase()}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0 5px',
                        marginRight: '6px',
                        borderRadius: '3px',
                        fontSize: '0.74em',
                        fontWeight: 700,
                        lineHeight: '1.4',
                        cursor: 'pointer',
                        backgroundColor:
                          detectedPayload.type === 'json'
                            ? isDark
                              ? 'rgba(59, 130, 246, 0.22)'
                              : '#eff6ff'
                            : isDark
                              ? 'rgba(249, 115, 22, 0.22)'
                              : '#fff7ed',
                        color:
                          detectedPayload.type === 'json'
                            ? isDark
                              ? '#60a5fa'
                              : '#2563eb'
                            : isDark
                              ? '#fb923c'
                              : '#ea580c',
                        border: `1px solid ${
                          detectedPayload.type === 'json'
                            ? isDark
                              ? 'rgba(59, 130, 246, 0.45)'
                              : '#bfdbfe'
                            : isDark
                              ? 'rgba(249, 115, 22, 0.45)'
                              : '#fed7aa'
                        }`,
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        flexShrink: 0,
                        verticalAlign: 'middle',
                        marginTop: 2
                      }}
                    >
                      {detectedPayload.type === 'json' ? '{ } JSON' : '< > XML'}
                    </span>
                  )}
                  <span
                    className="log-text-content"
                    dangerouslySetInnerHTML={{
                      __html: renderHighlightedText(item.text, actualIndex)
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      wordBreak: 'break-all'
                    }}
                  />
                </div>

                {/* Inline Formatted Payload Box */}
                {isPayloadExpanded && detectedPayload && (
                  <div
                    className="inline-payload-box"
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.stopPropagation()}
                    style={{
                      margin: '4px 8px 6px 36px',
                      borderRadius: '6px',
                      border: `1px solid ${isDark ? '#30363d' : '#d0d7de'}`,
                      backgroundColor: isDark ? '#161b22' : '#f6f8fa',
                      boxShadow: isDark
                        ? '0 4px 12px rgba(0, 0, 0, 0.5)'
                        : '0 2px 8px rgba(0, 0, 0, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      height: `${INLINE_PAYLOAD_HEIGHT - 12}px`,
                      overflow: 'hidden',
                      lineHeight: '1.4'
                    }}
                  >
                    {/* Inline Header Toolbar */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 10px',
                        backgroundColor: isDark ? '#1f242c' : '#f1f5f9',
                        borderBottom: `1px solid ${isDark ? '#30363d' : '#e2e8f0'}`,
                        fontSize: '11px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: detectedPayload.type === 'json' ? '#3b82f6' : '#f97316'
                          }}
                        >
                          {detectedPayload.type.toUpperCase()} Payload
                        </span>
                        <span style={{ color: isDark ? '#8b949e' : '#64748b' }}>
                          {detectedPayload.summary}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(detectedPayload.formatted)
                            message.success('Formatted payload copied to clipboard')
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '11px',
                            color: isDark ? '#93c5fd' : '#2563eb',
                            padding: '2px 6px',
                            borderRadius: 3
                          }}
                          title="Copy formatted text"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => {
                            onOpenPayloadDrawer?.(originalIndex, item.text)
                          }}
                          style={{
                            background: isDark ? '#238636' : '#10b981',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: 3,
                            fontWeight: 500
                          }}
                          title="Open in full-featured Side Drawer"
                        >
                          Open Drawer ↗
                        </button>
                        <button
                          onClick={() => onToggleExpandPayload?.(originalIndex)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: isDark ? '#8b949e' : '#64748b',
                            padding: '0 4px'
                          }}
                          title="Collapse"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {/* Inline Preformatted Code Area */}
                    <div
                      style={{
                        flex: 1,
                        overflow: 'auto',
                        padding: '8px 12px',
                        fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                        fontSize: '11.5px',
                        color: isDark ? '#c9d1d9' : '#24292f'
                      }}
                    >
                      <pre style={{ margin: 0, whiteSpace: 'pre' }}>
                        {detectedPayload.formatted}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
