const fs = require('node:fs')

const SETTINGS_KEY = 'userSettings'
const API_KEY_SLOT_COUNT = 2
const CREDIT_HISTORY_LIMIT = 20

const defaultCreditState = {
  totalPurchasedCredits: 0,
  remainingCredits: 0,
  frozenCredits: 0,
  usedCredits: 0,
  lastAdjustmentAt: '',
  lastAdjustmentOperation: '',
  lastAdjustmentAmount: 0,
  adjustmentHistory: [],
  activityHistory: [],
  taskLedger: {}
}

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
  themeMode: 'dark',
  creditState: defaultCreditState
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

function normalizeNonNegativeInteger(value = 0) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.round(numericValue)
}

function normalizeCreditHistoryEntry(entry = {}) {
  return {
    id: typeof entry.id === 'string' ? entry.id : '',
    operation: entry.operation === 'decrease' ? 'decrease' : 'increase',
    amount: normalizeNonNegativeInteger(entry.amount),
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
    note: typeof entry.note === 'string' ? entry.note : ''
  }
}

function normalizeUploadDirectoryPatch(uploadDirectories = {}) {
  if (!uploadDirectories || typeof uploadDirectories !== 'object') {
    return {}
  }

  const patch = {}

  for (const key of ['single-image', 'single-design', 'series-design', 'series-generate']) {
    if (Object.prototype.hasOwnProperty.call(uploadDirectories, key)) {
      patch[key] = typeof uploadDirectories[key] === 'string' ? uploadDirectories[key] : ''
    }
  }

  return patch
}

function normalizeCreditActivityEntry(entry = {}) {
  return {
    id: typeof entry.id === 'string' ? entry.id : '',
    type: typeof entry.type === 'string' ? entry.type : '',
    operation: entry.operation === 'decrease' ? 'decrease' : 'increase',
    amount: normalizeNonNegativeInteger(entry.amount),
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
    note: typeof entry.note === 'string' ? entry.note : '',
    taskId: typeof entry.taskId === 'string' ? entry.taskId : '',
    taskNumber: typeof entry.taskNumber === 'string' ? entry.taskNumber : '',
    taskName: typeof entry.taskName === 'string' ? entry.taskName : '',
    menuKey: typeof entry.menuKey === 'string' ? entry.menuKey : '',
    modelSummary: typeof entry.modelSummary === 'string' ? entry.modelSummary : ''
  }
}

function normalizeTaskLedgerEntry(entry = {}) {
  return {
    taskId: typeof entry.taskId === 'string' ? entry.taskId : '',
    taskNumber: typeof entry.taskNumber === 'string' ? entry.taskNumber : '',
    menuKey: typeof entry.menuKey === 'string' ? entry.menuKey : '',
    taskName: typeof entry.taskName === 'string' ? entry.taskName : '',
    modelSummary: typeof entry.modelSummary === 'string' ? entry.modelSummary : '',
    estimatedCredits: normalizeNonNegativeInteger(entry.estimatedCredits),
    status: typeof entry.status === 'string' ? entry.status : '',
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : ''
  }
}

function normalizeTaskLedger(taskLedger = {}) {
  if (!taskLedger || typeof taskLedger !== 'object' || Array.isArray(taskLedger)) {
    return {}
  }

  return Object.fromEntries(Object.entries(taskLedger).map(([taskId, entry]) => {
    return [taskId, normalizeTaskLedgerEntry({
      ...entry,
      taskId: entry?.taskId || taskId
    })]
  }))
}

function normalizeCreditState(rawCreditState = {}) {
  const sourceCreditState = rawCreditState && typeof rawCreditState === 'object' ? rawCreditState : {}

  return {
    totalPurchasedCredits: normalizeNonNegativeInteger(sourceCreditState.totalPurchasedCredits),
    remainingCredits: normalizeNonNegativeInteger(sourceCreditState.remainingCredits),
    frozenCredits: normalizeNonNegativeInteger(sourceCreditState.frozenCredits),
    usedCredits: normalizeNonNegativeInteger(sourceCreditState.usedCredits),
    lastAdjustmentAt: typeof sourceCreditState.lastAdjustmentAt === 'string' ? sourceCreditState.lastAdjustmentAt : '',
    lastAdjustmentOperation: typeof sourceCreditState.lastAdjustmentOperation === 'string' ? sourceCreditState.lastAdjustmentOperation : '',
    lastAdjustmentAmount: normalizeNonNegativeInteger(sourceCreditState.lastAdjustmentAmount),
    adjustmentHistory: Array.isArray(sourceCreditState.adjustmentHistory)
      ? sourceCreditState.adjustmentHistory.slice(0, CREDIT_HISTORY_LIMIT).map((entry) => normalizeCreditHistoryEntry(entry))
      : [],
    activityHistory: Array.isArray(sourceCreditState.activityHistory)
      ? sourceCreditState.activityHistory.slice(0, CREDIT_HISTORY_LIMIT).map((entry) => normalizeCreditActivityEntry(entry))
      : [],
    taskLedger: normalizeTaskLedger(sourceCreditState.taskLedger)
  }
}

