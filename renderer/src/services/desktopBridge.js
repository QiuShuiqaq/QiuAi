const API_KEY_SLOT_COUNT = 2
const BROWSER_SETTINGS_KEY = 'qiuai-browser-settings'
const BROWSER_STUDIO_KEY = 'qiuai-browser-studio'
const BROWSER_PROMPTS_KEY = 'qiuai-browser-prompts'
const BROWSER_NEGATIVE_PROMPTS_KEY = 'qiuai-browser-negative-prompts'
const BROWSER_CREDIT_HISTORY_LIMIT = 20

const defaultBrowserCreditState = {
  totalPurchasedCredits: 0,
  remainingCredits: 0,
  frozenCredits: 0,
  usedCredits: 0,
  lastAdjustmentAt: '',
  lastAdjustmentOperation: '',
  lastAdjustmentAmount: 0,
  adjustmentHistory: [],
  taskLedger: {}
}

const defaultBrowserDashboardCreditState = {
  totalCredits: 0,
  remainingCredits: 0
}

const defaultBrowserSettings = {
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
  themeMode: 'dark',
  downloadCleanupEnabled: true,
  dashboardCreditState: defaultBrowserDashboardCreditState,
  creditState: defaultBrowserCreditState
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
    activeApiKeyIndex: 0,
    creditState: defaultBrowserCreditState
  }
}

const defaultBrowserActivationState = {
  status: 'activated',
  customerName: '浏览器模式',
  deviceCode: 'QAI-BROWSER-MODE',
  activatedAt: '',
  message: ''
}

const defaultBrowserPromptTemplates = [
  {
    id: 'system-empty-image-type',
    name: '无类型图片',
    category: '按钮提示词',
    prompt: '',
    source: 'system-fixed'
  },
  {
    id: 'product-main',
    name: '商品主图',
    category: '按钮提示词',
    prompt: '电商商品主图，主体为XXX，主体完整清晰，突出XXX本身与核心卖点，构图简洁，光线干净，质感自然，适合首页展示',
    source: 'system-fixed'
  },
  {
    id: 'product-detail',
    name: '详情图',
    category: '按钮提示词',
    prompt: '电商商品详情图，主体为XXX，清晰展示XXX的功能卖点、使用方式或核心信息，画面层次明确，信息表达直观，适合详情页展示',
    source: 'system-fixed'
  },
  {
    id: 'product-closeup',
    name: '细节图',
    category: '按钮提示词',
    prompt: '电商商品细节图，主体为XXX，聚焦XXX的材质、纹理、做工或关键结构，局部清晰放大，质感真实，细节明确',
    source: 'system-fixed'
  },
  {
    id: 'product-size',
    name: '尺寸图',
    category: '按钮提示词',
    prompt: '电商商品尺寸图，主体为XXX，清晰展示XXX的尺寸、规格或结构比例，信息明确易读，画面整洁，适合详情页说明',
    source: 'system-fixed'
  },
  {
    id: 'product-whitebg',
    name: '白底图',
    category: '按钮提示词',
    prompt: '电商商品白底图，主体为XXX，纯白背景，主体完整清晰，边缘干净，颜色准确，适合平台主图或抠图展示',
    source: 'system-fixed'
  },
  {
    id: 'product-color',
    name: '颜色图',
    category: '按钮提示词',
    prompt: '电商商品颜色图，主体为XXX，保持XXX的结构与款式一致，只展示颜色或配色变化，画面统一，便于颜色对比',
    source: 'system-fixed'
  }
]

