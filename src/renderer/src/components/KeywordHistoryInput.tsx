import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Input, Dropdown, Button, Typography, Tooltip, type InputRef } from 'antd'
import { HistoryOutlined, CloseOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

const { Text } = Typography

export interface KeywordHistoryInputProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  storageKey: string
  isDark?: boolean
  size?: 'small' | 'middle' | 'large'
  allowClear?: boolean
  style?: React.CSSProperties
  onPressEnter?: () => void
}

const MAX_HISTORY_ITEMS = 30

export const KeywordHistoryInput: React.FC<KeywordHistoryInputProps> = ({
  value,
  onChange,
  placeholder,
  storageKey,
  isDark = false,
  size = 'small',
  allowClear = true,
  style,
  onPressEnter
}) => {
  const { t } = useTranslation()
  const [history, setHistory] = useState<string[]>([])
  const [isFocused, setIsFocused] = useState<boolean>(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const inputRef = useRef<InputRef>(null)

  // Load history from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setHistory(parsed.filter((item) => typeof item === 'string' && item.trim().length > 0))
        }
      }
    } catch (e) {
      console.error('Failed to load keyword history:', e)
    }
  }, [storageKey])

  // Save history array to localStorage
  const saveHistoryToStorage = (newList: string[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newList))
    } catch (e) {
      console.error('Failed to save keyword history:', e)
    }
  }

  // Add keyword to history list
  const addKeywordToHistory = (keyword: string) => {
    const trimmed = keyword.trim()
    if (!trimmed) return
    setHistory((prev) => {
      const filtered = prev.filter((item) => item !== trimmed)
      const next = [trimmed, ...filtered].slice(0, MAX_HISTORY_ITEMS)
      saveHistoryToStorage(next)
      return next
    })
  }

  // Delete individual keyword item from history list
  const deleteHistoryItem = (itemToDelete: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    setHistory((prev) => {
      const next = prev.filter((item) => item !== itemToDelete)
      saveHistoryToStorage(next)
      return next
    })
  }

  // Clear all history items
  const clearAllHistory = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    setHistory([])
    try {
      localStorage.removeItem(storageKey)
    } catch (err) {
      console.error('Failed to remove keyword history:', err)
    }
  }

  // Select an item from the history dropdown
  const handleSelectHistory = (item: string) => {
    onChange(item)
    addKeywordToHistory(item)
    setIsFocused(false)
  }

  // Filter history items according to input value
  const matchingHistory = useMemo(() => {
    if (!history.length) return []
    const q = value ? value.trim().toLowerCase() : ''
    if (!q) return history.slice(0, 10)
    return history.filter((item) => item.toLowerCase().includes(q)).slice(0, 10)
  }, [history, value])

  const isOpen = isFocused && matchingHistory.length > 0

  const dropdownMenu = (
    <div
      style={{
        background: isDark ? '#1e293b' : '#ffffff',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.18)',
        padding: '4px 0',
        minWidth: 220,
        maxWidth: 400,
        overflow: 'hidden'
      }}
      onMouseDown={(e) => {
        // Prevent input from losing focus when clicking inside dropdown container
        e.preventDefault()
      }}
    >
      <div
        style={{
          padding: '4px 10px 6px 10px',
          borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Text style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', fontWeight: 600 }}>
          {t('filter.searchHistory') || 'Search History'}
        </Text>
        <Button
          type="link"
          size="small"
          onClick={clearAllHistory}
          style={{
            fontSize: 11,
            padding: 0,
            height: 18,
            color: isDark ? '#64748b' : '#94a3b8'
          }}
        >
          {t('filter.clearHistory') || 'Clear History'}
        </Button>
      </div>

      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {matchingHistory.map((item, idx) => {
          const isHovered = hoveredIndex === idx
          return (
            <div
              key={`${item}-${idx}`}
              onClick={() => handleSelectHistory(item)}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 12,
                backgroundColor: isHovered ? (isDark ? '#334155' : '#f1f5f9') : 'transparent',
                transition: 'background-color 0.15s ease'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  overflow: 'hidden',
                  flex: 1,
                  marginRight: 8
                }}
              >
                <HistoryOutlined
                  style={{
                    fontSize: 12,
                    color: isDark ? '#64748b' : '#94a3b8',
                    flexShrink: 0
                  }}
                />
                <Text
                  ellipsis={{ tooltip: item }}
                  style={{
                    fontSize: 12,
                    color: isDark ? '#cbd5e1' : '#334155',
                    flex: 1
                  }}
                >
                  {item}
                </Text>
              </div>
              <Tooltip title={t('filter.deleteHistoryItem') || 'Remove from history'}>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined style={{ fontSize: 10 }} />}
                  onClick={(e) => deleteHistoryItem(item, e)}
                  style={{
                    width: 20,
                    height: 20,
                    minWidth: 20,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    color: isDark ? '#64748b' : '#94a3b8'
                  }}
                />
              </Tooltip>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <Dropdown
      open={isOpen}
      dropdownRender={() => dropdownMenu}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Input
        ref={inputRef}
        size={size}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false)
          if (value && value.trim()) {
            addKeywordToHistory(value)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (value && value.trim()) {
              addKeywordToHistory(value)
            }
            setIsFocused(false)
            if (onPressEnter) onPressEnter()
          } else if (e.key === 'Escape') {
            setIsFocused(false)
          }
        }}
        allowClear={allowClear}
        style={style}
      />
    </Dropdown>
  )
}
