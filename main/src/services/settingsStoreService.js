const fs = require('node:fs')

const SETTINGS_KEY = 'userSettings'
const API_KEY_SLOT_COUNT = 2

const defaultSettings = {
  apiBaseUrl: 'https://grsai.dakka.com.cn',
  apiKeys: ['', ''],
  activeApiKeyIndex: 0,
  apiKey: '',
  defaultSize: '1:1',
  downloadDirectory: '',
  globalUploadDirectory: '',
  uploadDirectories: {
    'single-image': '',
    'single-design': '',
    'series-design': '',
    'series-generate': ''
  },
  themeMode: 'dark'
}

function normalizeThemeMode() {
  return 'dark'
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

function normalizeUploadDirectories(uploadDirectories = {}) {
  const source = uploadDirectories && typeof uploadDirectories === 'object' ? uploadDirectories : {}

  return {
    'single-image': typeof source['single-image'] === 'string' ? source['single-image'] : '',
    'single-design': typeof source['single-design'] === 'string' ? source['single-design'] : '',
    'series-design': typeof source['series-design'] === 'string' ? source['series-design'] : '',
    'series-generate': typeof source['series-generate'] === 'string' ? source['series-generate'] : ''
  }
}

function normalizeGlobalUploadDirectory(globalUploadDirectory = '') {
  return typeof globalUploadDirectory === 'string' ? globalUploadDirectory : ''
}

function defaultIsDirectory(targetPath = '') {
  try {
    return fs.statSync(targetPath).isDirectory()
  } catch {
    return false
  }
}

function validateUploadDirectories(uploadDirectories = {}, { isDirectory = defaultIsDirectory } = {}) {
  for (const directoryPath of Object.values(normalizeUploadDirectories(uploadDirectories))) {
    if (!directoryPath) {
      continue
    }

    if (!isDirectory(directoryPath)) {
      throw new Error('默认上传目录不存在或不是文件夹')
    }
  }
}

function validateGlobalUploadDirectory(globalUploadDirectory = '', { isDirectory = defaultIsDirectory } = {}) {
  const normalizedPath = normalizeGlobalUploadDirectory(globalUploadDirectory)
  if (!normalizedPath) {
    return
  }

  if (!isDirectory(normalizedPath)) {
    throw new Error('默认上传目录不存在或不是文件夹')
  }
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
    themeMode: normalizeThemeMode(mergedSettings.themeMode),
    globalUploadDirectory: normalizeGlobalUploadDirectory(mergedSettings.globalUploadDirectory),
    uploadDirectories: normalizeUploadDirectories(mergedSettings.uploadDirectories),
    apiKeys,
    activeApiKeyIndex,
    apiKey: apiKeys[activeApiKeyIndex] || ''
  }
}

function createSettingsStoreService ({ store }) {
  function getSettings () {
    return normalizeSettings(store.get(SETTINGS_KEY, {}))
  }

  async function saveSettings (payload = {}, options = {}) {
    const currentSettings = getSettings()
    const activeApiKeyIndex = Object.prototype.hasOwnProperty.call(payload, 'activeApiKeyIndex')
      ? normalizeActiveApiKeyIndex(payload.activeApiKeyIndex)
      : currentSettings.activeApiKeyIndex
    const apiKeys = Object.prototype.hasOwnProperty.call(payload, 'apiKeys')
      ? normalizeApiKeys(payload.apiKeys)
      : normalizeApiKeys(currentSettings.apiKeys)
    const uploadDirectories = {
      ...normalizeUploadDirectories(currentSettings.uploadDirectories),
      ...normalizeUploadDirectories(payload.uploadDirectories)
    }
    const globalUploadDirectory = Object.prototype.hasOwnProperty.call(payload, 'globalUploadDirectory')
      ? normalizeGlobalUploadDirectory(payload.globalUploadDirectory)
      : normalizeGlobalUploadDirectory(currentSettings.globalUploadDirectory)

    if (typeof payload.apiKey === 'string') {
      apiKeys[activeApiKeyIndex] = payload.apiKey
    }

    validateUploadDirectories(uploadDirectories, options)
    validateGlobalUploadDirectory(globalUploadDirectory, options)

    const nextSettings = normalizeSettings({
      ...currentSettings,
      ...payload,
      globalUploadDirectory,
      uploadDirectories,
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