const defaultBrowserNegativePromptTemplates = [
  {
    id: 'system-empty-negative-prompt',
    name: '无负向提示词',
    category: '反向提示词',
    prompt: '',
    source: 'system-fixed'
  },
  {
    id: 'negative-common',
    name: '电商通用',
    category: '反向提示词',
    prompt: '水印，logo，文字，广告标，多余贴纸，杂乱背景，多余人物，画面变形，产品扭曲，边缘模糊，低清晰度，噪点，拼接痕迹，阴影错乱，明显反光，裁切不全',
    source: 'system-fixed'
  },
  {
    id: 'negative-model',
    name: '电商模特',
    category: '反向提示词',
    prompt: '比例失衡，五官异常，手指错误，肢体变形，姿态僵硬，服装褶皱异常，妆容怪异，背景路人，滤镜过重，肤色异常',
    source: 'system-fixed'
  },
  {
    id: 'negative-still-life',
    name: '电商静物',
    category: '反向提示词',
    prompt: '产品变形，材质失真，脏污灰尘，划痕破损，颜色偏差，反光刺眼，倒影错乱，摆件杂乱，背景花哨，焦点不准，廉价塑料感',
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

function normalizeThemeMode () {
  return 'dark'
}

function normalizeDownloadCleanupEnabled (downloadCleanupEnabled = true) {
  return downloadCleanupEnabled !== false
}

function normalizeUploadDirectories (uploadDirectories = {}) {
  const source = uploadDirectories && typeof uploadDirectories === 'object' ? uploadDirectories : {}

  return {
    'single-image': typeof source['single-image'] === 'string' ? source['single-image'] : '',
    'single-design': typeof source['single-design'] === 'string' ? source['single-design'] : '',
    'series-design': typeof source['series-design'] === 'string' ? source['series-design'] : '',
    'series-generate': typeof source['series-generate'] === 'string' ? source['series-generate'] : ''
  }
}

function normalizeGlobalUploadDirectory (globalUploadDirectory = '') {
  return typeof globalUploadDirectory === 'string' ? globalUploadDirectory : ''
}

function normalizeNonNegativeInteger (value = 0) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.round(numericValue)
}

function normalizeBrowserCreditState (rawCreditState = {}) {
  const source = rawCreditState && typeof rawCreditState === 'object' ? rawCreditState : {}

  return {
    totalPurchasedCredits: normalizeNonNegativeInteger(source.totalPurchasedCredits),
    remainingCredits: normalizeNonNegativeInteger(source.remainingCredits),
    frozenCredits: normalizeNonNegativeInteger(source.frozenCredits),
    usedCredits: normalizeNonNegativeInteger(source.usedCredits),
    lastAdjustmentAt: typeof source.lastAdjustmentAt === 'string' ? source.lastAdjustmentAt : '',
    lastAdjustmentOperation: typeof source.lastAdjustmentOperation === 'string' ? source.lastAdjustmentOperation : '',
    lastAdjustmentAmount: normalizeNonNegativeInteger(source.lastAdjustmentAmount),
    adjustmentHistory: Array.isArray(source.adjustmentHistory)
      ? source.adjustmentHistory.slice(0, BROWSER_CREDIT_HISTORY_LIMIT)
      : [],
    taskLedger: source.taskLedger && typeof source.taskLedger === 'object' ? { ...source.taskLedger } : {}
  }
}

function normalizeBrowserDashboardCreditState (rawDashboardCreditState = {}) {
  const source = rawDashboardCreditState && typeof rawDashboardCreditState === 'object' ? rawDashboardCreditState : {}

  return {
    totalCredits: normalizeNonNegativeInteger(source.totalCredits),
    remainingCredits: normalizeNonNegativeInteger(source.remainingCredits)
  }
}

function applyBrowserCreditAdjustment (creditState, adjustment = {}) {
  const normalizedCreditState = normalizeBrowserCreditState(creditState)
  const amount = normalizeNonNegativeInteger(adjustment.amount)

  if (!amount) {
    return normalizedCreditState
  }

  const operation = adjustment.operation === 'decrease' ? 'decrease' : 'increase'
  if (operation === 'decrease' && normalizedCreditState.remainingCredits < amount) {
    throw new Error('可用积分不足，无法扣减')
  }

  const createdAt = new Date().toISOString()

  return normalizeBrowserCreditState({
    ...normalizedCreditState,
    totalPurchasedCredits: operation === 'increase'
      ? normalizedCreditState.totalPurchasedCredits + amount
      : normalizedCreditState.totalPurchasedCredits,
    remainingCredits: operation === 'increase'
      ? normalizedCreditState.remainingCredits + amount
      : normalizedCreditState.remainingCredits - amount,
    lastAdjustmentAt: createdAt,
    lastAdjustmentOperation: operation,
    lastAdjustmentAmount: amount,
    adjustmentHistory: [
      {
        id: `browser-credit-adjustment-${createdAt}-${operation}`,
        operation,
        amount,
        createdAt
      },
      ...normalizedCreditState.adjustmentHistory
    ].slice(0, BROWSER_CREDIT_HISTORY_LIMIT)
  })
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
    themeMode: normalizeThemeMode(mergedSettings.themeMode),
    downloadCleanupEnabled: normalizeDownloadCleanupEnabled(mergedSettings.downloadCleanupEnabled),
    globalUploadDirectory: normalizeGlobalUploadDirectory(mergedSettings.globalUploadDirectory),
    uploadDirectories: normalizeUploadDirectories(mergedSettings.uploadDirectories),
    dashboardCreditState: normalizeBrowserDashboardCreditState(mergedSettings.dashboardCreditState),
    creditState: normalizeBrowserCreditState(mergedSettings.creditState),
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
  const {
    creditAdjustment,
    ...restPayload
  } = payload || {}
  const activeApiKeyIndex = Object.prototype.hasOwnProperty.call(payload, 'activeApiKeyIndex')
    ? normalizeActiveApiKeyIndex(payload.activeApiKeyIndex)
    : currentSettings.activeApiKeyIndex
  const apiKeys = Object.prototype.hasOwnProperty.call(payload, 'apiKeys')
    ? normalizeApiKeys(payload.apiKeys)
    : normalizeApiKeys(currentSettings.apiKeys)

  if (typeof payload.apiKey === 'string') {
    apiKeys[activeApiKeyIndex] = payload.apiKey
  }

  let creditState = Object.prototype.hasOwnProperty.call(restPayload, 'creditState')
    ? normalizeBrowserCreditState({
        ...currentSettings.creditState,
        ...restPayload.creditState
      })
    : normalizeBrowserCreditState(currentSettings.creditState)

  if (creditAdjustment && typeof creditAdjustment === 'object') {
    creditState = applyBrowserCreditAdjustment(creditState, creditAdjustment)
  }

  const nextSettings = normalizeBrowserSettings({
    ...currentSettings,
    ...restPayload,
    globalUploadDirectory: Object.prototype.hasOwnProperty.call(payload, 'globalUploadDirectory')
      ? normalizeGlobalUploadDirectory(payload.globalUploadDirectory)
      : normalizeGlobalUploadDirectory(currentSettings.globalUploadDirectory),
    uploadDirectories: {
      ...normalizeUploadDirectories(currentSettings.uploadDirectories),
      ...normalizeUploadDirectories(payload.uploadDirectories)
    },
    activeApiKeyIndex,
    apiKeys,
    creditState
  })

  return writeBrowserState(BROWSER_SETTINGS_KEY, nextSettings)
}

function getBrowserStudioSnapshot () {
  const savedSnapshot = readBrowserState(BROWSER_STUDIO_KEY, defaultBrowserStudioSnapshot)
  const settings = getBrowserSettings()

  return {
    ...defaultBrowserStudioSnapshot,
    ...savedSnapshot,
    themeMode: normalizeThemeMode(settings.themeMode || savedSnapshot.themeMode || 'dark'),
    settingsSummary: {
      apiKeys: settings.apiKeys,
      activeApiKeyIndex: settings.activeApiKeyIndex,
      creditState: settings.creditState
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

function clearBrowserStudioRuntimeState () {
  const snapshot = getBrowserStudioSnapshot()
  const nextSnapshot = {
    ...defaultBrowserStudioSnapshot,
    tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks : [],
    settingsSummary: snapshot.settingsSummary || defaultBrowserStudioSnapshot.settingsSummary,
    hostInfo: snapshot.hostInfo || defaultBrowserStudioSnapshot.hostInfo
  }

  writeBrowserState(BROWSER_STUDIO_KEY, nextSnapshot)
  return {
    cleared: true
  }
}

function getBrowserActivationState() {
  return {
    ...defaultBrowserActivationState
  }
}

function getBrowserPromptTemplates() {
  const storedTemplates = readBrowserState(BROWSER_PROMPTS_KEY, defaultBrowserPromptTemplates)
  const normalizedTemplates = mergeDefaultBrowserPromptTemplates(storedTemplates)
  writeBrowserState(BROWSER_PROMPTS_KEY, normalizedTemplates)
  return normalizedTemplates
}

function normalizeBrowserPromptTemplate(template = {}) {
  return {
    id: String(template.id || ''),
    name: String(template.name || '').trim(),
    category: String(template.category || '').trim(),
    prompt: String(template.prompt || '').trim(),
    source: template.source === 'system-fixed' ? 'system-fixed' : 'custom'
  }
}

function mergeDefaultBrowserPromptTemplates(templates = []) {
  const incomingTemplates = Array.isArray(templates)
    ? templates.map((template) => normalizeBrowserPromptTemplate(template))
    : []
  const incomingTemplateMap = new Map(incomingTemplates.filter((template) => template.id).map((template) => [template.id, template]))
  const customTemplates = incomingTemplates.filter((template) => {
    return template.id && !defaultBrowserPromptTemplates.find((item) => item.id === template.id)
  })

  return [
    ...defaultBrowserPromptTemplates.map((defaultTemplate) => {
      const matchedTemplate = incomingTemplateMap.get(defaultTemplate.id)
      return normalizeBrowserPromptTemplate({
        ...defaultTemplate,
        ...(matchedTemplate || {})
      })
    }),
    ...customTemplates
  ]
}

function normalizeBrowserNegativePromptTemplate(template = {}) {
  return {
    id: String(template.id || ''),
    name: String(template.name || '').trim(),
    category: String(template.category || '反向提示词').trim(),
    prompt: String(template.prompt || '').trim(),
    source: template.source === 'system-fixed' ? 'system-fixed' : 'custom'
  }
}

function mergeDefaultBrowserNegativePromptTemplates(templates = []) {
  const incomingTemplates = Array.isArray(templates)
    ? templates.map((template) => normalizeBrowserNegativePromptTemplate(template))
    : []
  const incomingTemplateMap = new Map(incomingTemplates.filter((template) => template.id).map((template) => [template.id, template]))
  const customTemplates = incomingTemplates.filter((template) => {
    return template.id && !defaultBrowserNegativePromptTemplates.find((item) => item.id === template.id)
  })

  return [
    ...defaultBrowserNegativePromptTemplates.map((defaultTemplate) => {
      const matchedTemplate = incomingTemplateMap.get(defaultTemplate.id)
      return normalizeBrowserNegativePromptTemplate({
        ...defaultTemplate,
        ...(matchedTemplate || {})
      })
    }),
    ...customTemplates
  ]
}

function getBrowserNegativePromptTemplates() {
  const storedTemplates = readBrowserState(BROWSER_NEGATIVE_PROMPTS_KEY, defaultBrowserNegativePromptTemplates)
  const normalizedTemplates = mergeDefaultBrowserNegativePromptTemplates(storedTemplates)
  writeBrowserState(BROWSER_NEGATIVE_PROMPTS_KEY, normalizedTemplates)
  return normalizedTemplates
}

function saveBrowserNegativePromptTemplate(payload = {}) {
  const currentTemplates = getBrowserNegativePromptTemplates()
  const existingTemplate = currentTemplates.find((item) => item.id === payload.id)
  const nextTemplate = normalizeBrowserNegativePromptTemplate({
    id: existingTemplate?.source === 'system-fixed'
      ? existingTemplate.id
      : (payload.id || `browser-negative-template-${Date.now()}`),
    name: payload.name || existingTemplate?.name || '',
    category: payload.category || existingTemplate?.category || '反向提示词',
    prompt: payload.prompt || '',
    source: existingTemplate?.source === 'system-fixed' ? 'system-fixed' : 'custom'
  })
  const nextTemplates = [
    ...currentTemplates.filter((item) => item.id !== nextTemplate.id),
    nextTemplate
  ]
  writeBrowserState(BROWSER_NEGATIVE_PROMPTS_KEY, mergeDefaultBrowserNegativePromptTemplates(nextTemplates))
  return nextTemplate
}

function removeBrowserNegativePromptTemplate(payload = {}) {
  const currentTemplates = getBrowserNegativePromptTemplates()
  const targetTemplate = currentTemplates.find((item) => item.id === payload.id)
  if (targetTemplate?.source === 'system-fixed') {
    return { ok: true }
  }
  writeBrowserState(
    BROWSER_NEGATIVE_PROMPTS_KEY,
    mergeDefaultBrowserNegativePromptTemplates(currentTemplates.filter((item) => item.id !== payload.id))
  )
  return { ok: true }
}

function saveBrowserPromptTemplate(payload = {}) {
  const currentTemplates = getBrowserPromptTemplates()
  const existingTemplate = currentTemplates.find((item) => item.id === payload.id)
  const nextTemplate = normalizeBrowserPromptTemplate({
    id: existingTemplate?.source === 'system-fixed'
      ? existingTemplate.id
      : (payload.id || `browser-template-${Date.now()}`),
    name: payload.name || existingTemplate?.name || '',
    category: payload.category || existingTemplate?.category || '',
    prompt: payload.prompt || '',
    source: existingTemplate?.source === 'system-fixed' ? 'system-fixed' : 'custom'
  })
  const nextTemplates = [
    ...currentTemplates.filter((item) => item.id !== nextTemplate.id),
    nextTemplate
  ]
  writeBrowserState(BROWSER_PROMPTS_KEY, mergeDefaultBrowserPromptTemplates(nextTemplates))
  return nextTemplate
}

function removeBrowserPromptTemplate(payload = {}) {
  const currentTemplates = getBrowserPromptTemplates()
  const targetTemplate = currentTemplates.find((item) => item.id === payload.id)
  if (targetTemplate?.source === 'system-fixed') {
    return { ok: true }
  }
  writeBrowserState(BROWSER_PROMPTS_KEY, mergeDefaultBrowserPromptTemplates(currentTemplates.filter((item) => item.id !== payload.id)))
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

export function saveAdminApiKey (payload) {
  return invoke(getChannel('SETTINGS_SAVE_ADMIN_API_KEY'), payload)
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

export function listNegativePromptTemplates () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserNegativePromptTemplates())
  }
  return invoke(getChannel('NEGATIVE_PROMPTS_LIST'))
}

export function saveNegativePromptTemplate (payload) {
  if (!hasBridge()) {
    return Promise.resolve(saveBrowserNegativePromptTemplate(payload))
  }
  return invoke(getChannel('NEGATIVE_PROMPTS_SAVE'), payload)
}

export function removeNegativePromptTemplate (payload) {
  if (!hasBridge()) {
    return Promise.resolve(removeBrowserNegativePromptTemplate(payload))
  }
  return invoke(getChannel('NEGATIVE_PROMPTS_REMOVE'), payload)
}

export function getStudioSnapshot () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserStudioSnapshot())
  }

  return invoke(getChannel('STUDIO_GET_SNAPSHOT'))
}

