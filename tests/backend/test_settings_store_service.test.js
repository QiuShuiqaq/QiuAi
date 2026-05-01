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
      uploadDirectories: {
        'single-image': 'C:/QiuAi/Input/SingleImage',
        'single-design': 'C:/QiuAi/Input/SingleDesign',
        'series-design': 'C:/QiuAi/Input/SeriesDesign',
        'series-generate': 'C:/QiuAi/Input/SeriesGenerate'
      },
      themeMode: 'eye-care'
    }, {
      isDirectory: (targetPath) => targetPath.startsWith('C:/QiuAi/Input/')
    })

    expect(service.getSettings()).toMatchObject({
      apiBaseUrl: 'https://grsai.dakka.com.cn',
      apiKeys: ['sk-demo-1', 'sk-demo-2'],
      activeApiKeyIndex: 1,
      apiKey: 'sk-demo-2',
      defaultSize: '1:1',
      downloadDirectory: 'C:/QiuAi',
      uploadDirectories: {
        'single-image': 'C:/QiuAi/Input/SingleImage',
        'single-design': 'C:/QiuAi/Input/SingleDesign',
        'series-design': 'C:/QiuAi/Input/SeriesDesign',
        'series-generate': 'C:/QiuAi/Input/SeriesGenerate'
      },
      themeMode: 'dark'
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

  it('rejects invalid upload directories and accepts empty values as cleared defaults', async () => {
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

    await expect(service.saveSettings({
      uploadDirectories: {
        'single-image': 'Z:/missing-folder'
      }
    }, {
      isDirectory: () => false
    })).rejects.toThrow('默认上传目录不存在或不是文件夹')

    await service.saveSettings({
      uploadDirectories: {
        'single-image': ''
      }
    }, {
      isDirectory: () => false
    })

    expect(service.getSettings().uploadDirectories['single-image']).toBe('')
  })

  it('keeps upload directories isolated per menu across service instances', async () => {
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
    const firstService = createSettingsStoreService({ store })

    await firstService.saveSettings({
      uploadDirectories: {
        'single-design': 'D:/QiuAi/Input/SingleDesign'
      }
    }, {
      isDirectory: (targetPath) => targetPath === 'D:/QiuAi/Input/SingleDesign'
    })

    const secondService = createSettingsStoreService({ store })

    expect(secondService.getSettings()).toMatchObject({
      uploadDirectories: {
        'single-image': '',
        'single-design': 'D:/QiuAi/Input/SingleDesign',
        'series-design': '',
        'series-generate': ''
      }
    })
  })

  it('applies manual credit adjustments and keeps a local credit summary', async () => {
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
      creditAdjustment: {
        operation: 'increase',
        amount: 20000000
      }
    }, {
      getNow: () => '2026-04-29T12:00:00.000Z'
    })

    await service.saveSettings({
      creditAdjustment: {
        operation: 'decrease',
        amount: 600
      }
    }, {
      getNow: () => '2026-04-29T12:05:00.000Z'
    })

    expect(service.getSettings().creditState).toMatchObject({
      totalPurchasedCredits: 20000000,
      remainingCredits: 19999400,
      frozenCredits: 0,
      usedCredits: 0,
      lastAdjustmentAt: '2026-04-29T12:05:00.000Z',
      lastAdjustmentOperation: 'decrease'
    })
    expect(service.getSettings().creditState.adjustmentHistory).toHaveLength(2)
    expect(service.getSettings().creditState.activityHistory).toHaveLength(2)
    expect(service.getSettings().creditState.activityHistory[0].type).toBe('manual_decrease')
    expect(service.getSettings().creditState.activityHistory[1].type).toBe('manual_increase')
  })

  it('allows credit saves when existing upload directories are stale but not being updated', async () => {
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

    store.set('userSettings', {
      globalUploadDirectory: 'Z:/stale-global-folder',
      uploadDirectories: {
        'single-image': 'Z:/missing-folder',
        'single-design': 'D:/keep-this-folder',
        'series-design': '',
        'series-generate': ''
      },
      creditState: {
        totalPurchasedCredits: 500,
        remainingCredits: 300
      }
    })

    await expect(service.saveSettings({
      creditAdjustment: {
        operation: 'increase',
        amount: 100
      }
    }, {
      isDirectory: () => false,
      getNow: () => '2026-05-01T10:00:00.000Z'
    })).resolves.toBeTruthy()

    await expect(service.saveSettings({
      creditState: {
        totalPurchasedCredits: 1000
      }
    }, {
      isDirectory: () => false
    })).resolves.toBeTruthy()

    expect(service.getSettings()).toMatchObject({
      globalUploadDirectory: 'Z:/stale-global-folder',
      uploadDirectories: {
        'single-image': 'Z:/missing-folder',
        'single-design': 'D:/keep-this-folder',
        'series-design': '',
        'series-generate': ''
      },
      creditState: {
        totalPurchasedCredits: 1000,
        remainingCredits: 400
      }
    })
  })

  it('updates only the provided upload directory keys without clearing sibling directories', async () => {
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
      uploadDirectories: {
        'single-image': 'D:/Input/SingleImage',
        'single-design': 'D:/Input/SingleDesign'
      }
    }, {
      isDirectory: (targetPath) => targetPath.startsWith('D:/Input/')
    })

    await service.saveSettings({
      uploadDirectories: {
        'series-design': 'D:/Input/SeriesDesign'
      }
    }, {
      isDirectory: (targetPath) => targetPath.startsWith('D:/Input/')
    })

    expect(service.getSettings().uploadDirectories).toMatchObject({
      'single-image': 'D:/Input/SingleImage',
      'single-design': 'D:/Input/SingleDesign',
      'series-design': 'D:/Input/SeriesDesign',
      'series-generate': ''
    })
  })
})
