import React, { useState, useMemo, useCallback } from 'react'
import { Drawer, Radio, Input, Button, Space, Tag, Typography, Tooltip, message } from 'antd'
import {
  CopyOutlined,
  DownOutlined,
  RightOutlined,
  SearchOutlined,
  AppstoreOutlined,
  CodeOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
  CheckOutlined
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { DetectedPayload } from '../utils/payloadDetector'

const { Text } = Typography

export interface PayloadInspectorDrawerProps {
  open: boolean
  payload: DetectedPayload | null
  originalLineNumber?: number
  isDark?: boolean
  onClose: () => void
}

/**
 * Interactive Tree Node for JSON data.
 */
interface JsonTreeNodeProps {
  nodeKey: string | null
  value: any
  depth: number
  searchTerm: string
  expandedKeys: Set<string>
  onToggleExpand: (path: string) => void
  currentPath: string
  isDark: boolean
}

const JsonTreeNode: React.FC<JsonTreeNodeProps> = ({
  nodeKey,
  value,
  depth,
  searchTerm,
  expandedKeys,
  onToggleExpand,
  currentPath,
  isDark
}) => {
  const isObject = value !== null && typeof value === 'object'
  const isArray = Array.isArray(value)
  const isExpanded = expandedKeys.has(currentPath)

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand(currentPath)
  }

  const [copied, setCopied] = useState(false)
  const handleCopyNodeValue = (e: React.MouseEvent) => {
    e.stopPropagation()
    const textToCopy = isObject ? JSON.stringify(value, null, 2) : String(value)
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    message.success('Copied node value to clipboard')
  }

  // Highlight matching search term
  const renderHighlighted = (text: string, defaultColor?: string) => {
    if (!searchTerm || !text) {
      return <span style={{ color: defaultColor }}>{text}</span>
    }
    const idx = text.toLowerCase().indexOf(searchTerm.toLowerCase())
    if (idx === -1) {
      return <span style={{ color: defaultColor }}>{text}</span>
    }
    const before = text.substring(0, idx)
    const match = text.substring(idx, idx + searchTerm.length)
    const after = text.substring(idx + searchTerm.length)
    return (
      <span style={{ color: defaultColor }}>
        {before}
        <mark
          style={{ backgroundColor: '#fbbf24', color: '#000', padding: '0 2px', borderRadius: 2 }}
        >
          {match}
        </mark>
        {after}
      </span>
    )
  }

  // Value rendering based on type
  const renderPrimitiveValue = () => {
    if (value === null) {
      return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>null</span>
    }
    if (typeof value === 'boolean') {
      return <span style={{ color: '#3b82f6', fontWeight: 600 }}>{String(value)}</span>
    }
    if (typeof value === 'number') {
      return (
        <span style={{ color: '#f59e0b', fontWeight: 600 }}>
          {renderHighlighted(String(value), '#f59e0b')}
        </span>
      )
    }
    if (typeof value === 'string') {
      return (
        <span style={{ color: isDark ? '#34d399' : '#059669' }}>
          "{renderHighlighted(value, isDark ? '#34d399' : '#059669')}"
        </span>
      )
    }
    return <span>{String(value)}</span>
  }

  const entries = isObject ? Object.entries(value) : []

  return (
    <div
      style={{
        paddingLeft: depth > 0 ? 18 : 0,
        fontFamily: '"Fira Code", "JetBrains Mono", monospace',
        fontSize: 12.5,
        lineHeight: '22px'
      }}
    >
      <div
        className="json-tree-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: isObject ? 'pointer' : 'default',
          padding: '2px 4px',
          borderRadius: 4
        }}
        onClick={isObject ? handleToggle : undefined}
      >
        {isObject ? (
          <span
            style={{
              marginRight: 6,
              fontSize: 10,
              width: 14,
              display: 'inline-flex',
              alignItems: 'center',
              color: isDark ? '#9ca3af' : '#6b7280'
            }}
          >
            {isExpanded ? <DownOutlined /> : <RightOutlined />}
          </span>
        ) : (
          <span style={{ width: 20 }} />
        )}

        {nodeKey !== null && (
          <span style={{ marginRight: 6, fontWeight: 500, color: isDark ? '#93c5fd' : '#1d4ed8' }}>
            {renderHighlighted(nodeKey, isDark ? '#93c5fd' : '#1d4ed8')}:
          </span>
        )}

        {isObject ? (
          <Space size={6}>
            <span style={{ color: isDark ? '#d1d5db' : '#374151', fontWeight: 600 }}>
              {isArray ? `Array[${(value as any[]).length}]` : `{ Object }`}
            </span>
            <Tag
              bordered={false}
              style={{
                fontSize: 10,
                padding: '0 5px',
                lineHeight: '16px',
                height: 18,
                backgroundColor: isDark ? '#374151' : '#f3f4f6',
                color: isDark ? '#9ca3af' : '#6b7280'
              }}
            >
              {isArray ? `${(value as any[]).length} items` : `${entries.length} keys`}
            </Tag>
          </Space>
        ) : (
          renderPrimitiveValue()
        )}

        {/* Copy Node Value Icon on hover */}
        <Tooltip title="Copy value">
          <Button
            type="text"
            size="small"
            icon={copied ? <CheckOutlined style={{ color: '#10b981' }} /> : <CopyOutlined />}
            onClick={handleCopyNodeValue}
            style={{
              marginLeft: 8,
              opacity: 0.6,
              height: 20,
              width: 20,
              padding: 0
            }}
          />
        </Tooltip>
      </div>

      {isObject && isExpanded && (
        <div style={{ borderLeft: `1px dashed ${isDark ? '#374151' : '#e5e7eb'}`, marginLeft: 7 }}>
          {entries.map(([key, val], idx) => (
            <JsonTreeNode
              key={key || idx}
              nodeKey={isArray ? `[${key}]` : key}
              value={val}
              depth={depth + 1}
              searchTerm={searchTerm}
              expandedKeys={expandedKeys}
              onToggleExpand={onToggleExpand}
              currentPath={`${currentPath}.${key}`}
              isDark={isDark}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Interactive Tree Node for XML data.
 */
interface XmlTreeNodeProps {
  element: Element
  depth: number
  searchTerm: string
  expandedKeys: Set<string>
  onToggleExpand: (path: string) => void
  currentPath: string
  isDark: boolean
}

const XmlTreeNode: React.FC<XmlTreeNodeProps> = ({
  element,
  depth,
  searchTerm,
  expandedKeys,
  onToggleExpand,
  currentPath,
  isDark
}) => {
  const isExpanded = expandedKeys.has(currentPath)
  const childElements = Array.from(element.children)
  const hasChildren = childElements.length > 0
  const textContent = hasChildren ? '' : element.textContent?.trim() || ''
  const attributes = Array.from(element.attributes)

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand(currentPath)
  }

  const renderHighlighted = (text: string, defaultColor?: string) => {
    if (!searchTerm || !text) {
      return <span style={{ color: defaultColor }}>{text}</span>
    }
    const idx = text.toLowerCase().indexOf(searchTerm.toLowerCase())
    if (idx === -1) {
      return <span style={{ color: defaultColor }}>{text}</span>
    }
    return (
      <span style={{ color: defaultColor }}>
        {text.substring(0, idx)}
        <mark
          style={{ backgroundColor: '#fbbf24', color: '#000', padding: '0 2px', borderRadius: 2 }}
        >
          {text.substring(idx, idx + searchTerm.length)}
        </mark>
        {text.substring(idx + searchTerm.length)}
      </span>
    )
  }

  return (
    <div
      style={{
        paddingLeft: depth > 0 ? 18 : 0,
        fontFamily: '"Fira Code", "JetBrains Mono", monospace',
        fontSize: 12.5,
        lineHeight: '22px'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: hasChildren ? 'pointer' : 'default',
          padding: '2px 4px',
          borderRadius: 4
        }}
        onClick={hasChildren ? handleToggle : undefined}
      >
        {hasChildren ? (
          <span
            style={{
              marginRight: 6,
              fontSize: 10,
              width: 14,
              display: 'inline-flex',
              alignItems: 'center',
              color: isDark ? '#9ca3af' : '#6b7280'
            }}
          >
            {isExpanded ? <DownOutlined /> : <RightOutlined />}
          </span>
        ) : (
          <span style={{ width: 20 }} />
        )}

        <span style={{ color: isDark ? '#a78bfa' : '#7c3aed', fontWeight: 600 }}>
          &lt;{renderHighlighted(element.tagName, isDark ? '#a78bfa' : '#7c3aed')}
        </span>

        {attributes.map((attr) => (
          <span key={attr.name} style={{ marginLeft: 6, fontSize: 11.5 }}>
            <span style={{ color: isDark ? '#f472b6' : '#db2777' }}>{attr.name}</span>=
            <span style={{ color: isDark ? '#34d399' : '#059669' }}>
              "{renderHighlighted(attr.value)}"
            </span>
          </span>
        ))}

        <span style={{ color: isDark ? '#a78bfa' : '#7c3aed', fontWeight: 600 }}>&gt;</span>

        {!hasChildren && textContent && (
          <span style={{ marginLeft: 8, color: isDark ? '#e5e7eb' : '#1f2937' }}>
            {renderHighlighted(textContent)}
            <span style={{ color: isDark ? '#a78bfa' : '#7c3aed', fontWeight: 600, marginLeft: 6 }}>
              &lt;/{element.tagName}&gt;
            </span>
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div style={{ borderLeft: `1px dashed ${isDark ? '#374151' : '#e5e7eb'}`, marginLeft: 7 }}>
          {childElements.map((child, idx) => (
            <XmlTreeNode
              key={idx}
              element={child}
              depth={depth + 1}
              searchTerm={searchTerm}
              expandedKeys={expandedKeys}
              onToggleExpand={onToggleExpand}
              currentPath={`${currentPath}.${child.tagName}_${idx}`}
              isDark={isDark}
            />
          ))}
          <div style={{ paddingLeft: 18, color: isDark ? '#a78bfa' : '#7c3aed', fontWeight: 600 }}>
            &lt;/{element.tagName}&gt;
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Main Payload Inspector Side Drawer.
 */
export const PayloadInspectorDrawer: React.FC<PayloadInspectorDrawerProps> = ({
  open,
  payload,
  originalLineNumber,
  isDark = true,
  onClose
}) => {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<'tree' | 'code'>('tree')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set(['root']))

  // Pre-expand top-level keys whenever payload opens
  React.useEffect(() => {
    if (open && payload) {
      const keys = new Set<string>(['root'])
      if (payload.type === 'json' && payload.parsedData && typeof payload.parsedData === 'object') {
        Object.keys(payload.parsedData).forEach((k) => keys.add(`root.${k}`))
      } else if (payload.type === 'xml') {
        try {
          const doc = new DOMParser().parseFromString(payload.rawPayload, 'application/xml')
          if (doc.documentElement) {
            keys.add('root')
            Array.from(doc.documentElement.children).forEach((child, idx) => {
              keys.add(`root.${child.tagName}_${idx}`)
            })
          }
        } catch {}
      }
      setExpandedKeys(keys)
      setSearchTerm('')
    }
  }, [open, payload])

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleExpandAll = () => {
    if (!payload) return
    const allKeys = new Set<string>(['root'])
    if (payload.type === 'json' && payload.parsedData) {
      const collectKeys = (obj: any, path: string) => {
        if (obj !== null && typeof obj === 'object') {
          allKeys.add(path)
          Object.entries(obj).forEach(([k, v]) => collectKeys(v, `${path}.${k}`))
        }
      }
      collectKeys(payload.parsedData, 'root')
    } else if (payload.type === 'xml') {
      try {
        const doc = new DOMParser().parseFromString(payload.rawPayload, 'application/xml')
        const collectXml = (elem: Element, path: string) => {
          allKeys.add(path)
          Array.from(elem.children).forEach((c, idx) =>
            collectXml(c, `${path}.${c.tagName}_${idx}`)
          )
        }
        if (doc.documentElement) collectXml(doc.documentElement, 'root')
      } catch {}
    }
    setExpandedKeys(allKeys)
  }

  const handleCollapseAll = () => {
    setExpandedKeys(new Set(['root']))
  }

  const handleCopyFormatted = () => {
    if (!payload) return
    navigator.clipboard.writeText(payload.formatted)
    message.success(
      t('payload.copiedFormatted', { defaultValue: 'Formatted payload copied to clipboard' })
    )
  }

  const handleCopyRaw = () => {
    if (!payload) return
    navigator.clipboard.writeText(payload.rawPayload)
    message.success(t('payload.copiedRaw', { defaultValue: 'Raw payload copied to clipboard' }))
  }

  // XML root element memo
  const xmlRootElement = useMemo(() => {
    if (!payload || payload.type !== 'xml') return null
    try {
      const doc = new DOMParser().parseFromString(payload.rawPayload, 'application/xml')
      return doc.documentElement
    } catch {
      return null
    }
  }, [payload])

  // Count matches in search
  const matchCount = useMemo(() => {
    if (!payload || !searchTerm.trim()) return 0
    const lowerSearch = searchTerm.toLowerCase()
    const content = payload.formatted.toLowerCase()
    let count = 0
    let pos = content.indexOf(lowerSearch)
    while (pos !== -1) {
      count++
      pos = content.indexOf(lowerSearch, pos + lowerSearch.length)
    }
    return count
  }, [payload, searchTerm])

  if (!payload) return null

  return (
    <Drawer
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: 8
          }}
        >
          <Space size={8}>
            <Tag color={payload.type === 'json' ? 'blue' : 'orange'} style={{ fontWeight: 600 }}>
              {payload.type.toUpperCase()}
            </Tag>
            <Text strong style={{ fontSize: 15 }}>
              {payload.summary}
            </Text>
            {originalLineNumber !== undefined && (
              <Tag bordered={false} style={{ fontSize: 11 }}>
                Line #{originalLineNumber + 1}
              </Tag>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              ({Math.round((payload.charCount / 1024) * 10) / 10} KB)
            </Text>
          </Space>
        </div>
      }
      placement="right"
      width={680}
      onClose={onClose}
      open={open}
      styles={{
        header: {
          backgroundColor: isDark ? '#141414' : '#fafafa',
          borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          padding: '12px 16px'
        },
        body: {
          backgroundColor: isDark ? '#0d1117' : '#ffffff',
          color: isDark ? '#c9d1d9' : '#24292f',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`
        }}
      >
        <Space size={8}>
          <Radio.Group
            size="small"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button value="tree">
              <AppstoreOutlined style={{ marginRight: 4 }} />
              {t('payload.treeView', { defaultValue: 'Tree View' })}
            </Radio.Button>
            <Radio.Button value="code">
              <CodeOutlined style={{ marginRight: 4 }} />
              {t('payload.codeView', { defaultValue: 'Code View' })}
            </Radio.Button>
          </Radio.Group>

          {viewMode === 'tree' && (
            <>
              <Tooltip title={t('payload.expandAll', { defaultValue: 'Expand All Nodes' })}>
                <Button
                  size="small"
                  icon={<VerticalAlignBottomOutlined />}
                  onClick={handleExpandAll}
                />
              </Tooltip>
              <Tooltip title={t('payload.collapseAll', { defaultValue: 'Collapse All Nodes' })}>
                <Button
                  size="small"
                  icon={<VerticalAlignTopOutlined />}
                  onClick={handleCollapseAll}
                />
              </Tooltip>
            </>
          )}
        </Space>

        <Space size={8}>
          <Tooltip title={t('payload.copyRaw', { defaultValue: 'Copy Raw Minified Payload' })}>
            <Button size="small" onClick={handleCopyRaw}>
              {t('payload.raw', { defaultValue: 'Raw' })}
            </Button>
          </Tooltip>
          <Tooltip title={t('payload.copyFormatted', { defaultValue: 'Copy Formatted Code' })}>
            <Button
              size="small"
              type="primary"
              icon={<CopyOutlined />}
              onClick={handleCopyFormatted}
            >
              {t('payload.copy', { defaultValue: 'Copy' })}
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 12 }}>
        <Input
          size="small"
          prefix={<SearchOutlined style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />}
          placeholder={t('payload.searchPlaceholder', {
            defaultValue: 'Search keys, tags, or values...'
          })}
          allowClear
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          suffix={
            searchTerm.trim() ? (
              <Tag
                bordered={false}
                color={matchCount > 0 ? 'blue' : 'default'}
                style={{ fontSize: 11, padding: '0 4px', margin: 0 }}
              >
                {matchCount} {t('payload.matches', { defaultValue: 'matches' })}
              </Tag>
            ) : null
          }
        />
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {viewMode === 'tree' ? (
          <div>
            {payload.type === 'json' ? (
              <JsonTreeNode
                nodeKey={null}
                value={payload.parsedData}
                depth={0}
                searchTerm={searchTerm}
                expandedKeys={expandedKeys}
                onToggleExpand={handleToggleExpand}
                currentPath="root"
                isDark={isDark}
              />
            ) : xmlRootElement ? (
              <XmlTreeNode
                element={xmlRootElement}
                depth={0}
                searchTerm={searchTerm}
                expandedKeys={expandedKeys}
                onToggleExpand={handleToggleExpand}
                currentPath="root"
                isDark={isDark}
              />
            ) : (
              <pre style={{ margin: 0, fontFamily: 'monospace' }}>{payload.formatted}</pre>
            )}
          </div>
        ) : (
          <div
            style={{
              fontFamily: '"Fira Code", "JetBrains Mono", monospace',
              fontSize: 12,
              lineHeight: '20px',
              backgroundColor: isDark ? '#161b22' : '#f6f8fa',
              padding: 12,
              borderRadius: 6,
              border: `1px solid ${isDark ? '#30363d' : '#d0d7de'}`,
              overflowX: 'auto'
            }}
          >
            {payload.formatted.split('\n').map((line, idx) => {
              const hasMatch = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase())
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    backgroundColor: hasMatch
                      ? isDark
                        ? 'rgba(234, 179, 8, 0.15)'
                        : 'rgba(254, 240, 138, 0.5)'
                      : 'transparent',
                    padding: '0 4px',
                    borderRadius: 2
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      userSelect: 'none',
                      color: isDark ? '#484f58' : '#8c959f',
                      textAlign: 'right',
                      paddingRight: 12
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ flex: 1, whiteSpace: 'pre' }}>
                    {searchTerm && hasMatch
                      ? line
                          .split(
                            new RegExp(
                              `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
                              'gi'
                            )
                          )
                          .map((chunk, cIdx) =>
                            chunk.toLowerCase() === searchTerm.toLowerCase() ? (
                              <mark
                                key={cIdx}
                                style={{
                                  backgroundColor: '#fbbf24',
                                  color: '#000',
                                  padding: '0 2px',
                                  borderRadius: 2
                                }}
                              >
                                {chunk}
                              </mark>
                            ) : (
                              <span key={cIdx}>{chunk}</span>
                            )
                          )
                      : line}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Drawer>
  )
}
