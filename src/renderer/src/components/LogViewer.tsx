import React, { useState, useEffect } from 'react'
import { ConfigProvider, theme, message, Modal, Progress, Button, Spin } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

import { TabBar, SplitMode } from './TabBar'
import { LogSingleViewer, LogTabSession } from './LogSingleViewer'
import { RemoteLogModal, SshConfig } from './RemoteLogModal'
import { getSavedLanguage, setSavedLanguage } from '../i18n'

const defaultStart = dayjs('00:00:00', 'HH:mm:ss')
const defaultEnd = dayjs('23:59:59.999', 'HH:mm:ss.SSS')

const createInitialTabSession = (id: string, title: string, filePath?: string): LogTabSession => ({
  id,
  title,
  type: 'local',
  filePath,
  content: '',
  totalLines: 0,
  fileSize: 0,
  updateTime: null,
  lastUpdateTimestamp: null,
  includeKeywords: '',
  excludeKeywords: '',
  isIncludeCaseSensitive: false,
  isExcludeCaseSensitive: false,
  startTime: defaultStart,
  endTime: defaultEnd,
  selectedLogLevels: { ERROR: true, WARN: true, INFO: true, DEBUG: true, OTHER: true },
  selectedFormatId: 'auto',
  detectedFormat: null,
  markedLines: {},
  bookmarkedLines: {},
  highlightWord: '',
  tailMode: true,
  wordWrap: true,
  fontSize: 13,
  showLineNumbers: true,
  showTimeline: true
})

