const { createHttpClientService } = require('./httpClientService')

const API_KEY_CREDITS_PATH = '/client/openapi/getAPIKeyCredits'

function resolveApiKey(settings = {}) {
  if (typeof settings.apiKey === 'string' && settings.apiKey.trim()) {
    return settings.apiKey.trim()
  }

  const activeIndex = Number.isInteger(settings.activeApiKeyIndex) ? settings.activeApiKeyIndex : 0
  const apiKey = Array.isArray(settings.apiKeys) ? settings.apiKeys[activeIndex] : ''
  return typeof apiKey === 'string' ? apiKey.trim() : ''
}

function normalizeRemainingCredits(value = 0) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.round(numericValue)
}

function createApiKeyCreditService({
  settingsService,
  messageRecorder,
  requestMetricRecorder,
  createHttpClientServiceDependency = createHttpClientService,
  getNow = () => new Date().toISOString()
}) {
  let lastSuccessfulSnapshot = null

  async function getRealtimeCredits() {
    const settings = settingsService.getSettings()
    const apiKey = resolveApiKey(settings)

    if (!apiKey) {
      return lastSuccessfulSnapshot
        ? {
            ...lastSuccessfulSnapshot,
            syncStatus: 'stale'
          }
        : null
    }

    try {
      const httpClient = createHttpClientServiceDependency({
        apiBaseUrl: settings.apiBaseUrl,
        apiKey,
        messageRecorder,
        requestMetricRecorder
      })
      const response = await httpClient.post(API_KEY_CREDITS_PATH, {
        apiKey
      })
      const responseData = response?.data || {}

      if (responseData.code !== 0 || !responseData.data || typeof responseData.data.credits === 'undefined') {
        throw new Error(responseData.msg || '积分查询失败')
      }

      lastSuccessfulSnapshot = {
        remainingCredits: normalizeRemainingCredits(responseData.data.credits),
        lastSyncedAt: getNow(),
        syncStatus: 'success'
      }

      return lastSuccessfulSnapshot
    } catch (_error) {
      return lastSuccessfulSnapshot
        ? {
            ...lastSuccessfulSnapshot,
            syncStatus: 'stale'
          }
        : null
    }
  }

  return {
    getRealtimeCredits
  }
}

module.exports = {
  createApiKeyCreditService,
  API_KEY_CREDITS_PATH
}
