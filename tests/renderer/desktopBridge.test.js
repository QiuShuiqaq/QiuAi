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
    expect(saved.themeMode).toBe('light')
    expect(loaded.apiKeys[0]).toBe('sk-browser')
    expect(storage.get('qiuai-browser-settings')).toContain('sk-browser')
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
          prompt: '统一风格'
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
          prompt: '统一风格'
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
})