export default function LogViewer(): React.JSX.Element {
  const { t } = useTranslation()
  const [currentLang, setCurrentLang] = useState<'en' | 'zh'>(() => getSavedLanguage())
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('themeMode') as 'dark' | 'light') || 'dark'
  })

  const [tabs, setTabs] = useState<LogTabSession[]>([
    createInitialTabSession('tab-1', 'Untitled Log')
  ])
  const [activeTabId, setActiveTabId] = useState<string>('tab-1')

  // Split View States
  const [splitMode, setSplitMode] = useState<SplitMode>('none')
  const [activeTabIdPaneA, setActiveTabIdPaneA] = useState<string | null>('tab-1')
  const [activeTabIdPaneB, setActiveTabIdPaneB] = useState<string | null>(null)
  const [activePane, setActivePane] = useState<'paneA' | 'paneB'>('paneA')
  const [scrollSync, setScrollSync] = useState<boolean>(false)
  const [scrollTopPercentageA, setScrollTopPercentageA] = useState<number | null>(null)
  const [scrollTopPercentageB, setScrollTopPercentageB] = useState<number | null>(null)

  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [appVersion, setAppVersion] = useState<string>('')
  const [isInitialized, setIsInitialized] = useState<boolean>(false)

  // SSH Modal & Updater States
  const [remoteModalOpen, setRemoteModalOpen] = useState<boolean>(false)
  const [updateModalVisible, setUpdateModalVisible] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  >('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string } | null>(
    null
  )
  const [downloadPercent, setDownloadPercent] = useState<number>(0)
  const [updateErrorMsg, setUpdateErrorMsg] = useState<string>('')

  const isDarkMode = themeMode === 'dark'
  const antdLocale = currentLang === 'zh' ? zhCN : enUS

  const handleLanguageChange = (lang: 'en' | 'zh') => {
    setSavedLanguage(lang)
    setCurrentLang(lang)
    window.api.saveSettings({ language: lang })
  }

  const handleCheckForUpdates = async () => {
    setUpdateModalVisible(true)
    setUpdateStatus('checking')
    setUpdateErrorMsg('')

    const timeoutId = setTimeout(() => {
      setUpdateStatus((prev) => {
        if (prev === 'checking') {
          setUpdateErrorMsg(
            t('updater.timeoutMsg', {
              defaultValue: 'Update check timed out. Please check your network connection.'
            })
          )
          return 'error'
        }
        return prev
      })
    }, 15000)

    try {
      const res = await window.api.checkForUpdates()
      clearTimeout(timeoutId)
      if (res && res.error) {
        setUpdateStatus('error')
        setUpdateErrorMsg(res.message || t('updater.errorTitle'))
      } else if (res && res.isDev) {
        setUpdateStatus('not-available')
      }
    } catch (err: any) {
      clearTimeout(timeoutId)
      setUpdateStatus('error')
      setUpdateErrorMsg(err?.message || t('updater.errorTitle'))
    }
  }

  // Hook up updater events
  useEffect(() => {
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
      setUpdateErrorMsg(errorText || t('updater.errorTitle'))
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
  }, [t])

  // Load app startup data & last opened file
  useEffect(() => {
    const initialize = async () => {
      try {
        const ver = await window.api.getAppVersion()
        setAppVersion(ver)
      } catch {}

      try {
        const settings = await window.api.getSettings()
        if (settings) {
          if (settings.themeMode) setThemeMode(settings.themeMode)
          if (settings.splitMode) setSplitMode(settings.splitMode)
          if (settings.scrollSync !== undefined) setScrollSync(settings.scrollSync)
          if (settings.language === 'en' || settings.language === 'zh') {
            setCurrentLang(settings.language)
            setSavedLanguage(settings.language)
          }
        }

        const lastFileRes = await window.api.getLastFile()
        if (lastFileRes) {
          if (lastFileRes.recentFiles) setRecentFiles(lastFileRes.recentFiles)

          if (lastFileRes.filePath) {
            const fileName = lastFileRes.filePath.split(/[/\\]/).pop() || lastFileRes.filePath
            let fileContent = lastFileRes.content
            if (fileContent === null && lastFileRes.totalLines) {
              const lineRes = await window.api.readLogLines(
                lastFileRes.filePath,
                0,
                lastFileRes.totalLines || 500000
              )
              fileContent = (lineRes && lineRes.lines) ? lineRes.lines.join('\n') : ''
            }

            const initialTab: LogTabSession = {
              ...createInitialTabSession('tab-1', fileName, lastFileRes.filePath),
              content: fileContent || '',
              totalLines: lastFileRes.totalLines || 0,
              fileSize: lastFileRes.fileSize || 0
            }
            setTabs([initialTab])
            setActiveTabId('tab-1')
            setActiveTabIdPaneA('tab-1')
          }
        }
      } catch (err) {
        console.error('Initialization error:', err)
      } finally {
        setIsInitialized(true)
      }
    }
    initialize()
  }, [])

  // Auto-save settings on change
  useEffect(() => {
    if (!isInitialized) return
    const timer = setTimeout(() => {
      window.api.saveSettings({
        themeMode,
        splitMode,
        scrollSync,
        language: currentLang
      })
      localStorage.setItem('themeMode', themeMode)
    }, 500)
    return () => clearTimeout(timer)
  }, [isInitialized, themeMode, splitMode, scrollSync, currentLang])

  // Listen to file watcher updates across all tabs
  useEffect(() => {
    const unsubscribe = window.api.onLogFileChanged(async (data: any) => {
      if (typeof data === 'object' && data.filePath) {
        const filePath = data.filePath
        const now = dayjs()

        let fileContent = data.content
        if (fileContent === null && data.totalLines) {
          const lineRes = await window.api.readLogLines(filePath, 0, data.totalLines)
          if (lineRes && lineRes.lines) {
            fileContent = lineRes.lines.join('\n')
          }
        }

        setTabs((prevTabs) =>
          prevTabs.map((t) => {
            const tPath = (t.filePath || '').replace(/\\/g, '/').toLowerCase()
            const dPath = (filePath || '').replace(/\\/g, '/').toLowerCase()
            if (tPath === dPath || t.filePath === filePath) {
              return {
                ...t,
                content: fileContent !== null ? fileContent : t.content,
                totalLines: data.totalLines || t.totalLines,
                fileSize: data.fileSize || t.fileSize,
                updateTime: now.format('HH:mm:ss'),
                lastUpdateTimestamp: now.valueOf()
              }
            }
            return t
          })
        )
      }
    })
    return () => unsubscribe()
  }, [])

  // Listen to remote SSH data across all tabs
  useEffect(() => {
    const unsubData = window.api.onRemoteLogData(({ data }) => {
      const now = dayjs()
      setTabs((prevTabs) =>
        prevTabs.map((t) => {
          if (t.type === 'remote') {
            return {
              ...t,
              content: t.content ? t.content + data : data,
              updateTime: now.format('HH:mm:ss'),
              lastUpdateTimestamp: now.valueOf()
            }
          }
          return t
        })
      )
    })
    return () => unsubData()
  }, [])

  // Update a single tab session
  const updateTabSession = (tabId: string, updated: Partial<LogTabSession>) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, ...updated } : t)))
  }

  // Open local file in new tab
  const handleOpenLocalFile = async () => {
    const res = await window.api.openLogFile()
    if (res && res.filePath) {
      const fileName = res.filePath.split(/[/\\]/).pop() || res.filePath
      let fileContent = res.content
      if (fileContent === null && res.totalLines) {
        const lineRes = await window.api.readLogLines(res.filePath, 0, res.totalLines || 500000)
        fileContent = lineRes.lines.join('\n')
      }

      if (res.recentFiles) setRecentFiles(res.recentFiles)

      const newTabId = `tab-${Date.now()}`
      const newTab: LogTabSession = {
        ...createInitialTabSession(newTabId, fileName, res.filePath),
        content: fileContent || '',
        totalLines: res.totalLines || 0,
        fileSize: res.fileSize || 0
      }

      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTabId)

      if (activePane === 'paneA' || !activeTabIdPaneA) {
        setActiveTabIdPaneA(newTabId)
      } else {
        setActiveTabIdPaneB(newTabId)
      }
    }
  }

  // Select recent file in new or active tab
  const handleSelectRecentFile = async (filePath: string) => {
    const res = await window.api.openFileByPath(filePath)
    if (res.success && res.filePath) {
      const fileName = res.filePath.split(/[/\\]/).pop() || res.filePath
      let fileContent = res.content
      if ((fileContent === null || fileContent === undefined) && res.totalLines) {
        const lineRes = await window.api.readLogLines(res.filePath, 0, res.totalLines || 500000)
        fileContent = lineRes.lines.join('\n')
      }
      if (res.recentFiles) setRecentFiles(res.recentFiles)

      const currentTab = tabs.find((t) => t.id === activeTabId)
      if (currentTab && !currentTab.filePath && !currentTab.content) {
        updateTabSession(currentTab.id, {
          title: fileName,
          filePath: res.filePath,
          content: fileContent || '',
          totalLines: res.totalLines || 0,
          fileSize: res.fileSize || 0
        })
      } else {
        const newTabId = `tab-${Date.now()}`
        const newTab: LogTabSession = {
          ...createInitialTabSession(newTabId, fileName, res.filePath),
          content: fileContent || '',
          totalLines: res.totalLines || 0,
          fileSize: res.fileSize || 0
        }
        setTabs((prev) => [...prev, newTab])
        setActiveTabId(newTabId)
        if (activePane === 'paneA') setActiveTabIdPaneA(newTabId)
        else setActiveTabIdPaneB(newTabId)
      }
    } else {
      message.error(res.error || 'Failed to open file.')
    }
  }

  // Connect SSH remote log in new tab
  const handleConnectRemoteSsh = async (config: SshConfig) => {
    const newTabId = `tab-${Date.now()}`
    const title = `ssh://${config.host}:${config.port || 22}${config.remotePath}`

    const newTab: LogTabSession = {
      ...createInitialTabSession(newTabId, title),
      type: 'remote',
      remoteConfig: config
    }

    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTabId)
    if (activePane === 'paneA') setActiveTabIdPaneA(newTabId)
    else setActiveTabIdPaneB(newTabId)

    await window.api.connectRemoteLog(config)
  }

  // Tab closing handlers
  const handleCloseTab = (tabId: string) => {
    const targetTab = tabs.find((t) => t.id === tabId)
    if (targetTab?.filePath) {
      const otherSameFileTabs = tabs.filter(
        (t) => t.id !== tabId && t.filePath === targetTab.filePath
      )
      if (otherSameFileTabs.length === 0) {
        window.api.unwatchLogFile(targetTab.filePath)
      }
    }

    const newTabs = tabs.filter((t) => t.id !== tabId)
    if (newTabs.length === 0) {
      const fallbackTab = createInitialTabSession('tab-1', t('tabs.untitled'))
      setTabs([fallbackTab])
      setActiveTabId('tab-1')
      setActiveTabIdPaneA('tab-1')
      setActiveTabIdPaneB(null)
      return
    }

    setTabs(newTabs)
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[newTabs.length - 1].id)
    }
    if (activeTabIdPaneA === tabId) {
      setActiveTabIdPaneA(newTabs[0].id)
    }
    if (activeTabIdPaneB === tabId) {
      setActiveTabIdPaneB(newTabs.length > 1 ? newTabs[1].id : newTabs[0].id)
    }
  }

  const handleCloseOtherTabs = (tabId: string) => {
    tabs.forEach((t) => {
      if (t.id !== tabId && t.filePath) {
        window.api.unwatchLogFile(t.filePath)
      }
    })
    const remaining = tabs.filter((t) => t.id === tabId)
    setTabs(remaining)
    setActiveTabId(tabId)
    setActiveTabIdPaneA(tabId)
    setActiveTabIdPaneB(null)
  }

  const handleCloseAllTabs = () => {
    tabs.forEach((t) => {
      if (t.filePath) window.api.unwatchLogFile(t.filePath)
    })
    const fallbackTab = createInitialTabSession('tab-1', t('tabs.untitled'))
    setTabs([fallbackTab])
    setActiveTabId('tab-1')
    setActiveTabIdPaneA('tab-1')
    setActiveTabIdPaneB(null)
  }

  // Active sessions for Pane A and Pane B
  const sessionPaneA = tabs.find((t) => t.id === (activeTabIdPaneA || activeTabId)) || tabs[0]
  const sessionPaneB =
    tabs.find((t) => t.id === activeTabIdPaneB) ||
    tabs.find((t) => t.id !== sessionPaneA.id) ||
    sessionPaneA

  const activeSession = activePane === 'paneA' ? sessionPaneA : sessionPaneB

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          backgroundColor: isDarkMode ? '#0f0f11' : '#f5f5f7'
        }}
      >
        {/* Top Tab Bar */}
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          activeTabIdPaneA={activeTabIdPaneA}
          activeTabIdPaneB={activeTabIdPaneB}
          splitMode={splitMode}
          activePane={activePane}
          scrollSync={scrollSync}
          isDarkMode={isDarkMode}
          onSelectTab={(tabId) => {
            setActiveTabId(tabId)
            if (activePane === 'paneA') setActiveTabIdPaneA(tabId)
            else setActiveTabIdPaneB(tabId)
          }}
          onCloseTab={handleCloseTab}
          onCloseOtherTabs={handleCloseOtherTabs}
          onCloseAllTabs={handleCloseAllTabs}
          onOpenLocalFile={handleOpenLocalFile}
          onOpenRemoteSsh={() => setRemoteModalOpen(true)}
          onChangeSplitMode={(mode) => {
            setSplitMode(mode)
            if (mode !== 'none' && !activeTabIdPaneB && tabs.length > 1) {
              setActiveTabIdPaneB(tabs[1].id)
            }
          }}
          onToggleScrollSync={() => setScrollSync(!scrollSync)}
        />

        {/* Log View Area (Single View or Split View Grid) */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
          {splitMode === 'none' ? (
            <div style={{ width: '100%', height: '100%' }}>
              <LogSingleViewer
                session={activeSession}
                isDarkMode={isDarkMode}
                currentLang={currentLang}
                onChangeLang={handleLanguageChange}
                onUpdateSession={(updated) => updateTabSession(activeSession.id, updated)}
                onOpenLogFile={handleOpenLocalFile}
                onOpenRemoteSsh={() => setRemoteModalOpen(true)}
                onSelectRecentFile={handleSelectRecentFile}
                recentFiles={recentFiles}
                onClearRecentFiles={async () => {
                  await window.api.clearRecentFiles()
                  setRecentFiles([])
                }}
                appVersion={appVersion}
                onCheckForUpdates={handleCheckForUpdates}
                onToggleTheme={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
              />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: splitMode === 'horizontal' ? 'row' : 'column',
                width: '100%',
                height: '100%',
                gap: 4
              }}
            >
              {/* Pane A */}
              <div
                onClick={() => setActivePane('paneA')}
                style={{
                  flex: 1,
                  height: '100%',
                  outline: activePane === 'paneA' ? '2px solid #1677ff' : 'none',
                  borderRadius: 4,
                  overflow: 'hidden'
                }}
              >
                <LogSingleViewer
                  session={sessionPaneA}
                  isDarkMode={isDarkMode}
                  currentLang={currentLang}
                  onChangeLang={handleLanguageChange}
                  paneLabel="Pane A"
                  allTabs={tabs}
                  onSelectTabForPane={(tabId) => setActiveTabIdPaneA(tabId)}
                  onUpdateSession={(updated) => updateTabSession(sessionPaneA.id, updated)}
                  onOpenLogFile={handleOpenLocalFile}
                  onOpenRemoteSsh={() => setRemoteModalOpen(true)}
                  onSelectRecentFile={handleSelectRecentFile}
                  recentFiles={recentFiles}
                  onClearRecentFiles={async () => {
                    await window.api.clearRecentFiles()
                    setRecentFiles([])
                  }}
                  appVersion={appVersion}
                  onCheckForUpdates={handleCheckForUpdates}
                  onToggleTheme={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
                  onScrollSync={(percentage) => {
                    if (scrollSync) setScrollTopPercentageB(percentage)
                  }}
                  scrollTopPercentage={scrollSync ? scrollTopPercentageA : null}
                />
              </div>

              {/* Pane B */}
              <div
                onClick={() => setActivePane('paneB')}
                style={{
                  flex: 1,
                  height: '100%',
                  outline: activePane === 'paneB' ? '2px solid #722ed1' : 'none',
                  borderRadius: 4,
                  overflow: 'hidden'
                }}
              >
                <LogSingleViewer
                  session={sessionPaneB}
                  isDarkMode={isDarkMode}
                  currentLang={currentLang}
                  onChangeLang={handleLanguageChange}
                  paneLabel="Pane B"
                  allTabs={tabs}
                  onSelectTabForPane={(tabId) => setActiveTabIdPaneB(tabId)}
                  onUpdateSession={(updated) => updateTabSession(sessionPaneB.id, updated)}
                  onOpenLogFile={handleOpenLocalFile}
                  onOpenRemoteSsh={() => setRemoteModalOpen(true)}
                  onSelectRecentFile={handleSelectRecentFile}
                  recentFiles={recentFiles}
                  onClearRecentFiles={async () => {
                    await window.api.clearRecentFiles()
                    setRecentFiles([])
                  }}
                  appVersion={appVersion}
                  onCheckForUpdates={handleCheckForUpdates}
                  onToggleTheme={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
                  onScrollSync={(percentage) => {
                    if (scrollSync) setScrollTopPercentageA(percentage)
                  }}
                  scrollTopPercentage={scrollSync ? scrollTopPercentageB : null}
                />
              </div>
            </div>
          )}
        </div>

        {/* Remote SSH Setup Modal */}
        <RemoteLogModal
          open={remoteModalOpen}
          onClose={() => setRemoteModalOpen(false)}
          onConnect={handleConnectRemoteSsh}
        />

        {/* Software Updater Modal */}
        <Modal
          title={t('updater.title')}
          open={updateModalVisible}
          onCancel={() => setUpdateModalVisible(false)}
          footer={[
            updateStatus === 'downloaded' ? (
              <Button
                key="install"
                type="primary"
                onClick={() => window.api.quitAndInstall()}
              >
                {t('updater.restartAndInstall')}
              </Button>
            ) : updateStatus === 'available' ? (
              <Button
                key="download"
                type="primary"
                onClick={() => window.api.downloadUpdate()}
              >
                {t('updater.downloadNow')}
              </Button>
            ) : updateStatus === 'error' ? (
              <React.Fragment key="error-footer">
                <Button key="retry" type="primary" onClick={handleCheckForUpdates}>
                  {t('updater.checking').replace('...', '')}
                </Button>
                <Button key="close" onClick={() => setUpdateModalVisible(false)}>
                  {t('updater.close')}
                </Button>
              </React.Fragment>
            ) : (
              <Button key="close" onClick={() => setUpdateModalVisible(false)}>
                {t('updater.close')}
              </Button>
            )
          ]}
        >
          {(updateStatus === 'idle' || updateStatus === 'checking') && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Spin style={{ marginRight: 8 }} />
              <span>{t('updater.checking')}</span>
            </div>
          )}
          {updateStatus === 'not-available' && <p>{t('updater.notAvailable')}</p>}
          {updateStatus === 'available' && (
            <div>
              <p>{t('updater.available')}</p>
              {updateInfo && (
                <p>
                  <strong>{t('updater.newVersion', { version: updateInfo.version })}</strong>
                </p>
              )}
            </div>
          )}
          {updateStatus === 'downloading' && (
            <div>
              <p>{t('updater.downloading')}</p>
              <Progress percent={downloadPercent} />
            </div>
          )}
          {updateStatus === 'downloaded' && <p>{t('updater.downloadedMsg')}</p>}
          {updateStatus === 'error' && (
            <p style={{ color: '#ff4d4f', wordBreak: 'break-word' }}>
              {updateErrorMsg || t('updater.errorTitle')}
            </p>
          )}
        </Modal>
      </div>
    </ConfigProvider>
  )
}
