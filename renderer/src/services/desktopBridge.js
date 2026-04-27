const API_KEY_SLOT_COUNT = 2
const BROWSER_SETTINGS_KEY = 'qiuai-browser-settings'
const BROWSER_STUDIO_KEY = 'qiuai-browser-studio'

const defaultBrowserSettings = {
  apiBaseUrl: 'https://grsai.dakka.com.cn',
  apiKeys: ['', ''],
  activeApiKeyIndex: 0,
  apiKey: '',
  defaultSize: '1:1',
  downloadDirectory: '',
  themeMode: 'dark'
}

const defaultBrowserStudioSnapshot = {
  themeMode: 'dark',
  formDrafts: {},
  resultsByMenu: {},
  exportItemsByMenu: {},
  tasks: [],
  workspaceDashboard: {},
  hostInfo: {},
  settingsSummary: {
    apiKeys: ['', ''],
    activeApiKeyIndex: 0
  }
}

function getBridge () {
  return window.qiuai
}

function hasBridge () {
  const bridge = getBridge()
  return !!(bridge && bridge.channels && typeof bridge.invoke === 'function')
}

function getLocalStorage () {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  return window.localStorage
}

function readBrowserState (storageKey, fallbackValue) {
  const storage = getLocalStorage()
  if (!storage) {
    return fallbackValue
  }

  try {
    const rawValue = storage.getItem(storageKey)
    return rawValue ? JSON.parse(rawValue) : fallbackValue
  } catch {
    return fallbackValue
  }
}

function writeBrowserState (storageKey, value) {
  const storage = getLocalStorage()
  if (!storage) {
    return value
  }

  storage.setItem(storageKey, JSON.stringify(value))
  return value
}

function normalizeForIpc (value) {
  if (value === undefined) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value))
}

function normalizeApiKeys (apiKeys = []) {
  return Array.from({ length: API_KEY_SLOT_COUNT }, (_unused, index) => {
    return typeof apiKeys[index] === 'string' ? apiKeys[index] : ''
  })
}

function normalizeActiveApiKeyIndex (activeApiKeyIndex = 0) {
  const numericIndex = Number(activeApiKeyIndex)

  if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= API_KEY_SLOT_COUNT) {
    return 0
  }

  return numericIndex
}

function normalizeBrowserSettings (rawSettings = {}) {
  const mergedSettings = {
    ...defaultBrowserSettings,
    ...rawSettings
  }
  const activeApiKeyIndex = normalizeActiveApiKeyIndex(mergedSettings.activeApiKeyIndex)
  const apiKeys = normalizeApiKeys(mergedSettings.apiKeys)

  if (typeof rawSettings.apiKey === 'string' && !rawSettings.apiKeys) {
    apiKeys[activeApiKeyIndex] = rawSettings.apiKey
  }

  return {
    ...mergedSettings,
    apiKeys,
    activeApiKeyIndex,
    apiKey: apiKeys[activeApiKeyIndex] || ''
  }
}

function getBrowserSettings () {
  return normalizeBrowserSettings(readBrowserState(BROWSER_SETTINGS_KEY, defaultBrowserSettings))
}

function saveBrowserSettings (payload = {}) {
  const currentSettings = getBrowserSettings()
  const activeApiKeyIndex = Object.prototype.hasOwnProperty.call(payload, 'activeApiKeyIndex')
    ? normalizeActiveApiKeyIndex(payload.activeApiKeyIndex)
    : currentSettings.activeApiKeyIndex
  const apiKeys = Object.prototype.hasOwnProperty.call(payload, 'apiKeys')
    ? normalizeApiKeys(payload.apiKeys)
    : normalizeApiKeys(currentSettings.apiKeys)

  if (typeof payload.apiKey === 'string') {
    apiKeys[activeApiKeyIndex] = payload.apiKey
  }

  const nextSettings = normalizeBrowserSettings({
    ...currentSettings,
    ...payload,
    activeApiKeyIndex,
    apiKeys
  })

  return writeBrowserState(BROWSER_SETTINGS_KEY, nextSettings)
}

