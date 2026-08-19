import { useState, useEffect, useRef } from 'react'
import type { LogLevel } from '../utils/logParser'
import type {
  FilterWorkerRequest,
  FilterWorkerResponse,
  LogLineData
} from '../workers/logFilterWorker'

interface UseLogFilterWorkerParams {
  content: string
  includeKeywords: string
  excludeKeywords: string
  isIncludeCaseSensitive: boolean
  isExcludeCaseSensitive: boolean
  selectedLogLevels: Record<LogLevel, boolean>
  startTimeStr: string | null
  endTimeStr: string | null
  selectedFormatId: string
  detectedFormatId: string | null
  expandedContexts: Record<number, number>
}

interface UseLogFilterWorkerResult {
  filteredLines: LogLineData[]
  unfilteredTimeLines: LogLineData[]
  matchCount: number
  levelCounts: Record<LogLevel, number>
  detectedFormatId: string | null
  isFiltering: boolean
}

const DEFAULT_LEVEL_COUNTS: Record<LogLevel, number> = {
  ERROR: 0,
  WARN: 0,
  INFO: 0,
  DEBUG: 0,
  OTHER: 0
}

export function useLogFilterWorker({
  content,
  includeKeywords,
  excludeKeywords,
  isIncludeCaseSensitive,
  isExcludeCaseSensitive,
  selectedLogLevels,
  startTimeStr,
  endTimeStr,
  selectedFormatId,
  detectedFormatId,
  expandedContexts
}: UseLogFilterWorkerParams): UseLogFilterWorkerResult {
  const [filteredLines, setFilteredLines] = useState<LogLineData[]>([])
  const [unfilteredTimeLines, setUnfilteredTimeLines] = useState<LogLineData[]>([])
  const [matchCount, setMatchCount] = useState(0)
  const [levelCounts, setLevelCounts] = useState<Record<LogLevel, number>>(DEFAULT_LEVEL_COUNTS)
  const [currentDetectedFormatId, setCurrentDetectedFormatId] = useState<string | null>(null)
  const [isFiltering, setIsFiltering] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const currentJobIdRef = useRef<number>(0)

  // Initialize Web Worker instance
  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('../workers/logFilterWorker.ts', import.meta.url),
        { type: 'module' }
      )

      workerRef.current.onmessage = (e: MessageEvent<FilterWorkerResponse>) => {
        const data = e.data
        // Only accept response if jobId matches current latest job
        if (data && data.jobId === currentJobIdRef.current) {
          setFilteredLines(data.filteredLines)
          setUnfilteredTimeLines(data.unfilteredTimeLines)
          setMatchCount(data.matchCount)
          setLevelCounts(data.levelCounts)
          if (data.detectedFormatId !== undefined) {
            setCurrentDetectedFormatId(data.detectedFormatId)
          }
          setIsFiltering(false)
        }
      }

      workerRef.current.onerror = (err) => {
        console.error('LogFilterWorker error:', err)
        setIsFiltering(false)
      }
    } catch (err) {
      console.error('Failed to create LogFilterWorker:', err)
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  // Trigger filtering when inputs change
  useEffect(() => {
    if (!content) {
      setFilteredLines([])
      setUnfilteredTimeLines([])
      setMatchCount(0)
      setLevelCounts(DEFAULT_LEVEL_COUNTS)
      setCurrentDetectedFormatId(null)
      setIsFiltering(false)
      return
    }

    currentJobIdRef.current += 1
    const jobId = currentJobIdRef.current
    setIsFiltering(true)

    const requestPayload: FilterWorkerRequest = {
      jobId,
      content,
      includeKeywords,
      excludeKeywords,
      isIncludeCaseSensitive,
      isExcludeCaseSensitive,
      selectedLogLevels,
      startTime: startTimeStr,
      endTime: endTimeStr,
      selectedFormatId,
      detectedFormatId,
      expandedContexts
    }

    if (workerRef.current) {
      workerRef.current.postMessage(requestPayload)
    } else {
      // Fallback to synchronous execution if Worker is unavailable
      setIsFiltering(false)
    }
  }, [
    content,
    includeKeywords,
    excludeKeywords,
    isIncludeCaseSensitive,
    isExcludeCaseSensitive,
    selectedLogLevels,
    startTimeStr,
    endTimeStr,
    selectedFormatId,
    detectedFormatId,
    expandedContexts
  ])

  return {
    filteredLines,
    unfilteredTimeLines,
    matchCount,
    levelCounts,
    detectedFormatId: currentDetectedFormatId,
    isFiltering
  }
}
