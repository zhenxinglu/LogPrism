import React, { useState, useEffect, useCallback } from 'react'
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Button,
  Space,
  Alert,
  Popconfirm,
  message
} from 'antd'
import {
  CloudServerOutlined,
  SaveOutlined,
  DeleteOutlined,
  FolderOpenOutlined
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { RemoteFileBrowserModal } from './RemoteFileBrowserModal'

export interface SshConfig {
  id?: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'privateKey'
  password?: string
  privateKey?: string
  passphrase?: string
  remotePath: string
  tailLines?: number
}

interface RemoteLogModalProps {
  open: boolean
  onClose: () => void
  onConnect: (config: SshConfig) => void
  activeConfig: SshConfig | null
}

const NEW_PROFILE_ID = 'new_profile'

export const RemoteLogModal: React.FC<RemoteLogModalProps> = ({
  open,
  onClose,
  onConnect,
  activeConfig
}) => {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [profiles, setProfiles] = useState<SshConfig[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>(NEW_PROFILE_ID)
  const [authType, setAuthType] = useState<'password' | 'privateKey'>('password')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const fillForm = useCallback(
    (config: SshConfig): void => {
      setAuthType(config.authType || 'password')
      form.setFieldsValue({
        name: config.name || '',
        host: config.host || '',
        port: config.port || 22,
        username: config.username || '',
        authType: config.authType || 'password',
        password: config.password || '',
        privateKey: config.privateKey || '',
        passphrase: config.passphrase || '',
        remotePath: config.remotePath || '',
        tailLines: config.tailLines || 1000
      })
      setTestResult(null)
    },
    [form]
  )

  const resetFormToNew = useCallback((): void => {
    setSelectedProfileId(NEW_PROFILE_ID)
    setAuthType('password')
    form.setFieldsValue({
      name: 'New Remote Server',
      host: '',
      port: 22,
      username: 'root',
      authType: 'password',
      password: '',
      privateKey: '',
      passphrase: '',
      remotePath: '/var/log/syslog',
      tailLines: 1000
    })
    setTestResult(null)
  }, [form])

  const loadProfiles = useCallback(async (): Promise<void> => {
    try {
      const savedProfiles = await window.api.getRemoteProfiles()
      setProfiles(savedProfiles || [])

      if (activeConfig && activeConfig.id) {
        setSelectedProfileId(activeConfig.id)
        fillForm(activeConfig)
      } else if (savedProfiles && savedProfiles.length > 0) {
        setSelectedProfileId(savedProfiles[0].id || NEW_PROFILE_ID)
        fillForm(savedProfiles[0])
      } else {
        resetFormToNew()
      }
    } catch (err) {
      console.error('Failed to load remote profiles:', err)
    }
  }, [activeConfig, fillForm, resetFormToNew])

  // Load saved profiles when modal opens
  useEffect(() => {
    if (open) {
      loadProfiles()
    }
  }, [open, loadProfiles])

  const handleProfileChange = (value: string): void => {
    setSelectedProfileId(value)
    if (value === NEW_PROFILE_ID) {
      resetFormToNew()
    } else {
      const found = profiles.find((p) => p.id === value)
      if (found) {
        fillForm(found)
      }
    }
  }

  const handleTestConnection = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setTesting(true)
      setTestResult(null)

      const result = await window.api.testRemoteConnection(values)
      if (result.success) {
        setTestResult({
          success: true,
          message: result.message || t('sshModal.testSuccessDefaultMsg')
        })
      } else {
        setTestResult({
          success: false,
          message: result.message || t('sshModal.testFailedDefaultMsg')
        })
      }
    } catch (err) {
      // Form validation failure or IPC error
      if (err instanceof Error) {
        setTestResult({ success: false, message: err.message })
      }
    } finally {
      setTesting(false)
    }
  }

  const handleSaveProfile = async (): Promise<SshConfig | null> => {
    try {
      const values = await form.validateFields()
      let updatedProfiles: SshConfig[] = []
      let savedConfig: SshConfig

      if (selectedProfileId === NEW_PROFILE_ID) {
        const newId = `ssh_${Date.now()}`
        savedConfig = { ...values, id: newId }
        updatedProfiles = [...profiles, savedConfig]
        setSelectedProfileId(newId)
      } else {
        savedConfig = { ...values, id: selectedProfileId }
        updatedProfiles = profiles.map((p) => (p.id === selectedProfileId ? savedConfig : p))
      }

      setProfiles(updatedProfiles)
      await window.api.saveRemoteProfiles(updatedProfiles)
      message.success(t('sshModal.profileSavedSuccess'))
      return savedConfig
    } catch (err) {
      console.error('Failed to save profile:', err)
      return null
    }
  }

  const handleDeleteProfile = async (): Promise<void> => {
    if (selectedProfileId === NEW_PROFILE_ID) return

    const updated = profiles.filter((p) => p.id !== selectedProfileId)
    setProfiles(updated)
    await window.api.saveRemoteProfiles(updated)
    message.success(t('sshModal.profileDeleted'))
    if (updated.length > 0) {
      setSelectedProfileId(updated[0].id || NEW_PROFILE_ID)
      fillForm(updated[0])
    } else {
      resetFormToNew()
    }
  }

  const handleConnect = async (): Promise<void> => {
    try {
      const savedConfig = await handleSaveProfile()
      if (savedConfig) {
        onConnect(savedConfig)
        onClose()
      }
    } catch (err) {
      console.error('Connection error:', err)
    }
  }

  const [browserModalOpen, setBrowserModalOpen] = useState(false)
  const [browserConfig, setBrowserConfig] = useState<SshConfig | null>(null)

  const handleOpenBrowser = async (): Promise<void> => {
    try {
      const values = await form.validateFields([
        'host',
        'port',
        'username',
        'authType',
        'password',
        'privateKey',
        'passphrase'
      ])
      setBrowserConfig(values as SshConfig)
      setBrowserModalOpen(true)
    } catch {
      message.error(t('sshModal.validationFailed'))
    }
  }

  const handleSelectRemoteFile = (filePath: string): void => {
    form.setFieldsValue({ remotePath: filePath })
  }

  return (
    <>
      <Modal
        title={
          <Space>
            <CloudServerOutlined style={{ color: '#1890ff' }} />
            <span>{t('sshModal.title')}</span>
          </Space>
        }
        open={open}
        onCancel={onClose}
        width={680}
        footer={[
          <Button key="cancel" onClick={onClose}>
            {t('common.cancel')}
          </Button>,
          <Button key="test" loading={testing} onClick={handleTestConnection}>
            {t('sshModal.testConnection')}
          </Button>,
          <Button key="save" icon={<SaveOutlined />} onClick={() => handleSaveProfile()}>
            {t('sshModal.saveProfile')}
          </Button>,
          <Button
            key="connect"
            type="primary"
            icon={<CloudServerOutlined />}
            onClick={handleConnect}
          >
            {t('sshModal.connectAndTail')}
          </Button>
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ port: 22, authType: 'password', tailLines: 1000 }}
        >
          <Form.Item label={t('sshModal.savedProfiles')}>
            <Select value={selectedProfileId} onChange={handleProfileChange}>
              <Select.Option value={NEW_PROFILE_ID}>{t('sshModal.addNewServer')}</Select.Option>
              {profiles.map((p) => (
                <Select.Option key={p.id} value={p.id!}>
                  {p.name || `${p.username}@${p.host}:${p.port}`} ({p.remotePath})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {selectedProfileId !== NEW_PROFILE_ID && (
            <div style={{ textAlign: 'right', marginTop: -12, marginBottom: 12 }}>
              <Popconfirm
                title={t('sshModal.deleteProfilePrompt')}
                description={t('sshModal.deleteProfileConfirm')}
                onConfirm={handleDeleteProfile}
                okText={t('common.yes')}
                cancelText={t('common.no')}
              >
                <Button type="link" danger icon={<DeleteOutlined />} size="small">
                  {t('sshModal.deleteProfile')}
                </Button>
              </Popconfirm>
            </div>
          )}

          <Form.Item
            name="name"
            label={t('sshModal.profileName')}
            rules={[{ required: true, message: t('sshModal.profileNamePlaceholder') }]}
          >
            <Input placeholder={t('sshModal.profileNamePlaceholder')} />
          </Form.Item>

          <Space style={{ display: 'flex' }} align="baseline">
            <Form.Item
              name="host"
              label={t('sshModal.host')}
              style={{ flex: 1 }}
              rules={[{ required: true, message: t('sshModal.hostPlaceholder') }]}
            >
              <Input placeholder={t('sshModal.hostPlaceholder')} />
            </Form.Item>

            <Form.Item name="port" label={t('sshModal.port')} rules={[{ required: true }]}>
              <InputNumber min={1} max={65535} style={{ width: 100 }} />
            </Form.Item>

            <Form.Item
              name="username"
              label={t('sshModal.username')}
              style={{ width: 150 }}
              rules={[{ required: true }]}
            >
              <Input placeholder={t('sshModal.usernamePlaceholder')} />
            </Form.Item>
          </Space>

          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <Form.Item name="authType" label={t('sshModal.authMethod')}>
              <Radio.Group onChange={(e) => setAuthType(e.target.value)}>
                <Radio value="password">{t('sshModal.authPassword')}</Radio>
                <Radio value="privateKey">{t('sshModal.authPrivateKey')}</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="tailLines"
              label={t('sshModal.initialTailLines')}
              style={{ width: 150 }}
            >
              <InputNumber min={10} max={100000} step={100} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          {authType === 'password' ? (
            <Form.Item name="password" label={t('sshModal.password')} rules={[{ required: true }]}>
              <Input.Password placeholder={t('sshModal.passwordPlaceholder')} />
            </Form.Item>
          ) : (
            <>
              <Form.Item
                name="privateKey"
                label={t('sshModal.privateKey')}
                rules={[{ required: true }]}
              >
                <Input.TextArea rows={4} placeholder={t('sshModal.privateKeyPlaceholder')} />
              </Form.Item>

              <Form.Item name="passphrase" label={t('sshModal.passphrase')}>
                <Input.Password placeholder={t('sshModal.passphrasePlaceholder')} />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="remotePath"
            label={t('sshModal.remotePath')}
            style={{ width: '100%' }}
            rules={[{ required: true, message: t('sshModal.remotePathPlaceholder') }]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder={t('sshModal.remotePathPlaceholder')} />
              <Button icon={<FolderOpenOutlined />} onClick={handleOpenBrowser}>
                {t('sshModal.browseServerFiles')}
              </Button>
            </Space.Compact>
          </Form.Item>

          {testResult && (
            <Alert
              style={{ marginTop: 8 }}
              type={testResult.success ? 'success' : 'error'}
              message={
                testResult.success ? t('sshModal.testSuccessTitle') : t('sshModal.testFailedTitle')
              }
              description={testResult.message}
              showIcon
            />
          )}
        </Form>
      </Modal>

      {browserConfig && (
        <RemoteFileBrowserModal
          open={browserModalOpen}
          onClose={() => setBrowserModalOpen(false)}
          onSelectFile={handleSelectRemoteFile}
          config={browserConfig}
          initialPath={form.getFieldValue('remotePath')}
        />
      )}
    </>
  )
}
