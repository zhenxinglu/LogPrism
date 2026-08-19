import React from 'react'
import { Modal, Typography, Tag, Row, Col, Divider } from 'antd'
import { KeyOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

const { Text } = Typography

export interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
  isDark?: boolean
}

interface ShortcutItem {
  keys: string[]
  descriptionKey: string
  defaultDesc: string
}

interface ShortcutGroup {
  categoryKey: string
  defaultCategory: string
  shortcuts: ShortcutItem[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    categoryKey: 'shortcuts.categoryFiltering',
    defaultCategory: 'Filter & Search Controls',
    shortcuts: [
      {
        keys: ['Ctrl', 'I'],
        descriptionKey: 'shortcuts.includeKeywords',
        defaultDesc: 'Focus & select Include Keywords input'
      },
      {
        keys: ['Ctrl', 'E'],
        descriptionKey: 'shortcuts.excludeKeywords',
        defaultDesc: 'Focus & select Exclude Keywords input'
      },
      {
        keys: ['Ctrl', 'F'],
        descriptionKey: 'shortcuts.findInLog',
        defaultDesc: 'Open search bar & focus search input'
      },
      {
        keys: ['F3'],
        descriptionKey: 'shortcuts.nextMatch',
        defaultDesc: 'Jump to next search match'
      },
      {
        keys: ['Shift', 'F3'],
        descriptionKey: 'shortcuts.prevMatch',
        defaultDesc: 'Jump to previous search match'
      }
    ]
  },
  {
    categoryKey: 'shortcuts.categoryPanels',
    defaultCategory: 'View & Panel Toggles',
    shortcuts: [
      {
        keys: ['Ctrl', 'Shift', 'F'],
        descriptionKey: 'shortcuts.toggleFilterPanel',
        defaultDesc: 'Expand or collapse Filter Panel'
      },
      {
        keys: ['Ctrl', 'B'],
        descriptionKey: 'shortcuts.toggleBookmarks',
        defaultDesc: 'Toggle Bookmarks & Pins drawer'
      },
      {
        keys: ['Ctrl', 'T'],
        descriptionKey: 'shortcuts.toggleTimeline',
        defaultDesc: 'Toggle Density Timeline bar'
      }
    ]
  },
  {
    categoryKey: 'shortcuts.categoryGeneral',
    defaultCategory: 'General Shortcuts',
    shortcuts: [
      {
        keys: ['Esc'],
        descriptionKey: 'shortcuts.unfocusOrClose',
        defaultDesc: 'Unfocus input, close search / overlay, or clear highlight'
      },
      {
        keys: ['Ctrl', '/'],
        descriptionKey: 'shortcuts.showHelp',
        defaultDesc: 'Show this Keyboard Shortcuts reference guide'
      }
    ]
  }
]

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  open,
  onClose,
  isDark = false
}) => {
  const { t } = useTranslation()

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyOutlined style={{ color: '#3b82f6' }} />
          <span>{t('shortcuts.title', 'Keyboard Shortcuts')}</span>
        </div>
      }
      width={440}
      styles={{
        body: {
          background: isDark ? '#1e1e22' : '#ffffff',
          color: isDark ? '#f1f5f9' : '#0f172a'
        },
        header: {
          background: isDark ? '#1e1e22' : '#ffffff',
          color: isDark ? '#f1f5f9' : '#0f172a'
        }
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
        {SHORTCUT_GROUPS.map((group, groupIdx) => (
          <React.Fragment key={group.categoryKey}>
            {groupIdx > 0 && <Divider style={{ margin: '4px 0' }} />}
            <div>
              <Text
                type="secondary"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: isDark ? '#94a3b8' : '#64748b'
                }}
              >
                {t(group.categoryKey, group.defaultCategory)}
              </Text>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.shortcuts.map((item) => (
                  <Row
                    key={item.descriptionKey}
                    align="middle"
                    justify="space-between"
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'
                    }}
                  >
                    <Col>
                      <Text style={{ fontSize: 13, color: isDark ? '#cbd5e1' : '#334155' }}>
                        {t(item.descriptionKey, item.defaultDesc)}
                      </Text>
                    </Col>
                    <Col>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {item.keys.map((key) => (
                          <Tag
                            key={key}
                            style={{
                              margin: 0,
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              fontSize: 11,
                              borderRadius: 4,
                              background: isDark ? '#0f172a' : '#f1f5f9',
                              borderColor: isDark ? '#334155' : '#cbd5e1',
                              color: isDark ? '#38bdf8' : '#0284c7'
                            }}
                          >
                            {key}
                          </Tag>
                        ))}
                      </div>
                    </Col>
                  </Row>
                ))}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </Modal>
  )
}
