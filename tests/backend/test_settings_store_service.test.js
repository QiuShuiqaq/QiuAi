import { describe, expect, it } from 'vitest'

describe('settingsStoreService', () => {
  it('saves and loads dual api keys with active slot', async () => {
    const memory = new Map()
    const store = {
      get (key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set (key, value) {
        memory.set(key, value)
      }
    }

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    await service.saveSettings({
      apiBaseUrl: 'https://grsai.dakka.com.cn',
      apiKeys: ['sk-demo-1', 'sk-demo-2'],
      activeApiKeyIndex: 1,
      defaultSize: '1:1',
      downloadDirectory: 'C:/QiuAi',
      themeMode: 'eye-care'
    })

    expect(service.getSettings()).toMatchObject({
      apiBaseUrl: 'https://grsai.dakka.com.cn',
      apiKeys: ['sk-demo-1', 'sk-demo-2'],
      activeApiKeyIndex: 1,
      apiKey: 'sk-demo-2',
      defaultSize: '1:1',
      downloadDirectory: 'C:/QiuAi',
      themeMode: 'eye-care'
    })
  })

  it('maps legacy single api key payload into the active slot', async () => {
    const memory = new Map()
    const store = {
      get (key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set (key, value) {
        memory.set(key, value)
      }
    }

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    await service.saveSettings({
      apiKeys: ['sk-old-1', 'sk-old-2'],
      activeApiKeyIndex: 0
    })

    await service.saveSettings({
      apiKey: 'sk-legacy'
    })

    expect(service.getSettings()).toMatchObject({
      apiKeys: ['sk-legacy', 'sk-old-2'],
      activeApiKeyIndex: 0,
      apiKey: 'sk-legacy'
    })
  })
})
