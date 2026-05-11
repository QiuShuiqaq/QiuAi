import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isProxy, reactive } from 'vue'

describe('desktopBridge', () => {
  beforeEach(() => {
    vi.resetModules()
    global.window = {}
  })

  it('reads the qiuai bridge lazily so late preload injection still works', async () => {
    const { saveSettings } = await import('../../renderer/src/services/desktopBridge.js')
    const invoke = vi.fn().mockResolvedValue({ ok: true })

    window.qiuai = {
      channels: {
        SETTINGS_SAVE: 'settings:save'
      },
      invoke
    }

    await saveSettings({
      apiKeys: ['sk-1', ''],
      activeApiKeyIndex: 0
    })

    expect(invoke).toHaveBeenCalledWith('settings:save', {
      apiKeys: ['sk-1', ''],
      activeApiKeyIndex: 0
    })
  })

  it('invokes the admin api key save channel through the desktop bridge', async () => {
    const invoke = vi.fn().mockResolvedValue({ apiKey: 'sk-admin-real' })

    window.qiuai = {
      channels: {
        SETTINGS_SAVE_ADMIN_API_KEY: 'settings:save-admin-api-key'
      },
      invoke
    }

    const { saveAdminApiKey } = await import('../../renderer/src/services/desktopBridge.js')

    await saveAdminApiKey({
      apiKey: 'sk-admin-real',
      password: 'qiuai@123'
    })

    expect(invoke).toHaveBeenCalledWith('settings:save-admin-api-key', {
      apiKey: 'sk-admin-real',
      password: 'qiuai@123'
    })
  })

  it('falls back to browser storage for settings when the electron bridge is unavailable', async () => {
    const storage = new Map()
    window.localStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      }
    }

    const { getSettings, saveSettings } = await import('../../renderer/src/services/desktopBridge.js')

    const saved = await saveSettings({
      apiKeys: ['sk-browser', ''],
      activeApiKeyIndex: 0,
      themeMode: 'light'
    })
    const loaded = await getSettings()

    expect(saved.apiKeys[0]).toBe('sk-browser')
    expect(saved.themeMode).toBe('dark')
    expect(loaded.apiKeys[0]).toBe('sk-browser')
    expect(storage.get('qiuai-browser-settings')).toContain('sk-browser')
  })

  it('falls back to browser storage for negative prompt templates when the electron bridge is unavailable', async () => {
    const storage = new Map()
    window.localStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      }
    }

    const {
      listNegativePromptTemplates,
      saveNegativePromptTemplate,
      removeNegativePromptTemplate
    } = await import('../../renderer/src/services/desktopBridge.js')

    const defaults = await listNegativePromptTemplates()
    expect(defaults[0]?.id).toBe('system-empty-negative-prompt')
    expect(defaults[0]?.name).toBe('无负向提示词')
    expect(defaults.some((item) => item.name === '电商通用')).toBe(true)
    expect(defaults.some((item) => item.name === '电商模特')).toBe(true)
    expect(defaults.some((item) => item.name === '电商静物')).toBe(true)

    const saved = await saveNegativePromptTemplate({
      name: '服饰限制',
      category: '反向提示词',
      prompt: '穿模，线头'
    })

    expect(saved.name).toBe('服饰限制')

    const afterSave = await listNegativePromptTemplates()
    expect(afterSave.some((item) => item.id === saved.id)).toBe(true)

    await removeNegativePromptTemplate({
      id: saved.id
    })

    const afterRemove = await listNegativePromptTemplates()
    expect(afterRemove.some((item) => item.id === saved.id)).toBe(false)
    expect(storage.get('qiuai-browser-negative-prompts')).toContain('negative-common')
  })

  it('falls back to browser storage for prompt templates with the empty system template first', async () => {
    const storage = new Map()
    window.localStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      }
    }

    const {
      listPromptTemplates,
      savePromptTemplate,
      removePromptTemplate
    } = await import('../../renderer/src/services/desktopBridge.js')

    const defaults = await listPromptTemplates()
    expect(defaults[0]?.id).toBe('system-empty-image-type')
    expect(defaults[0]?.name).toBe('无类型图片')
    expect(defaults[0]?.prompt).toBe('')
    expect(defaults.some((item) => item.id === 'product-main')).toBe(true)

    const saved = await savePromptTemplate({
      name: '暖光补充',
      category: '按钮提示词',
      prompt: '统一暖光氛围'
    })

    expect(saved.name).toBe('暖光补充')

    const afterSave = await listPromptTemplates()
    expect(afterSave.some((item) => item.id === saved.id)).toBe(true)

    await removePromptTemplate({
      id: saved.id
    })

    const afterRemove = await listPromptTemplates()
    expect(afterRemove.some((item) => item.id === saved.id)).toBe(false)
    expect(storage.get('qiuai-browser-prompts')).toContain('system-empty-image-type')
  })

  it('invokes negative prompt template channels through the desktop bridge', async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce([{ id: 'negative-common', name: '电商通用' }])
      .mockResolvedValueOnce({ id: 'negative-custom', name: '服饰限制', prompt: '穿模，线头' })
      .mockResolvedValueOnce({ ok: true })

    window.qiuai = {
      channels: {
        NEGATIVE_PROMPTS_LIST: 'negative-prompts:list',
        NEGATIVE_PROMPTS_SAVE: 'negative-prompts:save',
        NEGATIVE_PROMPTS_REMOVE: 'negative-prompts:remove'
      },
      invoke
    }

    const {
      listNegativePromptTemplates,
      saveNegativePromptTemplate,
      removeNegativePromptTemplate
    } = await import('../../renderer/src/services/desktopBridge.js')

    await listNegativePromptTemplates()
    await saveNegativePromptTemplate({
      name: '服饰限制',
      category: '反向提示词',
      prompt: '穿模，线头'
    })
    await removeNegativePromptTemplate({
      id: 'negative-custom'
    })

    expect(invoke).toHaveBeenNthCalledWith(1, 'negative-prompts:list', undefined)
    expect(invoke).toHaveBeenNthCalledWith(2, 'negative-prompts:save', {
      name: '服饰限制',
      category: '反向提示词',
      prompt: '穿模，线头'
    })
    expect(invoke).toHaveBeenNthCalledWith(3, 'negative-prompts:remove', {
      id: 'negative-custom'
    })
  })

  it('applies browser-side credit adjustments when the desktop bridge is unavailable', async () => {
    const storage = new Map()
    window.localStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      }
    }

    const { getSettings, saveSettings } = await import('../../renderer/src/services/desktopBridge.js')

    await saveSettings({
      creditAdjustment: {
        operation: 'increase',
        amount: 1000
      }
    })

    const loaded = await getSettings()

    expect(loaded.creditState.remainingCredits).toBe(1000)
    expect(loaded.creditState.totalPurchasedCredits).toBe(1000)
  })

  it('saves browser-side total credits directly when the desktop bridge is unavailable', async () => {
    const storage = new Map()
    window.localStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      }
    }

    const { getSettings, saveSettings } = await import('../../renderer/src/services/desktopBridge.js')

    await saveSettings({
      creditState: {
        totalPurchasedCredits: 500,
        remainingCredits: 300
      }
    })

    const loaded = await getSettings()

    expect(loaded.creditState.totalPurchasedCredits).toBe(500)
    expect(loaded.creditState.remainingCredits).toBe(300)
  })

  it('saves browser-side dashboard credit state independently when the desktop bridge is unavailable', async () => {
    const storage = new Map()
    window.localStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      }
    }

    const { getSettings, saveSettings } = await import('../../renderer/src/services/desktopBridge.js')

    await saveSettings({
      dashboardCreditState: {
        totalCredits: 4096,
        remainingCredits: 2048
      }
    })

    const loaded = await getSettings()

    expect(loaded.dashboardCreditState).toEqual({
      totalCredits: 4096,
      remainingCredits: 2048
    })
    expect(loaded.creditState.remainingCredits).toBe(0)
  })

  it('keeps browser upload directories isolated per menu', async () => {
    const storage = new Map()
    window.localStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      }
    }

    const { getSettings, saveSettings } = await import('../../renderer/src/services/desktopBridge.js')

    await saveSettings({
      uploadDirectories: {
        'single-image': 'E:/QiuAi/Input/SingleImage'
      }
    })

    const loaded = await getSettings()

    expect(loaded.uploadDirectories['single-image']).toBe('E:/QiuAi/Input/SingleImage')
    expect(loaded.uploadDirectories['single-design']).toBe('')
  })

  it('serializes reactive payloads before invoking the electron bridge', async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true })

    window.qiuai = {
      channels: {
        STUDIO_SAVE_DRAFT: 'studio:save-draft'
      },
      invoke
    }

    const { saveStudioDraft } = await import('../../renderer/src/services/desktopBridge.js')
    const patch = reactive({
      imageAssignments: [
        {
          id: 'image-1',
          selected: true,
          prompt: '统一风格',
          size: '4:3',
          model: 'nano-banana-fast',
          tagIds: ['tag-quality-hd']
        }
      ]
    })

    await saveStudioDraft({
      menuKey: 'series-design',
      patch
    })

    const payload = invoke.mock.calls[0][1]
    expect(invoke.mock.calls[0][0]).toBe('studio:save-draft')
    expect(payload.menuKey).toBe('series-design')
    expect(payload.patch).toEqual({
      imageAssignments: [
        {
          id: 'image-1',
          selected: true,
          prompt: '统一风格',
          size: '4:3',
          model: 'nano-banana-fast',
          tagIds: ['tag-quality-hd']
        }
      ]
    })
    expect(isProxy(payload.patch)).toBe(false)
    expect(isProxy(payload.patch.imageAssignments)).toBe(false)
    expect(isProxy(payload.patch.imageAssignments[0])).toBe(false)
  })

  it('invokes the studio delete export item channel through the desktop bridge', async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true })

    window.qiuai = {
      channels: {
        STUDIO_DELETE_EXPORT_ITEM: 'studio:delete-export-item'
      },
      invoke
    }

    const { deleteStudioExportItem } = await import('../../renderer/src/services/desktopBridge.js')

    await deleteStudioExportItem({
      menuKey: 'single-image',
      exportItemId: 'single-export-folder-1'
    })

    expect(invoke).toHaveBeenCalledWith('studio:delete-export-item', {
      menuKey: 'single-image',
      exportItemId: 'single-export-folder-1'
    })
  })

  it('invokes the studio stop task channel through the desktop bridge', async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true })

    window.qiuai = {
      channels: {
        STUDIO_STOP_TASK: 'studio:stop-task'
      },
      invoke
    }

    const { stopStudioTask } = await import('../../renderer/src/services/desktopBridge.js')

    await stopStudioTask({
      taskId: 'task-stop-1'
    })

    expect(invoke).toHaveBeenCalledWith('studio:stop-task', {
      taskId: 'task-stop-1'
    })
  })

  it('invokes the studio input picker channel through the desktop bridge', async () => {
    const invoke = vi.fn().mockResolvedValue({ canceled: false, files: [] })

    window.qiuai = {
      channels: {
        STUDIO_PICK_INPUT_ASSETS: 'studio:pick-input-assets'
      },
      invoke
    }

    const { pickStudioInputAssets } = await import('../../renderer/src/services/desktopBridge.js')

    await pickStudioInputAssets({
      menuKey: 'series-design',
      allowMultiple: true
    })

    expect(invoke).toHaveBeenCalledWith('studio:pick-input-assets', {
      menuKey: 'series-design',
      allowMultiple: true
    })
  })

  it('invokes the studio clear runtime channel through the desktop bridge', async () => {
    const invoke = vi.fn().mockResolvedValue({ cleared: true })

    window.qiuai = {
      channels: {
        STUDIO_CLEAR_RUNTIME_STATE: 'studio:clear-runtime-state'
      },
      invoke
    }

    const { clearStudioRuntimeState } = await import('../../renderer/src/services/desktopBridge.js')

    await clearStudioRuntimeState()

    expect(invoke).toHaveBeenCalledWith('studio:clear-runtime-state', undefined)
  })

  it('invokes the dashboard credit refresh channel through the desktop bridge', async () => {
    const invoke = vi.fn().mockResolvedValue({ totalCredits: 3000, remainingCredits: 2800 })

    window.qiuai = {
      channels: {
        STUDIO_REFRESH_DASHBOARD_CREDITS: 'studio:refresh-dashboard-credits'
      },
      invoke
    }

    const { refreshDashboardCredits } = await import('../../renderer/src/services/desktopBridge.js')

    await refreshDashboardCredits({
      target: 'total'
    })

    expect(invoke).toHaveBeenCalledWith('studio:refresh-dashboard-credits', {
      target: 'total'
    })
  })

  it('returns the browser snapshot directly when the electron bridge is unavailable', async () => {
    const storage = new Map()
    window.localStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      }
    }

    storage.set('qiuai-browser-studio', JSON.stringify({
      workspaceDashboard: {
        creditOverview: {
          title: '积分仪表盘',
          items: [
            { label: '剩余积分', value: '1234' }
          ]
        }
      }
    }))

    const { getStudioSnapshot } = await import('../../renderer/src/services/desktopBridge.js')
    const snapshot = await getStudioSnapshot()

    expect(snapshot.workspaceDashboard.creditOverview.items[0]).toEqual({
      label: '剩余积分',
      value: '1234'
    })
  })

  it('invokes activation status and license import through the desktop bridge', async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ status: 'not_found', deviceCode: 'QAI-TEST', message: '未检测到授权文件' })
      .mockResolvedValueOnce({ status: 'activated', deviceCode: 'QAI-TEST', message: '导入授权成功' })

    window.qiuai = {
      channels: {
        LICENSE_GET_STATUS: 'license:get-status',
        LICENSE_IMPORT_FILE: 'license:import-file'
      },
      invoke
    }

    const { getActivationStatus, importLicenseFile } = await import('../../renderer/src/services/desktopBridge.js')

    await getActivationStatus()
    await importLicenseFile()

    expect(invoke).toHaveBeenNthCalledWith(1, 'license:get-status', undefined)
    expect(invoke).toHaveBeenNthCalledWith(2, 'license:import-file', undefined)
  })
})