export function refreshDashboardCredits (payload) {
  if (!hasBridge()) {
    const settings = getBrowserSettings()
    const current = settings.dashboardCreditState || defaultBrowserDashboardCreditState
    return Promise.resolve({
      totalCredits: current.totalCredits,
      remainingCredits: current.remainingCredits
    })
  }

  return invoke(getChannel('STUDIO_REFRESH_DASHBOARD_CREDITS'), payload)
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

export function stopStudioTask (payload) {
  return invoke(getChannel('STUDIO_STOP_TASK'), payload)
}

export function getActivationStatus () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserActivationState())
  }

  return invoke(getChannel('LICENSE_GET_STATUS'))
}

export function getDeviceCode () {
  if (!hasBridge()) {
    return Promise.resolve({
      deviceCode: defaultBrowserActivationState.deviceCode
    })
  }

  return invoke(getChannel('LICENSE_GET_DEVICE_CODE'))
}

export function importLicenseFile (payload) {
  if (!hasBridge()) {
    return Promise.resolve({
      ...getBrowserActivationState(),
      canceled: false,
      message: '导入授权成功'
    })
  }

  return invoke(getChannel('LICENSE_IMPORT_FILE'), payload)
}

export function reloadActivation () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserActivationState())
  }

  return invoke(getChannel('LICENSE_REFRESH'))
}

export function pickStudioInputAssets (payload) {
  if (!hasBridge()) {
    return Promise.resolve({
      canceled: true,
      files: []
    })
  }

  return invoke(getChannel('STUDIO_PICK_INPUT_ASSETS'), payload)
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

export function clearStudioRuntimeState () {
  if (!hasBridge()) {
    return Promise.resolve(clearBrowserStudioRuntimeState())
  }

  return invoke(getChannel('STUDIO_CLEAR_RUNTIME_STATE'))
}