function applyCreditAdjustment(creditState, adjustment = {}, { getNow = () => new Date().toISOString() } = {}) {
  const normalizedCreditState = normalizeCreditState(creditState)
  const amount = normalizeNonNegativeInteger(adjustment.amount)

  if (!amount) {
    return normalizedCreditState
  }

  const operation = adjustment.operation === 'decrease' ? 'decrease' : 'increase'
  if (operation === 'decrease' && normalizedCreditState.remainingCredits < amount) {
    throw new Error('可用积分不足，无法扣减')
  }

  const createdAt = getNow()
  const nextRemainingCredits = operation === 'increase'
    ? normalizedCreditState.remainingCredits + amount
    : normalizedCreditState.remainingCredits - amount

  return normalizeCreditState({
    ...normalizedCreditState,
    totalPurchasedCredits: operation === 'increase'
      ? normalizedCreditState.totalPurchasedCredits + amount
      : normalizedCreditState.totalPurchasedCredits,
    remainingCredits: nextRemainingCredits,
    lastAdjustmentAt: createdAt,
    lastAdjustmentOperation: operation,
    lastAdjustmentAmount: amount,
    adjustmentHistory: [
      normalizeCreditHistoryEntry({
        id: `credit-adjustment-${createdAt}-${operation}`,
        operation,
        amount,
        createdAt,
        note: typeof adjustment.note === 'string' ? adjustment.note : ''
      }),
      ...normalizedCreditState.adjustmentHistory
    ].slice(0, CREDIT_HISTORY_LIMIT),
    activityHistory: [
      normalizeCreditActivityEntry({
        id: `credit-activity-${createdAt}-${operation}`,
        type: operation === 'decrease' ? 'manual_decrease' : 'manual_increase',
        operation,
        amount,
        createdAt,
        note: typeof adjustment.note === 'string' ? adjustment.note : ''
      }),
      ...normalizedCreditState.activityHistory
    ].slice(0, CREDIT_HISTORY_LIMIT)
  })
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
    creditState: normalizeCreditState(mergedSettings.creditState),
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
    const hasUploadDirectoriesPatch = Object.prototype.hasOwnProperty.call(payload, 'uploadDirectories')
    const uploadDirectories = hasUploadDirectoriesPatch
      ? {
          ...normalizeUploadDirectories(currentSettings.uploadDirectories),
          ...normalizeUploadDirectoryPatch(payload.uploadDirectories)
        }
      : normalizeUploadDirectories(currentSettings.uploadDirectories)
    const globalUploadDirectory = Object.prototype.hasOwnProperty.call(payload, 'globalUploadDirectory')
      ? normalizeGlobalUploadDirectory(payload.globalUploadDirectory)
      : normalizeGlobalUploadDirectory(currentSettings.globalUploadDirectory)

    if (typeof payload.apiKey === 'string') {
      apiKeys[activeApiKeyIndex] = payload.apiKey
    }

    if (hasUploadDirectoriesPatch) {
      validateUploadDirectories(normalizeUploadDirectoryPatch(payload.uploadDirectories), options)
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'globalUploadDirectory')) {
      validateGlobalUploadDirectory(globalUploadDirectory, options)
    }

    let creditState = Object.prototype.hasOwnProperty.call(restPayload, 'creditState')
      ? normalizeCreditState({
          ...currentSettings.creditState,
          ...restPayload.creditState
        })
      : normalizeCreditState(currentSettings.creditState)

    if (creditAdjustment && typeof creditAdjustment === 'object') {
      creditState = applyCreditAdjustment(creditState, creditAdjustment, options)
    }

    const nextSettings = normalizeSettings({
      ...currentSettings,
      ...restPayload,
      globalUploadDirectory,
      uploadDirectories,
      apiKeys,
      activeApiKeyIndex,
      creditState
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
  defaultSettings,
  defaultCreditState
}
