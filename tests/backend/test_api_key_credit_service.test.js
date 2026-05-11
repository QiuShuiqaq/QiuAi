import { describe, expect, it, vi } from 'vitest'

describe('apiKeyCreditService', () => {
  it('queries the documented credits endpoint and returns sanitized balance data', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        code: 0,
        data: {
          credits: 10000
        },
        msg: 'success'
      }
    })
    const createHttpClientServiceDependency = vi.fn(() => ({
      post
    }))
    const settingsService = {
      getSettings: () => ({
        apiBaseUrl: 'https://grsai.dakka.com.cn',
        apiKeys: ['sk-live-1', ''],
        activeApiKeyIndex: 0,
        apiKey: 'sk-live-1'
      })
    }

    const { createApiKeyCreditService, API_KEY_CREDITS_PATH } = await import('../../main/src/services/apiKeyCreditService.js')
    const service = createApiKeyCreditService({
      settingsService,
      createHttpClientServiceDependency,
      getNow: () => '2026-05-11T09:00:00.000Z'
    })

    const result = await service.getRealtimeCredits()

    expect(createHttpClientServiceDependency).toHaveBeenCalledWith(expect.objectContaining({
      apiBaseUrl: 'https://grsai.dakka.com.cn',
      apiKey: 'sk-live-1'
    }))
    expect(post).toHaveBeenCalledWith(API_KEY_CREDITS_PATH, {
      apiKey: 'sk-live-1'
    })
    expect(result).toEqual({
      remainingCredits: 10000,
      lastSyncedAt: '2026-05-11T09:00:00.000Z',
      syncStatus: 'success'
    })
  })

  it('keeps the last successful credits as stale data when a later query fails', async () => {
    const post = vi.fn()
      .mockResolvedValueOnce({
        data: {
          code: 0,
          data: {
            credits: 4321
          },
          msg: 'success'
        }
      })
      .mockRejectedValueOnce(new Error('network failed'))
    const createHttpClientServiceDependency = vi.fn(() => ({
      post
    }))
    const settingsService = {
      getSettings: () => ({
        apiBaseUrl: 'https://grsai.dakka.com.cn',
        apiKeys: ['sk-live-2', ''],
        activeApiKeyIndex: 0,
        apiKey: 'sk-live-2'
      })
    }

    const { createApiKeyCreditService } = await import('../../main/src/services/apiKeyCreditService.js')
    const service = createApiKeyCreditService({
      settingsService,
      createHttpClientServiceDependency,
      getNow: () => '2026-05-11T09:30:00.000Z'
    })

    const firstResult = await service.getRealtimeCredits()
    const secondResult = await service.getRealtimeCredits()

    expect(firstResult).toEqual({
      remainingCredits: 4321,
      lastSyncedAt: '2026-05-11T09:30:00.000Z',
      syncStatus: 'success'
    })
    expect(secondResult).toEqual({
      remainingCredits: 4321,
      lastSyncedAt: '2026-05-11T09:30:00.000Z',
      syncStatus: 'stale'
    })
  })
})
