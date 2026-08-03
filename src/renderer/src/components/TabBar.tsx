import React from 'react'
import { Button, Dropdown, Space, Tooltip, Tag, MenuProps } from 'antd'
import {
  FileOutlined,
  CloudServerOutlined,
  PlusOutlined,
  CloseOutlined,
  FolderOpenOutlined,
  BorderOutlined,
  ColumnWidthOutlined,
  ColumnHeightOutlined,
  LinkOutlined,
  DisconnectOutlined
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { SshConfig } from './RemoteLogModal'

export interface LogTab {
  id: string
  title: string
  type: 'local' | 'remote'
  filePath?: string
  remoteConfig?: SshConfig
}

export type SplitMode = 'none' | 'horizontal' | 'vertical'

interface TabBarProps {
  tabs: LogTab[]
  activeTabId: string | null
  activeTabIdPaneA: string | null
  activeTabIdPaneB: string | null
  splitMode: SplitMode
  activePane: 'paneA' | 'paneB'
  scrollSync: boolean
  isDarkMode: boolean
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onCloseOtherTabs: (tabId: string) => void
  onCloseAllTabs: () => void
  onOpenLocalFile: () => void
  onOpenRemoteSsh: () => void
  onChangeSplitMode: (mode: SplitMode) => void
  onToggleScrollSync: () => void
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  activeTabIdPaneA,
  activeTabIdPaneB,
  splitMode,
  activePane,
  scrollSync,
  isDarkMode,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onOpenLocalFile,
  onOpenRemoteSsh,
  onChangeSplitMode,
  onToggleScrollSync
}) => {
  const { t } = useTranslation()

  const newTabMenuItems: MenuProps['items'] = [
    {
      key: 'local',
      icon: <FolderOpenOutlined />,
      label: t('tabs.openLocalFile'),
      onClick: onOpenLocalFile
    },
    {
      key: 'remote',
      icon: <CloudServerOutlined />,
      label: t('tabs.connectRemoteSsh'),
      onClick: onOpenRemoteSsh
    }
  ]

  const getContextMenuItems = (tabId: string): MenuProps['items'] => [
    {
      key: 'close',
      icon: <CloseOutlined />,
      label: t('tabs.closeTab'),
      onClick: () => onCloseTab(tabId)
    },
    {
      key: 'closeOthers',
      icon: <DisconnectOutlined />,
      label: t('tabs.closeOthers'),
      disabled: tabs.length <= 1,
      onClick: () => onCloseOtherTabs(tabId)
    },
    {
      type: 'divider'
    },
    {
      key: 'closeAll',
      icon: <CloseOutlined />,
      label: t('tabs.closeAll'),
      onClick: onCloseAllTabs
    }
  ]

  const bgStyle = isDarkMode ? '#1e1e1e' : '#f0f2f5'
  const borderBottomColor = isDarkMode ? '#303030' : '#e8e8e8'
  const activeTabBg = isDarkMode ? '#141414' : '#ffffff'
  const inactiveTabBg = isDarkMode ? '#282828' : '#e6e8eb'
  const textColor = isDarkMode ? '#e0e0e0' : '#1f2937'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: bgStyle,
        borderBottom: `1px solid ${borderBottomColor}`,
        padding: '4px 8px 0 8px',
        overflowX: 'auto',
        userSelect: 'none'
      }}
    >
      {/* Left: Scrollable Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          overflowX: 'auto',
          flex: 1,
          marginRight: 8,
          scrollbarWidth: 'thin'
        }}
      >
        {tabs.map((tab) => {
          const isActiveInCurrentPane =
            splitMode === 'none'
              ? tab.id === activeTabId
              : (activePane === 'paneA' && tab.id === activeTabIdPaneA) ||
                (activePane === 'paneB' && tab.id === activeTabIdPaneB)

          const isPaneA = splitMode !== 'none' && tab.id === activeTabIdPaneA
          const isPaneB = splitMode !== 'none' && tab.id === activeTabIdPaneB

          return (
            <Dropdown
              key={tab.id}
              menu={{ items: getContextMenuItems(tab.id) }}
              trigger={['contextMenu']}
            >
              <div
                onClick={() => onSelectTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: '6px 6px 0 0',
                  backgroundColor: isActiveInCurrentPane ? activeTabBg : inactiveTabBg,
                  color: textColor,
                  border: isActiveInCurrentPane
                    ? `1px solid ${borderBottomColor}`
                    : '1px solid transparent',
                  borderBottom: isActiveInCurrentPane ? `2px solid #1677ff` : 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                {tab.type === 'remote' ? (
                  <CloudServerOutlined style={{ color: '#1677ff' }} />
                ) : (
                  <FileOutlined style={{ color: '#8c8c8c' }} />
                )}
                <span style={{ fontWeight: isActiveInCurrentPane ? 600 : 400 }}>
                  {tab.title || t('tabs.untitled')}
                </span>

                {/* Split Pane badges if split view active */}
                {isPaneA && (
                  <Tag
                    color="blue"
                    style={{ margin: 0, fontSize: 10, lineHeight: '14px', padding: '0 4px' }}
                  >
                    A
                  </Tag>
                )}
                {isPaneB && (
                  <Tag
                    color="purple"
                    style={{ margin: 0, fontSize: 10, lineHeight: '14px', padding: '0 4px' }}
                  >
                    B
                  </Tag>
                )}

                {/* Close button */}
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseTab(tab.id)
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    marginLeft: 4,
                    opacity: 0.7,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? '#434343' : '#d9d9d9'
                    e.currentTarget.style.opacity = '1'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.opacity = '0.7'
                  }}
                >
                  <CloseOutlined style={{ fontSize: 10 }} />
                </span>
              </div>
            </Dropdown>
          )
        })}

        {/* Plus Button for adding new tab */}
        <Dropdown menu={{ items: newTabMenuItems }} trigger={['click']}>
          <Tooltip title={t('tabs.newTab')}>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              style={{ borderRadius: 4, color: textColor }}
            />
          </Tooltip>
        </Dropdown>
      </div>

      {/* Right: Split View Controls */}
      <Space size={4} style={{ marginBottom: 4 }}>
        <Tooltip title={t('splitView.single')}>
          <Button
            type={splitMode === 'none' ? 'primary' : 'default'}
            size="small"
            icon={<BorderOutlined />}
            onClick={() => onChangeSplitMode('none')}
          />
        </Tooltip>
        <Tooltip title={t('splitView.horizontal')}>
          <Button
            type={splitMode === 'horizontal' ? 'primary' : 'default'}
            size="small"
            icon={<ColumnWidthOutlined />}
            onClick={() => onChangeSplitMode('horizontal')}
          />
        </Tooltip>
        <Tooltip title={t('splitView.vertical')}>
          <Button
            type={splitMode === 'vertical' ? 'primary' : 'default'}
            size="small"
            icon={<ColumnHeightOutlined />}
            onClick={() => onChangeSplitMode('vertical')}
          />
        </Tooltip>

        {splitMode !== 'none' && (
          <Tooltip title={scrollSync ? t('splitView.syncScrollOn') : t('splitView.syncScrollOff')}>
            <Button
              type={scrollSync ? 'primary' : 'default'}
              danger={scrollSync}
              size="small"
              icon={<LinkOutlined />}
              onClick={onToggleScrollSync}
            >
              {t('splitView.syncScroll')}
            </Button>
          </Tooltip>
        )}
      </Space>
    </div>
  )
}
