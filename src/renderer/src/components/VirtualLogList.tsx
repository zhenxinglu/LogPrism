import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { PushpinFilled, PushpinOutlined } from '@ant-design/icons'
import type { LogLevel } from './LogTimeline'

export interface LogLineData {
  text: string
  originalIndex: number
  timestamp: string | null
  level?: LogLevel
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
}

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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
  isDark
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

  // Calculate layout (heights, offsets, and max width for horizontal scrolling)
  const { itemHeights, itemOffsets, totalHeight, maxLineWidth } = useMemo(() => {
    const heights: number[] = new Array(lineCount)
    const offsets: number[] = new Array(lineCount + 1)
    offsets[0] = 0

    let charWidth = fontSize * 0.6
    let ctx: CanvasRenderingContext2D | null = null
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.font = `${fontSize}px "Fira Code", "JetBrains Mono", ui-monospace, monospace`
        charWidth = ctx.measureText('M').width || fontSize * 0.6
      }
    }

    const lineNumWidth = showLineNumbers ? maxLineDigits * fontSize * 0.65 + 30 : 30
    const bookmarkWidth = 28
    const containerPaddingAndScrollbar = 50 // padding (24px) + scrollbar buffer (16px) + margin (10px)
    const availableTextWidth = Math.max(
      100,
      containerWidth - lineNumWidth - bookmarkWidth - containerPaddingAndScrollbar
    )

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

      const h = wraps * lineHeight
      heights[i] = h
      offsets[i + 1] = offsets[i] + h
    }

    const maxTotalLineWidth = maxTextWidth + lineNumWidth + bookmarkWidth + 40

    return {
      itemHeights: heights,
      itemOffsets: offsets,
      totalHeight: offsets[lineCount] || 0,
      maxLineWidth: maxTotalLineWidth
    }
  }, [
    lines,
    fontSize,
    wordWrap,
    showLineNumbers,
    maxLineDigits,
    containerWidth,
    lineHeight,
    lineCount
  ])

  // Binary search to find visible line indices based on dynamic offsets
  const startIndex = useMemo(() => {
    const target = Math.max(0, scrollTop - overscan * lineHeight)
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
  }, [itemOffsets, scrollTop, lineHeight, overscan])

  const endIndex = useMemo(() => {
    const target = scrollTop + containerHeight + overscan * lineHeight
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
  }, [itemOffsets, startIndex, scrollTop, containerHeight, lineHeight, lineCount, overscan])

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

    for (let i = 0; i < lines.length; i++) {
      startIndices[i] = cumulative
      const text = lines[i].text || ''
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      let matchInLineIndex = 0
      while ((m = regex.exec(text)) !== null) {
        locations.push({
          lineIndex: i,
          matchInLineIndex,
          globalIndex: cumulative + matchInLineIndex
        })
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

  const handleSelection = useCallback(() => {
    if (!onHighlightWordChange) return
    const selection = window.getSelection()
    if (!selection) return
    const selectedText = selection.toString().trim()
    if (selectedText && !selectedText.includes('\n') && selectedText.length <= 200) {
      lastSetTimeRef.current = Date.now()
      if (selectedText !== highlightWord) {
        onHighlightWordChange(selectedText)
      }
    } else if (!selectedText && highlightWord) {
      if (Date.now() - lastSetTimeRef.current > 350) {
        onHighlightWordChange('')
      }
    }
  }, [highlightWord, onHighlightWordChange])

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
      itemOffsets.length > 0
    ) {
      const target = searchMatchLocations[currentMatchIndex]
      const targetLineIdx = target.lineIndex
      const lineTop = itemOffsets[targetLineIdx]
      const lineH = itemHeights[targetLineIdx] || lineHeight

      const container = containerRef.current
      if (!container) return

      const cHeight = container.clientHeight || containerHeight
      const currentScrollTop = container.scrollTop

      const isVisible =
        lineTop >= currentScrollTop + 10 &&
        lineTop + lineH <= currentScrollTop + cHeight - 10

      if (!isVisible) {
        const targetScrollTop = Math.max(
          0,
          lineTop - Math.floor(cHeight / 2) + Math.floor(lineH / 2)
        )
        container.scrollTop = targetScrollTop
        setScrollTop(targetScrollTop)
      }

      const scrollActiveMatch = () => {
        const activeElement = container.querySelector(
          `[data-match-index="${currentMatchIndex}"]`
        )
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
    itemOffsets,
    itemHeights,
    containerRef,
    containerHeight,
    lineHeight
  ])

  // Scroll to target line when targetFlashLine changes
  useEffect(() => {
    if (targetFlashLine !== null && lines.length > 0 && itemOffsets.length > 0) {
      const idx = lines.findIndex((l) => l.originalIndex === targetFlashLine)
      if (idx !== -1 && itemOffsets.length > idx) {
        const lineTop = itemOffsets[idx]
        const lineH = itemHeights[idx] || lineHeight
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
  }, [targetFlashLine, lines, itemOffsets, itemHeights, containerRef, containerHeight, lineHeight])

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
            const topOffset = itemOffsets[actualIndex]
            const height = itemHeights[actualIndex]
            const originalIndex = item.originalIndex
            const markColor = (markedLines || {})[originalIndex]
            const isBookmarked = !!((bookmarkedLines || {})[originalIndex])
            const bookmarkData = (bookmarkedLines || {})[originalIndex]
            const isFlashing = targetFlashLine === originalIndex

            const bookmarkTitle = isBookmarked
              ? bookmarkData?.name
                ? `Bookmark: ${bookmarkData.name}`
                : 'Remove Bookmark (Pin)'
              : 'Bookmark Line (Pin)'

            let className = 'log-line'
            if (markColor) className += ` marked-${markColor}`
            if (isBookmarked) className += ' is-bookmarked'
            if (isFlashing) className += ' flash-highlight'

            const lineStyle: React.CSSProperties = {
              position: 'absolute',
              top: `${topOffset}px`,
              left: 0,
              width: contentWidth,
              minWidth: '100%',
              height: `${height}px`,
              lineHeight: `${lineHeight}px`,
              overflow: 'hidden',
              whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
              wordBreak: wordWrap ? 'break-all' : 'normal',
              display: 'flex',
              alignItems: 'flex-start',
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
                data-timestamp={item.timestamp || ''}
                data-level={item.level || 'OTHER'}
                onContextMenu={(e) => onContextMenu(e, originalIndex, item.timestamp, item.text)}
                style={lineStyle}
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
                    color: isBookmarked ? '#141414' : (isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'),
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
                <span
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
            )
          })}
        </div>
      )}
    </div>
  )
}
