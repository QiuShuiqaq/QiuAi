const API_KEY_SLOT_COUNT = 2
const BROWSER_SETTINGS_KEY = 'qiuai-browser-settings'
const BROWSER_STUDIO_KEY = 'qiuai-browser-studio'
const BROWSER_PROMPTS_KEY = 'qiuai-browser-prompts'

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

const defaultBrowserPromptTemplates = [
  {
    id: 'product-main',
    name: '商品主图',
    category: '按钮提示词',
    prompt: '按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。',
    source: 'system-fixed'
  },
  {
    id: 'product-detail',
    name: '详情图',
    category: '按钮提示词',
    prompt: '按详情图生成：输出产品详细说明图，强调卖点信息、使用说明、功能结构或场景说明；禁止仅做主视觉海报。',
    source: 'system-fixed'
  },
  {
    id: 'product-closeup',
    name: '细节图',
    category: '按钮提示词',
    prompt: '按细节图生成：输出产品局部放大图，重点展示材质、做工、纹理或关键细节；禁止生成整套场景主视觉。',
    source: 'system-fixed'
  },
  {
    id: 'product-size',
    name: '尺寸图',
    category: '按钮提示词',
    prompt: '按尺寸图生成：输出带尺寸标注的说明图，清晰表达长宽高或关键规格；禁止省略尺寸信息。',
    source: 'system-fixed'
  },
  {
    id: 'product-whitebg',
    name: '白底图',
    category: '按钮提示词',
    prompt: '按白底图生成：输出纯白背景电商图，主体完整清晰、边缘干净；禁止加入场景背景和复杂装饰。',
    source: 'system-fixed'
  },
  {
    id: 'product-color',
    name: '颜色图',
    category: '按钮提示词',
    prompt: '按颜色图生成：输出产品颜色变化效果图，保持产品结构一致，仅突出颜色差异；禁止改变主体款式。',
    source: 'system-fixed'
  }
]

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

function getBrowserPromptTemplates() {
  return readBrowserState(BROWSER_PROMPTS_KEY, defaultBrowserPromptTemplates)
}

function saveBrowserPromptTemplate(payload = {}) {
  const currentTemplates = getBrowserPromptTemplates()
  const existingTemplate = currentTemplates.find((item) => item.id === payload.id)
  const nextTemplate = {
    id: existingTemplate?.source === 'system-fixed'
      ? existingTemplate.id
      : (payload.id || `browser-template-${Date.now()}`),
    name: payload.name || existingTemplate?.name || '',
    category: payload.category || existingTemplate?.category || '',
    prompt: payload.prompt || '',
    source: existingTemplate?.source === 'system-fixed' ? 'system-fixed' : 'custom'
  }
  const nextTemplates = [
    ...currentTemplates.filter((item) => item.id !== nextTemplate.id),
    nextTemplate
  ]
  writeBrowserState(BROWSER_PROMPTS_KEY, nextTemplates)
  return nextTemplate
}

function removeBrowserPromptTemplate(payload = {}) {
  const currentTemplates = getBrowserPromptTemplates()
  const targetTemplate = currentTemplates.find((item) => item.id === payload.id)
  if (targetTemplate?.source === 'system-fixed') {
    return { ok: true }
  }
  writeBrowserState(BROWSER_PROMPTS_KEY, currentTemplates.filter((item) => item.id !== payload.id))
  return { ok: true }
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
  if (!hasBridge()) {
    return Promise.resolve(getBrowserPromptTemplates())
  }
  return invoke(getChannel('PROMPTS_LIST'))
}

export function savePromptTemplate (payload) {
  if (!hasBridge()) {
    return Promise.resolve(saveBrowserPromptTemplate(payload))
  }
  return invoke(getChannel('PROMPTS_SAVE'), payload)
}

export function removePromptTemplate (payload) {
  if (!hasBridge()) {
    return Promise.resolve(removeBrowserPromptTemplate(payload))
  }
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
