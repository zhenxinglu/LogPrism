import React, { useState, useEffect, useRef } from 'react'
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
  Checkbox
} from 'antd'
import {
  FileOutlined,
  ReloadOutlined,
  DownOutlined,
  UpOutlined,
  RightOutlined
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'

const { Text } = Typography
const { Content, Footer } = Layout

interface LogViewerProps {}

const defaultStart = dayjs('00:00:00', 'HH:mm:ss')
const defaultEnd = dayjs('23:59:59.999', 'HH:mm:ss.SSS')

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
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('themeMode') as 'dark' | 'light') || 'dark'
  })
  const [isInitialized, setIsInitialized] = useState(false)
  const [fontSize, setFontSize] = useState<number>(13)
  const [wordWrap, setWordWrap] = useState<boolean>(true)
  const logContainerRef = useRef<HTMLDivElement>(null)

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
        wordWrap
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
    wordWrap
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
    }
  }

  useEffect(() => {
    const autoLoadLastFile = async () => {
      const res = await window.api.getLastFile()
      if (res) {
        setLogContent(res.content)
      }
    }
    autoLoadLastFile()
  }, [])

  useEffect(() => {
    const unsubscribe = window.api.onLogFileChanged((newContent) => {
      setLogContent(newContent)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const handleOpenLogFile = async () => {
    const content = await window.api.openLogFile()
    if (content !== null) {
      setLogContent(content)
      setFilteredContent('')
      setMatchCount(0)
    }
  }

  useEffect(() => {
    if (!logContent) {
      setFilteredContent('')
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
    const inRange = (line: string) => {
      // 匹配行首时间戳
      const m = line.match(/^(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)/)
      if (!m) return true // 没有时间戳则不过滤
      const t = m[1].length === 8 ? m[1] + '.000' : m[1].padEnd(12, '0')
      return t >= start && t <= end
    }
    const filtered = lines.filter((line) => {
      const lowerLine = line.toLowerCase()
      // 包含关键词
      if (targetIncludeArr.length) {
        const targetLineInclude = isIncludeCaseSensitive ? line : lowerLine
        if (!targetIncludeArr.some((k) => targetLineInclude.includes(k))) return false
      }
      // 排除关键词
      if (targetExcludeArr.length) {
        const targetLineExclude = isExcludeCaseSensitive ? line : lowerLine
        if (targetExcludeArr.some((k) => targetLineExclude.includes(k))) return false
      }
      // 时间区间
      if (!inRange(line)) return false
      return true
    })
    setFilteredContent(filtered.join('\n'))
    setMatchCount(filtered.length)
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
      <Layout style={styles.layout}>
        <Content
          style={{
            padding: '2px 8px 8px 8px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
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
          <div ref={logContainerRef} style={styles.logContainer}>
            <pre
              style={{
                margin: 0,
                whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                wordBreak: wordWrap ? 'break-all' : 'normal'
              }}
            >
              {logContent ? filteredContent : '请先打开日志文件...'}
            </pre>
          </div>
        </Content>
        <Footer style={styles.footer}>
          <Text style={styles.footerText}>Found {matchCount} matches</Text>
          <Space size="middle" style={{ display: 'flex', alignItems: 'center' }}>
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
      </Layout>
    </ConfigProvider>
  )
}

export default LogViewer
