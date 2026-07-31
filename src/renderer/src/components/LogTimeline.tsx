import React, { useMemo, useState, useRef, useCallback } from 'react'
import { Typography, Tag, Space, Button, Tooltip } from 'antd'
import {
  BarChartOutlined,
  ReloadOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  BugOutlined
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'

const { Text } = Typography

export interface LogLineData {
  text: string
  originalIndex: number
  timestamp: string | null
}

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'OTHER'

export interface LogTimelineProps {
  lines: LogLineData[]
  startTime: Dayjs | null
  endTime: Dayjs | null
  onSelectTimeRange: (start: Dayjs, end: Dayjs) => void
  onResetTimeRange: () => void
  isDark: boolean
}

interface TimeBucket {
  index: number
  startTimeMs: number
  endTimeMs: number
  startTimeStr: string
  endTimeStr: string
  totalCount: number
  errorCount: number
  warnCount: number
  infoCount: number
  debugCount: number
  otherCount: number
}

// Regex patterns to detect log levels
const ERROR_REGEX = /\b(error|fatal|err|exception|fail|failed|severe|critical)\b/i
const WARN_REGEX = /\b(warn|warning)\b/i
const INFO_REGEX = /\b(info|notice)\b/i
const DEBUG_REGEX = /\b(debug|trace|verbose)\b/i

export const detectLogLevel = (text: string): LogLevel => {
  if (ERROR_REGEX.test(text)) return 'ERROR'
  if (WARN_REGEX.test(text)) return 'WARN'
  if (INFO_REGEX.test(text)) return 'INFO'
  if (DEBUG_REGEX.test(text)) return 'DEBUG'
  return 'OTHER'
}

const parseTimestampToMs = (tsStr: string): number | null => {
  if (!tsStr) return null
  // Try format HH:mm:ss.SSS or full ISO / date
  let d = dayjs(tsStr, 'HH:mm:ss.SSS')
  if (!d.isValid()) {
    d = dayjs(tsStr, 'HH:mm:ss')
  }
  if (!d.isValid()) {
    d = dayjs(tsStr)
  }
  return d.isValid() ? d.valueOf() : null
}

export const LogTimeline: React.FC<LogTimelineProps> = ({
  lines,
  startTime,
  endTime,
  onSelectTimeRange,
  onResetTimeRange,
  isDark
}) => {
  const { t } = useTranslation()
  const [hoveredBucket, setHoveredBucket] = useState<TimeBucket | null>(null)
  const [visibleLevels, setVisibleLevels] = useState<Record<LogLevel, boolean>>({
    ERROR: true,
    WARN: true,
    INFO: true,
    DEBUG: true,
    OTHER: true
  })

  const timelineContainerRef = useRef<HTMLDivElement>(null)
  const [dragStartPercent, setDragStartPercent] = useState<number | null>(null)
  const [dragCurrentPercent, setDragCurrentPercent] = useState<number | null>(null)
  const isDraggingRef = useRef(false)

  // Extract entries with timestamps and timestamps range
  const { buckets, globalMinMs, globalMaxMs, totalStats } = useMemo(() => {
    const timestampedItems: { ms: number; level: LogLevel; line: LogLineData }[] = []
    let totalError = 0
    let totalWarn = 0
    let totalInfo = 0
    let totalDebug = 0
    let totalOther = 0

    lines.forEach((line) => {
      if (line.timestamp) {
        const ms = parseTimestampToMs(line.timestamp)
        if (ms !== null) {
          const level = detectLogLevel(line.text)
          timestampedItems.push({ ms, level, line })
          if (level === 'ERROR') totalError++
          else if (level === 'WARN') totalWarn++
          else if (level === 'INFO') totalInfo++
          else if (level === 'DEBUG') totalDebug++
          else totalOther++
        }
      }
    })

    if (timestampedItems.length === 0) {
      return {
        buckets: [],
        globalMinMs: 0,
        globalMaxMs: 0,
        totalStats: { total: 0, error: 0, warn: 0, info: 0, debug: 0, other: 0 }
      }
    }

    let minMs = timestampedItems[0].ms
    let maxMs = timestampedItems[0].ms

    for (let i = 1; i < timestampedItems.length; i++) {
      const ms = timestampedItems[i].ms
      if (ms < minMs) minMs = ms
      if (ms > maxMs) maxMs = ms
    }

    // Expand span if min === max
    if (minMs === maxMs) {
      minMs = minMs - 30000 // -30s
      maxMs = maxMs + 30000 // +30s
    }

    const NUM_BUCKETS = 60
    const span = maxMs - minMs
    const bucketWidthMs = span / NUM_BUCKETS

    const bucketList: TimeBucket[] = Array.from({ length: NUM_BUCKETS }, (_, i) => {
      const bStart = minMs + i * bucketWidthMs
      const bEnd = minMs + (i + 1) * bucketWidthMs
      return {
        index: i,
        startTimeMs: bStart,
        endTimeMs: bEnd,
        startTimeStr: dayjs(bStart).format('HH:mm:ss'),
        endTimeStr: dayjs(bEnd).format('HH:mm:ss'),
        totalCount: 0,
        errorCount: 0,
        warnCount: 0,
        infoCount: 0,
        debugCount: 0,
        otherCount: 0
      }
    })

    timestampedItems.forEach(({ ms, level }) => {
      let bIdx = Math.floor((ms - minMs) / bucketWidthMs)
      if (bIdx < 0) bIdx = 0
      if (bIdx >= NUM_BUCKETS) bIdx = NUM_BUCKETS - 1

      const bucket = bucketList[bIdx]
      bucket.totalCount++
      if (level === 'ERROR') bucket.errorCount++
      else if (level === 'WARN') bucket.warnCount++
      else if (level === 'INFO') bucket.infoCount++
      else if (level === 'DEBUG') bucket.debugCount++
      else bucket.otherCount++
    })

    return {
      buckets: bucketList,
      globalMinMs: minMs,
      globalMaxMs: maxMs,
      totalStats: {
        total: timestampedItems.length,
        error: totalError,
        warn: totalWarn,
        info: totalInfo,
        debug: totalDebug,
        other: totalOther
      }
    }
  }, [lines])

  // Highest count among buckets for vertical scale calculation
  const maxBucketCount = useMemo(() => {
    let max = 1
    buckets.forEach((b) => {
      let count = 0
      if (visibleLevels.ERROR) count += b.errorCount
      if (visibleLevels.WARN) count += b.warnCount
      if (visibleLevels.INFO) count += b.infoCount
      if (visibleLevels.DEBUG) count += b.debugCount
      if (visibleLevels.OTHER) count += b.otherCount
      if (count > max) max = count
    })
    return max
  }, [buckets, visibleLevels])

  // Active time window selection calculation
  const activeOverlayPercent = useMemo(() => {
    if (!globalMinMs || !globalMaxMs || globalMinMs === globalMaxMs) return null
    const span = globalMaxMs - globalMinMs

    let startMs = globalMinMs
    let endMs = globalMaxMs

    if (startTime) {
      const sMs = parseTimestampToMs(startTime.format('HH:mm:ss.SSS'))
      if (sMs !== null) startMs = Math.max(globalMinMs, sMs)
    }

    if (endTime) {
      const eMs = parseTimestampToMs(endTime.format('HH:mm:ss.SSS'))
      if (eMs !== null) endMs = Math.min(globalMaxMs, eMs)
    }

    const startPct = Math.max(0, Math.min(100, ((startMs - globalMinMs) / span) * 100))
    const endPct = Math.max(0, Math.min(100, ((endMs - globalMinMs) / span) * 100))

    const isFiltered =
      (startTime && startTime.format('HH:mm:ss.SSS') !== '00:00:00.000') ||
      (endTime && endTime.format('HH:mm:ss.SSS') !== '23:59:59.999')

    return { startPct, endPct, isFiltered }
  }, [startTime, endTime, globalMinMs, globalMaxMs])

  // Handle Level Tag toggle
  const toggleLevel = (level: LogLevel) => {
    setVisibleLevels((prev) => ({
      ...prev,
      [level]: !prev[level]
    }))
  }

  // Handle bucket click
  const handleBucketClick = (bucket: TimeBucket) => {
    const s = dayjs(bucket.startTimeMs)
    const e = dayjs(bucket.endTimeMs)
    onSelectTimeRange(s, e)
  }

  // Drag select handlers
  const getPercentFromX = useCallback((clientX: number): number | null => {
    if (!timelineContainerRef.current) return null
    const rect = timelineContainerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
    return pct
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Left click only
    const pct = getPercentFromX(e.clientX)
    if (pct !== null) {
      isDraggingRef.current = true
      setDragStartPercent(pct)
      setDragCurrentPercent(pct)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return
    const pct = getPercentFromX(e.clientX)
    if (pct !== null) {
      setDragCurrentPercent(pct)
    }
  }

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    if (
      dragStartPercent !== null &&
      dragCurrentPercent !== null &&
      Math.abs(dragStartPercent - dragCurrentPercent) > 1 &&
      globalMinMs &&
      globalMaxMs
    ) {
      const minPct = Math.min(dragStartPercent, dragCurrentPercent)
      const maxPct = Math.max(dragStartPercent, dragCurrentPercent)
      const span = globalMaxMs - globalMinMs

      const startMs = globalMinMs + (minPct / 100) * span
      const endMs = globalMinMs + (maxPct / 100) * span

      onSelectTimeRange(dayjs(startMs), dayjs(endMs))
    }

    setDragStartPercent(null)
    setDragCurrentPercent(null)
  }

  if (buckets.length === 0) {
    return (
      <div
        style={{
          padding: '8px 12px',
          marginBottom: 8,
          borderRadius: 8,
          background: isDark ? 'rgba(24, 24, 28, 0.6)' : 'rgba(255, 255, 255, 0.8)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
          fontSize: 12,
          color: isDark ? '#71717a' : '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        <BarChartOutlined />
        <span>{t('timeline.title')} - No timestamped logs available.</span>
      </div>
    )
  }

  const dragBoxLeft =
    dragStartPercent !== null && dragCurrentPercent !== null
      ? Math.min(dragStartPercent, dragCurrentPercent)
      : 0
  const dragBoxWidth =
    dragStartPercent !== null && dragCurrentPercent !== null
      ? Math.abs(dragCurrentPercent - dragStartPercent)
      : 0

  return (
    <div
      style={{
        padding: '8px 12px',
        marginBottom: 8,
        borderRadius: 8,
        background: isDark ? 'rgba(24, 24, 28, 0.7)' : 'rgba(255, 255, 255, 0.9)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
        boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
        userSelect: 'none'
      }}
    >
      {/* Header & Badges */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
          flexWrap: 'wrap',
          gap: 6
        }}
      >
        <Space size={8}>
          <BarChartOutlined style={{ color: '#3b82f6', fontSize: 14 }} />
          <Text style={{ fontWeight: 'bold', fontSize: 13, color: isDark ? '#f1f5f9' : '#1e293b' }}>
            {t('timeline.title')}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            ({t('timeline.totalLogs', { count: totalStats.total })} from{' '}
            {dayjs(globalMinMs).format('HH:mm:ss')} to {dayjs(globalMaxMs).format('HH:mm:ss')})
          </Text>
        </Space>

        <Space size={6} wrap>
          {/* Level Badges */}
          <Tag
            color={visibleLevels.ERROR ? 'red' : 'default'}
            style={{ cursor: 'pointer', margin: 0 }}
            onClick={() => toggleLevel('ERROR')}
          >
            <CloseCircleOutlined style={{ marginRight: 4 }} />
            {t('timeline.levelError')}: <b>{totalStats.error}</b>
          </Tag>
          <Tag
            color={visibleLevels.WARN ? 'warning' : 'default'}
            style={{ cursor: 'pointer', margin: 0 }}
            onClick={() => toggleLevel('WARN')}
          >
            <WarningOutlined style={{ marginRight: 4 }} />
            {t('timeline.levelWarn')}: <b>{totalStats.warn}</b>
          </Tag>
          <Tag
            color={visibleLevels.INFO ? 'blue' : 'default'}
            style={{ cursor: 'pointer', margin: 0 }}
            onClick={() => toggleLevel('INFO')}
          >
            <InfoCircleOutlined style={{ marginRight: 4 }} />
            {t('timeline.levelInfo')}: <b>{totalStats.info}</b>
          </Tag>
          <Tag
            color={visibleLevels.DEBUG ? 'purple' : 'default'}
            style={{ cursor: 'pointer', margin: 0 }}
            onClick={() => toggleLevel('DEBUG')}
          >
            <BugOutlined style={{ marginRight: 4 }} />
            {t('timeline.levelDebug')}: <b>{totalStats.debug}</b>
          </Tag>
          <Tag
            color={visibleLevels.OTHER ? 'cyan' : 'default'}
            style={{ cursor: 'pointer', margin: 0 }}
            onClick={() => toggleLevel('OTHER')}
          >
            {t('timeline.levelOther')}: <b>{totalStats.other}</b>
          </Tag>

          {activeOverlayPercent?.isFiltered && (
            <Button
              type="primary"
              ghost
              danger
              size="small"
              icon={<ReloadOutlined />}
              onClick={onResetTimeRange}
              style={{ fontSize: 11, height: 22, padding: '0 8px' }}
            >
              {t('timeline.resetZoom')}
            </Button>
          )}
        </Space>
      </div>

      {/* Mini-map Timeline Bar Chart */}
      <div style={{ position: 'relative' }}>
        <div
          ref={timelineContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
            padding: '4px 0 0 0',
            background: isDark ? 'rgba(15, 15, 18, 0.6)' : 'rgba(241, 245, 249, 0.8)',
            borderRadius: 4,
            border: isDark
              ? '1px solid rgba(255, 255, 255, 0.05)'
              : '1px solid rgba(0, 0, 0, 0.05)',
            cursor: 'crosshair',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Active Filtered Region Overlay */}
          {activeOverlayPercent && activeOverlayPercent.isFiltered && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${activeOverlayPercent.startPct}%`,
                width: `${activeOverlayPercent.endPct - activeOverlayPercent.startPct}%`,
                background: isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.2)',
                borderLeft: '2px solid #3b82f6',
                borderRight: '2px solid #3b82f6',
                pointerEvents: 'none',
                zIndex: 2
              }}
            />
          )}

          {/* Mouse Drag Selection Overlay */}
          {dragStartPercent !== null && dragCurrentPercent !== null && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${dragBoxLeft}%`,
                width: `${dragBoxWidth}%`,
                background: 'rgba(234, 179, 8, 0.35)',
                border: '1px dashed #eab308',
                pointerEvents: 'none',
                zIndex: 3
              }}
            />
          )}

          {/* Stacked Histogram Bars */}
          {buckets.map((b) => {
            const errH = visibleLevels.ERROR ? (b.errorCount / maxBucketCount) * 100 : 0
            const warnH = visibleLevels.WARN ? (b.warnCount / maxBucketCount) * 100 : 0
            const infoH = visibleLevels.INFO ? (b.infoCount / maxBucketCount) * 100 : 0
            const dbgH = visibleLevels.DEBUG ? (b.debugCount / maxBucketCount) * 100 : 0
            const othH = visibleLevels.OTHER ? (b.otherCount / maxBucketCount) * 100 : 0

            const totalH = Math.min(100, errH + warnH + infoH + dbgH + othH)

            const tooltipContent = (
              <div style={{ fontSize: 11, lineHeight: '1.4' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 2 }}>
                  ⏱️ {b.startTimeStr} - {b.endTimeStr}
                </div>
                <div>{t('timeline.totalLogs', { count: b.totalCount })}</div>
                {b.errorCount > 0 && (
                  <div style={{ color: '#f87171' }}>
                    🚨 Error: <b>{b.errorCount}</b>
                  </div>
                )}
                {b.warnCount > 0 && (
                  <div style={{ color: '#fbbf24' }}>
                    ⚠️ Warn: <b>{b.warnCount}</b>
                  </div>
                )}
                {b.infoCount > 0 && (
                  <div style={{ color: '#60a5fa' }}>
                    ℹ️ Info: <b>{b.infoCount}</b>
                  </div>
                )}
                {b.debugCount > 0 && (
                  <div style={{ color: '#c084fc' }}>
                    🐛 Debug: <b>{b.debugCount}</b>
                  </div>
                )}
                {b.otherCount > 0 && (
                  <div style={{ color: '#9ca3af' }}>
                    📄 Other: <b>{b.otherCount}</b>
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#a1a1aa', marginTop: 4 }}>
                  💡 {t('timeline.dragHint')}
                </div>
              </div>
            )

            return (
              <Tooltip key={b.index} title={tooltipContent} placement="top" mouseEnterDelay={0.05}>
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    handleBucketClick(b)
                  }}
                  onMouseEnter={() => setHoveredBucket(b)}
                  onMouseLeave={() => setHoveredBucket(null)}
                  style={{
                    flex: 1,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    cursor: 'pointer',
                    position: 'relative',
                    zIndex: 1,
                    transition: 'opacity 0.15s ease',
                    opacity: hoveredBucket && hoveredBucket.index === b.index ? 1 : 0.85
                  }}
                >
                  {totalH > 0 ? (
                    <div
                      style={{
                        height: `${Math.max(8, totalH)}%`,
                        width: '100%',
                        borderRadius: '2px 2px 0 0',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column-reverse'
                      }}
                    >
                      {/* Error - Red */}
                      {errH > 0 && (
                        <div
                          style={{
                            height: `${(errH / totalH) * 100}%`,
                            background: '#ef4444'
                          }}
                        />
                      )}
                      {/* Warn - Orange */}
                      {warnH > 0 && (
                        <div
                          style={{
                            height: `${(warnH / totalH) * 100}%`,
                            background: '#f59e0b'
                          }}
                        />
                      )}
                      {/* Info - Blue */}
                      {infoH > 0 && (
                        <div
                          style={{
                            height: `${(infoH / totalH) * 100}%`,
                            background: '#3b82f6'
                          }}
                        />
                      )}
                      {/* Debug - Purple */}
                      {dbgH > 0 && (
                        <div
                          style={{
                            height: `${(dbgH / totalH) * 100}%`,
                            background: '#a855f7'
                          }}
                        />
                      )}
                      {/* Other - Gray */}
                      {othH > 0 && (
                        <div
                          style={{
                            height: `${(othH / totalH) * 100}%`,
                            background: isDark ? '#6b7280' : '#9ca3af'
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        height: 2,
                        width: '100%',
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                      }}
                    />
                  )}
                </div>
              </Tooltip>
            )
          })}
        </div>

        {/* Time Scale Labels */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 4,
            fontSize: 10,
            color: isDark ? '#71717a' : '#94a3b8'
          }}
        >
          <span>{dayjs(globalMinMs).format('HH:mm:ss')}</span>
          <span>{dayjs(globalMinMs + (globalMaxMs - globalMinMs) * 0.25).format('HH:mm:ss')}</span>
          <span>{dayjs(globalMinMs + (globalMaxMs - globalMinMs) * 0.5).format('HH:mm:ss')}</span>
          <span>{dayjs(globalMinMs + (globalMaxMs - globalMinMs) * 0.75).format('HH:mm:ss')}</span>
          <span>{dayjs(globalMaxMs).format('HH:mm:ss')}</span>
        </div>
      </div>
    </div>
  )
}
