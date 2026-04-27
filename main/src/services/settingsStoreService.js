const SETTINGS_KEY = 'userSettings'
const API_KEY_SLOT_COUNT = 2

const defaultSettings = {
  apiBaseUrl: 'https://grsai.dakka.com.cn',
  apiKeys: ['', ''],
  activeApiKeyIndex: 0,
  apiKey: '',
  defaultSize: '1:1',
  downloadDirectory: '',
  themeMode: 'dark'
}

function normalizeApiKeys(apiKeys = []) {
  const normalizedApiKeys = Array.from({ length: API_KEY_SLOT_COUNT }, (_unused, index) => {
    const value = Array.isArray(apiKeys) ? apiKeys[index] : ''
    return typeof value === 'string' ? value : ''
  })

  return normalizedApiKeys
}

function normalizeActiveApiKeyIndex(activeApiKeyIndex = 0) {
  const numericIndex = Number(activeApiKeyIndex)

  if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= API_KEY_SLOT_COUNT) {
    return 0
  }

  return numericIndex
}

function normalizeSettings(rawSettings = {}) {
  const mergedSettings = {
    ...defaultSettings,
    ...rawSettings
  }
  const activeApiKeyIndex = normalizeActiveApiKeyIndex(mergedSettings.activeApiKeyIndex)
  const apiKeys = normalizeApiKeys(mergedSettings.apiKeys)

  if ((!rawSettings.apiKeys || !rawSettings.apiKeys.length) && typeof rawSettings.apiKey === 'string') {
    apiKeys[activeApiKeyIndex] = rawSettings.apiKey
  }

  return {
    ...mergedSettings,
    apiKeys,
    activeApiKeyIndex,
    apiKey: apiKeys[activeApiKeyIndex] || ''
  }
}

function createSettingsStoreService ({ store }) {
  function getSettings () {
    return normalizeSettings(store.get(SETTINGS_KEY, {}))
  }

  async function saveSettings (payload = {}) {
    const currentSettings = getSettings()
    const activeApiKeyIndex = Object.prototype.hasOwnProperty.call(payload, 'activeApiKeyIndex')
      ? normalizeActiveApiKeyIndex(payload.activeApiKeyIndex)
      : currentSettings.activeApiKeyIndex
    const apiKeys = Object.prototype.hasOwnProperty.call(payload, 'apiKeys')
      ? normalizeApiKeys(payload.apiKeys)
      : normalizeApiKeys(currentSettings.apiKeys)

    if (typeof payload.apiKey === 'string') {
      apiKeys[activeApiKeyIndex] = payload.apiKey
    }

    const nextSettings = normalizeSettings({
      ...currentSettings,
      ...payload,
      apiKeys,
      activeApiKeyIndex
    })

    store.set(SETTINGS_KEY, nextSettings)
    return nextSettings
  }

  return {
    getSettings,
    saveSettings
  }
}

module.exports = {
  createSettingsStoreService,
  defaultSettings
}
