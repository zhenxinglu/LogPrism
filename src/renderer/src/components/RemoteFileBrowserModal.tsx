import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Modal, Input, Button, Table, Space, Alert, Breadcrumb, Typography, Tag } from 'antd'
import {
  FolderOutlined,
  FileTextOutlined,
  ArrowUpOutlined,
  ReloadOutlined,
  HomeOutlined,
  SearchOutlined,
  CheckOutlined
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { SshConfig } from './RemoteLogModal'

const { Text } = Typography

export interface RemoteFileItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
  mtime: number
}

interface RemoteFileBrowserModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: (filePath: string) => void
  config: SshConfig
  initialPath?: string
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export const RemoteFileBrowserModal: React.FC<RemoteFileBrowserModalProps> = ({
  open,
  onClose,
  onSelectFile,
  config,
  initialPath
}) => {
  const { t } = useTranslation()
  const [currentPath, setCurrentPath] = useState<string>('/var/log')
  const [pathInput, setPathInput] = useState<string>('/var/log')
  const [items, setItems] = useState<RemoteFileItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<RemoteFileItem | null>(null)
  const [filterText, setFilterText] = useState<string>('')

  const fetchDirectory = useCallback(
    async (targetPath?: string): Promise<void> => {
      if (!config.host || !config.username) {
        setErrorMsg('Please specify remote server host and username first.')
        return
      }

      if (typeof window.api?.listRemoteDirectory !== 'function') {
        setErrorMsg(
          'API unavailable. Please restart the Electron app or dev server to load updated preload bindings.'
        )
        return
      }

      setLoading(true)
      setErrorMsg(null)
      setSelectedItem(null)

      try {
        const result = await window.api.listRemoteDirectory(config, targetPath)
        if (result.success && result.items) {
          const resolved = result.currentPath || targetPath || '/'
          setCurrentPath(resolved)
          setPathInput(resolved)
          setItems(result.items)
        } else {
          setErrorMsg(result.error || 'Failed to list directory contents.')
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [config]
  )

  useEffect(() => {
    if (open) {
      let startPath = '/var/log'
      if (initialPath && initialPath.trim()) {
        const trimmed = initialPath.trim()
        if (trimmed.includes('/')) {
          startPath = trimmed.substring(0, trimmed.lastIndexOf('/')) || '/'
        } else {
          startPath = trimmed
        }
      }
      fetchDirectory(startPath)
    }
  }, [open, initialPath, fetchDirectory])

  const handleNavigateUp = (): void => {
    if (currentPath === '/' || !currentPath) return
    const lastSlash = currentPath.lastIndexOf('/')
    const parent = currentPath.substring(0, lastSlash) || '/'
    fetchDirectory(parent)
  }

  const handlePathSubmit = (): void => {
    if (pathInput.trim()) {
      fetchDirectory(pathInput.trim())
    }
  }

  const handleConfirmSelect = (): void => {
    if (selectedItem && !selectedItem.isDirectory) {
      onSelectFile(selectedItem.path)
      onClose()
    }
  }

  const filteredItems = useMemo(() => {
    if (!filterText.trim()) return items
    const query = filterText.toLowerCase()
    return items.filter((item) => item.name.toLowerCase().includes(query))
  }, [items, filterText])

  const pathSegments = useMemo(() => {
    if (!currentPath || currentPath === '/') return []
    return currentPath.split('/').filter(Boolean)
  }, [currentPath])

  const columns = [
    {
      title: t('sshModal.colName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: RemoteFileItem): React.ReactNode => (
        <Space>
          {record.isDirectory ? (
            <FolderOutlined style={{ color: '#eab308', fontSize: 16 }} />
          ) : (
            <FileTextOutlined style={{ color: '#3b82f6', fontSize: 16 }} />
          )}
          <Text strong={record.isDirectory} style={{ cursor: 'pointer' }}>
            {text}
          </Text>
        </Space>
      )
    },
    {
      title: t('sshModal.colSize'),
      dataIndex: 'size',
      key: 'size',
      width: 110,
      render: (size: number, record: RemoteFileItem): React.ReactNode =>
        record.isDirectory ? '-' : <Text type="secondary">{formatFileSize(size)}</Text>
    },
    {
      title: t('sshModal.colModified'),
      dataIndex: 'mtime',
      key: 'mtime',
      width: 170,
      render: (mtime: number): React.ReactNode =>
        mtime ? <Text type="secondary">{dayjs(mtime).format('YYYY-MM-DD HH:mm')}</Text> : '-'
    }
  ]

  return (
    <Modal
      title={
        <Space>
          <FolderOutlined style={{ color: '#1890ff' }} />
          <span>{t('sshModal.browseModalTitle')}</span>
          <Tag color="blue">{`${config.username}@${config.host}`}</Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={720}
      footer={[
        <div
          key="footer-wrapper"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div
            style={{
              maxWidth: 420,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'left'
            }}
          >
            {selectedItem && !selectedItem.isDirectory ? (
              <Text type="success" style={{ fontSize: 13 }}>
                <CheckOutlined style={{ marginRight: 4 }} />
                {selectedItem.path}
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: 13 }}>
                Double-click folder to open, or select a file
              </Text>
            )}
          </div>
          <Space>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button
              type="primary"
              disabled={!selectedItem || selectedItem.isDirectory}
              icon={<CheckOutlined />}
              onClick={handleConfirmSelect}
            >
              {t('sshModal.selectFile')}
            </Button>
          </Space>
        </div>
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Navigation bar */}
        <Space style={{ display: 'flex', width: '100%' }}>
          <Button
            icon={<ArrowUpOutlined />}
            disabled={currentPath === '/'}
            onClick={handleNavigateUp}
            title={t('sshModal.upDirectory')}
          />
          <Button icon={<HomeOutlined />} onClick={() => fetchDirectory('/')} title="Root" />
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => fetchDirectory(currentPath)}
            title={t('sshModal.refreshDirectory')}
          />
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onPressEnter={handlePathSubmit}
            placeholder="/var/log"
            style={{ flex: 1 }}
          />
          <Button type="primary" onClick={handlePathSubmit}>
            Go
          </Button>
        </Space>

        {/* Breadcrumbs */}
        <div
          style={{
            padding: '4px 8px',
            background: 'rgba(0,0,0,0.03)',
            borderRadius: 4,
            fontSize: 13
          }}
        >
          <Breadcrumb style={{ fontSize: 13 }}>
            <Breadcrumb.Item onClick={() => fetchDirectory('/')} style={{ cursor: 'pointer' }}>
              /
            </Breadcrumb.Item>
            {pathSegments.map((seg, idx) => {
              const segPath = '/' + pathSegments.slice(0, idx + 1).join('/')
              return (
                <Breadcrumb.Item
                  key={segPath}
                  onClick={() => fetchDirectory(segPath)}
                  style={{ cursor: 'pointer' }}
                >
                  {seg}
                </Breadcrumb.Item>
              )
            })}
          </Breadcrumb>
        </div>

        {/* Filter input */}
        <Input
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder={t('sshModal.filterPlaceholder')}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          allowClear
        />

        {/* Error Alert */}
        {errorMsg && <Alert type="error" message={errorMsg} showIcon />}

        {/* File Table */}
        <Table<RemoteFileItem>
          rowKey="path"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={filteredItems}
          pagination={false}
          scroll={{ y: 320 }}
          locale={{ emptyText: loading ? t('sshModal.loadingDirectory') : t('sshModal.noFiles') }}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: selectedItem ? [selectedItem.path] : [],
            onChange: (_selectedRowKeys, selectedRows) => {
              if (selectedRows && selectedRows.length > 0) {
                setSelectedItem(selectedRows[0])
              }
            }
          }}
          onRow={(record) => ({
            onClick: () => {
              setSelectedItem(record)
            },
            onDoubleClick: () => {
              if (record.isDirectory) {
                fetchDirectory(record.path)
              } else {
                setSelectedItem(record)
                onSelectFile(record.path)
                onClose()
              }
            }
          })}
        />
      </Space>
    </Modal>
  )
}