function getBrowserStudioSnapshot () {
  const savedSnapshot = readBrowserState(BROWSER_STUDIO_KEY, defaultBrowserStudioSnapshot)
  const settings = getBrowserSettings()

  return {
    ...defaultBrowserStudioSnapshot,
    ...savedSnapshot,
    themeMode: settings.themeMode || savedSnapshot.themeMode || 'dark',
    settingsSummary: {
      apiKeys: settings.apiKeys,
      activeApiKeyIndex: settings.activeApiKeyIndex
    }
  }
}

function saveBrowserStudioDraft (payload = {}) {
  const snapshot = getBrowserStudioSnapshot()
  const menuKey = payload.menuKey || 'workspace'
  const patch = payload.patch || {}
  const nextSnapshot = {
    ...snapshot,
    formDrafts: {
      ...(snapshot.formDrafts || {}),
      [menuKey]: {
        ...((snapshot.formDrafts || {})[menuKey] || {}),
        ...patch
      }
    }
  }

  writeBrowserState(BROWSER_STUDIO_KEY, nextSnapshot)
  return nextSnapshot.formDrafts[menuKey]
}

function getChannel (channelName) {
  const bridge = getBridge()

  if (!bridge || !bridge.channels) {
    throw new Error('QiuAi desktop bridge is unavailable.')
  }

  return bridge.channels[channelName]
}

function invoke (channel, payload) {
  const bridge = getBridge()

  if (!bridge || typeof bridge.invoke !== 'function') {
    throw new Error('QiuAi desktop bridge is unavailable.')
  }

  return bridge.invoke(channel, normalizeForIpc(payload))
}

export function getSettings () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserSettings())
  }

  return invoke(getChannel('SETTINGS_GET'))
}

export function saveSettings (payload) {
  if (!hasBridge()) {
    return Promise.resolve(saveBrowserSettings(payload))
  }

  return invoke(getChannel('SETTINGS_SAVE'), payload)
}

export function createTask (payload) {
  return invoke(getChannel('DRAW_CREATE_TASK'), payload)
}

export function getTaskResult (payload) {
  return invoke(getChannel('DRAW_GET_RESULT'), payload)
}

export function downloadImage (payload) {
  return invoke(getChannel('DRAW_DOWNLOAD_IMAGE'), payload)
}

export function pickInputFolder () {
  return invoke(getChannel('INPUT_PICK_FOLDER'))
}

export function pickInputFile () {
  return invoke(getChannel('INPUT_PICK_FILE'))
}

export function listPromptTemplates () {
  return invoke(getChannel('PROMPTS_LIST'))
}

export function savePromptTemplate (payload) {
  return invoke(getChannel('PROMPTS_SAVE'), payload)
}

export function removePromptTemplate (payload) {
  return invoke(getChannel('PROMPTS_REMOVE'), payload)
}

export function createLocalTask (payload) {
  return invoke(getChannel('TASKS_CREATE_LOCAL'), payload)
}

export function listLocalTasks () {
  return invoke(getChannel('TASKS_LIST'))
}

export function getLocalTask (payload) {
  return invoke(getChannel('TASKS_GET'), payload)
}

export function runLocalTask (payload) {
  return invoke(getChannel('TASKS_RUN'), payload)
}

export function exportLocalTask (payload) {
  return invoke(getChannel('TASKS_EXPORT'), payload)
}

export function getStudioSnapshot () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserStudioSnapshot())
  }

  return invoke(getChannel('STUDIO_GET_SNAPSHOT'))
}

export function saveStudioDraft (payload) {
  if (!hasBridge()) {
    return Promise.resolve(saveBrowserStudioDraft(payload))
  }

  return invoke(getChannel('STUDIO_SAVE_DRAFT'), payload)
}

export function createStudioTask (payload) {
  return invoke(getChannel('STUDIO_CREATE_TASK'), payload)
}

export function openOutputDirectory (payload) {
  return invoke(getChannel('STUDIO_OPEN_OUTPUT_DIRECTORY'), payload)
}

export function exportStudioResults (payload) {
  return invoke(getChannel('STUDIO_EXPORT_RESULTS'), payload)
}

export function deleteStudioExportItem (payload) {
  return invoke(getChannel('STUDIO_DELETE_EXPORT_ITEM'), payload)
}
