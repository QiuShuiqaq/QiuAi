<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AppTopBar from './components/AppTopBar.vue'
import ActivationGate from './components/ActivationGate.vue'
import WorkspaceSidebar from './components/WorkspaceSidebar.vue'
import DesignWorkspace from './components/DesignWorkspace.vue'
import TaskManagerSidebar from './components/TaskManagerSidebar.vue'
import {
  clearStudioRuntimeState,
  createStudioTask,
  deleteStudioExportItem,
  exportStudioResults,
  getActivationStatus,
  getSettings,
  getStudioSnapshot,
  importLicenseFile,
  listPromptTemplates,
  openOutputDirectory,
  pickStudioInputAssets,
  reloadActivation,
  removePromptTemplate,
  saveSettings,
  savePromptTemplate,
  saveStudioDraft
} from './services/desktopBridge'

const themeOptions = [
  { label: '暗黑', value: 'dark' }
]

const menuItems = [
  { key: 'workspace', label: '工作台' },
  { key: 'single-image', label: '单图测试' },
  { key: 'single-design', label: '单图设计' },
  { key: 'series-design', label: '套图设计' },
  { key: 'series-generate', label: '套图生成' },
  { key: 'model-pricing', label: '模型价格' },
  { key: 'prompt-library', label: '提示词库' }
]

const imageModelOptions = [
  { label: 'gpt-image-2', value: 'gpt-image-2' },
  { label: 'nano-banana-pro', value: 'nano-banana-pro' },
  { label: 'nano-banana-fast', value: 'nano-banana-fast' },
  { label: 'nano-banana-2', value: 'nano-banana-2' },
  { label: 'nano-banana-pro-vt', value: 'nano-banana-pro-vt' },
  { label: 'nano-banana-pro-cl', value: 'nano-banana-pro-cl' },
  { label: 'nano-banana-2-cl', value: 'nano-banana-2-cl' },
  { label: 'nano-banana-pro-vip', value: 'nano-banana-pro-vip' },
  { label: 'nano-banana-2-4k-cl', value: 'nano-banana-2-4k-cl' },
  { label: 'nano-banana-pro-4k-vip', value: 'nano-banana-pro-4k-vip' },
  { label: 'nano-banana', value: 'nano-banana' }
]

const modelPricingCatalog = [
  { name: 'nano-banana-fast', credits: '440 / 次' },
  { name: 'gpt-image-2', credits: '600 / 次' },
  { name: 'nano-banana-2', credits: '1200 / 次' },
  { name: 'nano-banana', credits: '1400 / 次' },
  { name: 'nano-banana-2-cl', credits: '1600 / 次' },
  { name: 'nano-banana-pro', credits: '1800 / 次' },
  { name: 'nano-banana-pro-vt', credits: '1800 / 次' },
  { name: 'nano-banana-2-4k-cl', credits: '3000 / 次' },
  { name: 'nano-banana-pro-cl', credits: '6000 / 次' },
  { name: 'nano-banana-pro-vip', credits: '10000 / 次' },
  { name: 'nano-banana-pro-4k-vip', credits: '16000 / 次' }
]

const rechargePricingCatalog = [
  { price: '30¥', credits: '100000积分', bonus: '' },
  { price: '60¥', credits: '250000积分', bonus: '送25%' },
  { price: '150¥', credits: '750000积分', bonus: '送50%' },
  { price: '300¥', credits: '1600000积分', bonus: '送60%' },
  { price: '1500¥', credits: '9000000积分', bonus: '送80%' },
  { price: '3000¥', credits: '20000000积分', bonus: '送100%' }
]

const batchOptions = [
  { label: '单批 4 个结果', value: 'batch-4' },
  { label: '单批 8 个结果', value: 'batch-8' },
  { label: '单批 12 个结果', value: 'batch-12' }
]

const ratioOptions = [
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: 'A4 竖版', value: 'a4-portrait' },
  { label: 'A4 横版', value: 'a4-landscape' },
  { label: 'A5 竖版', value: 'a5-portrait' },
  { label: 'A5 横版', value: 'a5-landscape' },
  { label: '8K 横版', value: '8k-landscape' },
  { label: '8K 竖版', value: '8k-portrait' }
]

const activeTheme = ref('dark')
const activeMenu = ref('workspace')
const isSavingApiConfig = ref(false)
const isApplyingCreditAdjustment = ref(false)
const selectedExportIds = ref([])
const submitButtonState = ref('idle')
const tasks = ref([])
const formDrafts = ref(createDefaultFormDrafts())
const resultsByMenu = ref(createEmptyResultsByMenu())
const exportItemsByMenu = ref(createEmptyExportItemsByMenu())
const workspaceDashboard = ref(createEmptyWorkspaceDashboard())
const hostInfo = ref(createEmptyHostInfo())
const promptTemplates = ref([])
const actionNotice = reactive({
  visible: false,
  type: 'success',
  title: '',
  message: ''
})
const apiConfigDraft = reactive({
  apiKeys: ['', ''],
  activeApiKeyIndex: 0
})
const creditAdjustmentAmount = ref('')
const totalCreditAmount = ref('')
const uploadDirectoryDrafts = reactive(createEmptyUploadDirectoryDrafts())
const activationState = ref(createDefaultActivationState())
const isActivationLoading = ref(true)
const isSavingTotalCredits = ref(false)
let actionNoticeTimer = null
let submitButtonStateTimer = null
let studioRuntimePollTimer = null
let isRefreshingStudioRuntime = false
const draftPersistTimers = new Map()

function resolveDefaultModelForMenu() {
  return imageModelOptions[0].value
}

function createEmptyUploadDirectoryDrafts() {
  return {
    'single-image': '',
    'single-design': '',
    'series-design': '',
    'series-generate': ''
  }
}

function normalizeUploadDirectoryDrafts(uploadDirectories = {}) {
  return {
    ...createEmptyUploadDirectoryDrafts(),
    ...(uploadDirectories || {})
  }
}

function createPreviewUrl(filePath = '') {
  if (!filePath) {
    return ''
  }

  return encodeURI(`file:///${String(filePath).replace(/\\/g, '/')}`)
}

function createImageAsset(file, idPrefix, preview = true) {
  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    path: file.path || '',
    sizeLabel: `${Math.max(1, Math.round((Number(file.size) || 0) / 1024))} KB`,
    preview: preview
      ? (file instanceof File ? URL.createObjectURL(file) : createPreviewUrl(file.path || ''))
      : '',
    storedPath: ''
  }
}

function createSeriesGeneratePromptAssignments(count, existingAssignments = []) {
  const normalizedCount = Math.max(1, Math.min(100, Number(count) || 1))
  const sourceAssignments = Array.isArray(existingAssignments) ? existingAssignments : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    const currentAssignment = sourceAssignments[index] || {}

    return {
      id: currentAssignment.id || `series-generate-${index + 1}`,
      index: index + 1,
      prompt: currentAssignment.prompt || '',
      imageType: currentAssignment.imageType || ''
    }
  })
}

function createDraftForm(menuKey) {
  if (menuKey === 'single-image') {
    return {
      prompt: '保持主体不变，测试不同模型效果',
      model: resolveDefaultModelForMenu(menuKey),
      taskName: '',
      sourceImage: null,
      compareModels: ['nano-banana-fast', 'gpt-image-2', 'nano-banana-2', 'nano-banana-2-cl'],
      quantity: 1,
      size: '1:1',
      notes: ''
    }
  }

  if (menuKey === 'single-design') {
    return {
      prompt: '生成一张适合电商展示的高质量商品图',
      model: resolveDefaultModelForMenu(menuKey),
      taskName: '',
      sourceImage: null,
      quantity: 1,
      size: '1:1',
      notes: ''
    }
  }

  if (menuKey === 'series-design') {
    return {
      globalPrompt: '统一商品图整体风格',
      model: resolveDefaultModelForMenu(menuKey),
      taskName: '',
      imageAssignments: [],
      batchCount: 1,
      size: '1:1'
    }
  }

  if (menuKey === 'series-generate') {
    return {
      globalPrompt: '统一商品详情图整体风格',
      model: resolveDefaultModelForMenu(menuKey),
      taskName: '',
      sourceImage: null,
      generateCount: 20,
      promptAssignments: createSeriesGeneratePromptAssignments(20),
      batchCount: 1,
      size: '1:1'
    }
  }

  return {
    prompt: '',
    model: resolveDefaultModelForMenu('single-image')
  }
}

function createDefaultFormDrafts() {
  return Object.fromEntries(menuItems.map((item) => [item.key, createDraftForm(item.key)]))
}

function createEmptyResultsByMenu() {
  return Object.fromEntries(menuItems.map((item) => [
    item.key,
    {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    }
  ]))
}

function createEmptyExportItemsByMenu() {
  return Object.fromEntries(menuItems.map((item) => [item.key, []]))
}

function createEmptyStatsCard(title) {
  return {
    title,
    items: [
      { label: '模型调用次数', value: '0' },
      { label: '任务总数', value: '0' },
      { label: '已完成任务', value: '0' },
      { label: '失败任务', value: '0' },
      { label: '当前结果数', value: '0' },
      { label: '已存储结果', value: '0' }
    ]
  }
}

function createEmptyCreditOverview() {
  return {
    title: '积分仪表盘',
    items: [
      { label: '剩余积分', value: '0' },
      { label: '冻结积分', value: '0' },
      { label: '已用积分', value: '0' },
      { label: '累计充值积分', value: '0' },
      { label: '最近调整', value: '--' },
      { label: '按 gpt-image-2 约可生成', value: '0' }
    ]
  }
}

function createEmptyCreditMessages() {
  return {
    title: '积分消息记录',
    items: []
  }
}

function createEmptyWorkspaceDashboard() {
  return {
    seriesDesignStats: createEmptyStatsCard('套图设计统计'),
    singleImageStats: createEmptyStatsCard('单图测试统计'),
    singleDesignStats: createEmptyStatsCard('单图设计统计'),
    seriesGenerateStats: createEmptyStatsCard('套图生成统计'),
    creditOverview: createEmptyCreditOverview(),
    creditMessages: createEmptyCreditMessages()
  }
}

function createEmptyHostInfo() {
  return {
    systemName: '--',
    platformName: '--',
    architecture: '--',
    cpuModel: '--',
    userName: '--',
    runtimeName: '--'
  }
}

function createDefaultActivationState() {
  return {
    status: 'not_found',
    customerName: '',
    deviceCode: '',
    activatedAt: '',
    message: ''
  }
}

function normalizeStoredDraft(menuKey, storedDraft = {}) {
  const normalizedDraft = {
    ...createDraftForm(menuKey),
    ...storedDraft
  }

  if (menuKey === 'series-generate') {
    const generateCount = Math.max(1, Math.min(100, Number(normalizedDraft.generateCount) || 1))
    normalizedDraft.generateCount = generateCount
    normalizedDraft.promptAssignments = createSeriesGeneratePromptAssignments(generateCount, normalizedDraft.promptAssignments)
  }

  return normalizedDraft
}

function revokePreview(preview) {
  if (preview && preview.startsWith('blob:')) {
    URL.revokeObjectURL(preview)
  }
}

function revokeDraftPreviews(draft = {}) {
  const imageAssignments = draft.imageAssignments || []

  imageAssignments.forEach((item) => revokePreview(item.preview))
  revokePreview(draft.sourceImage?.preview)
}

function replaceDraft(menuKey, nextDraft) {
  formDrafts.value = {
    ...formDrafts.value,
    [menuKey]: nextDraft
  }
}

function upsertTaskIntoState(task) {
  if (!task || !task.id) {
    return
  }

  tasks.value = [
    task,
    ...tasks.value.filter((item) => item.id !== task.id)
  ]
}

function clearDraftPersistTimer(menuKey) {
  const existingTimer = draftPersistTimers.get(menuKey)
  if (!existingTimer) {
    return
  }

  clearTimeout(existingTimer)
  draftPersistTimers.delete(menuKey)
}

function clearAllDraftPersistTimers() {
  for (const timer of draftPersistTimers.values()) {
    clearTimeout(timer)
  }
  draftPersistTimers.clear()
}

function clearSubmitButtonStateTimer() {
  if (submitButtonStateTimer) {
    clearTimeout(submitButtonStateTimer)
    submitButtonStateTimer = null
  }
}

function setSubmitButtonState(nextState) {
  clearSubmitButtonStateTimer()
  submitButtonState.value = nextState

  if (nextState === 'success') {
    submitButtonStateTimer = setTimeout(() => {
      submitButtonState.value = 'idle'
      submitButtonStateTimer = null
    }, 1000)
  }
}

function clearActionFeedback() {
  if (actionNoticeTimer) {
    clearTimeout(actionNoticeTimer)
    actionNoticeTimer = null
  }

  actionNotice.visible = false
}

function buildErrorMessage(error, fallbackMessage = '未知错误') {
  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  if (error && typeof error === 'object') {
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim()
    }

    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error.trim()
    }

    if (typeof error.msg === 'string' && error.msg.trim()) {
      return error.msg.trim()
    }
  }

  return fallbackMessage
}

function showActionFeedback({ type = 'success', title, message }) {
  clearActionFeedback()
  actionNotice.type = type
  actionNotice.title = title
  actionNotice.message = message
  actionNotice.visible = true
  actionNoticeTimer = setTimeout(() => {
    actionNotice.visible = false
    actionNoticeTimer = null
  }, 3200)
}

const menuLabelMap = computed(() => {
  return Object.fromEntries(menuItems.map((item) => [item.key, item.label]))
})

const currentMenuLabel = computed(() => {
  return menuLabelMap.value[activeMenu.value] || '工作台'
})

const isActivated = computed(() => {
  return activationState.value.status === 'activated'
})

const activationSummary = computed(() => {
  if (!isActivated.value) {
    return null
  }

  return {
    customerName: activationState.value.customerName || '已授权设备',
    deviceCode: activationState.value.deviceCode || ''
  }
})

const currentModelOptions = computed(() => {
  return imageModelOptions
})

const sortedTasks = computed(() => {
  return [...tasks.value].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
})

const hasActiveStudioTasks = computed(() => {
  return sortedTasks.value.some((task) => ['等待中', '进行中'].includes(task.status))
})

const latestTaskForActiveMenu = computed(() => {
  const matchedTask = sortedTasks.value.find((task) => task.menuKey === activeMenu.value)
  return matchedTask || null
})

const resultPayload = computed(() => {
  return resultsByMenu.value[activeMenu.value] || resultsByMenu.value.workspace
})

const exportItems = computed(() => {
  return exportItemsByMenu.value[activeMenu.value] || exportItemsByMenu.value.workspace
})

const fixedPromptTemplates = computed(() => {
  return promptTemplates.value.filter((item) => item.source === 'system-fixed')
})

const customPromptTemplates = computed(() => {
  return promptTemplates.value.filter((item) => item.source === 'custom')
})

const currentDraftForm = computed(() => {
  return formDrafts.value[activeMenu.value] || createDraftForm(activeMenu.value)
})

const currentLongRunningHint = computed(() => {
  const draft = currentDraftForm.value

  if (activeMenu.value === 'series-generate') {
    const totalSubtasks = Math.max(1, Number(draft.generateCount) || 1) * Math.max(1, Number(draft.batchCount) || 1)
    if (totalSubtasks > 300) {
      return '当前任务量很大，将进入长队列执行。'
    }
    if (totalSubtasks > 100) {
      return '当前任务量较大，生成时间会明显变长。'
    }
  }

  if (activeMenu.value === 'series-design') {
    const selectedCount = Array.isArray(draft.imageAssignments)
      ? draft.imageAssignments.filter((item) => item.selected !== false).length
      : 0
    const totalSubtasks = selectedCount * Math.max(1, Number(draft.batchCount) || 1)
    if (totalSubtasks > 300) {
      return '当前任务量很大，将进入长队列执行。'
    }
    if (totalSubtasks > 100) {
      return '当前任务量较大，生成时间会明显变长。'
    }
  }

  return ''
})

function applySnapshot(snapshot = {}, settings = {}, options = {}) {
  const {
    preserveDrafts = false,
    preserveApiConfig = false,
    preserveUploadDirectoryDrafts = false
  } = options

  if (!preserveDrafts) {
    formDrafts.value = Object.fromEntries(menuItems.map((item) => {
      return [item.key, normalizeStoredDraft(item.key, snapshot.formDrafts?.[item.key] || {})]
    }))
  }
  resultsByMenu.value = {
    ...createEmptyResultsByMenu(),
    ...(snapshot.resultsByMenu || {})
  }
  exportItemsByMenu.value = {
    ...createEmptyExportItemsByMenu(),
    ...(snapshot.exportItemsByMenu || {})
  }
  tasks.value = Array.isArray(snapshot.tasks) ? snapshot.tasks : []
  workspaceDashboard.value = {
    ...createEmptyWorkspaceDashboard(),
    ...(snapshot.workspaceDashboard || {})
  }
  hostInfo.value = {
    ...createEmptyHostInfo(),
    ...(snapshot.hostInfo || {})
  }
  activeTheme.value = settings.themeMode || snapshot.themeMode || 'dark'

  if (!preserveApiConfig) {
    const nextApiKeys = Array.isArray(settings.apiKeys) && settings.apiKeys.length
      ? settings.apiKeys
      : snapshot.settingsSummary?.apiKeys || ['', '']
    apiConfigDraft.apiKeys = Array.from({ length: 2 }, (_unused, index) => {
      return typeof nextApiKeys[index] === 'string' ? nextApiKeys[index] : ''
    })
    apiConfigDraft.activeApiKeyIndex = Number.isInteger(settings.activeApiKeyIndex)
      ? settings.activeApiKeyIndex
      : (snapshot.settingsSummary?.activeApiKeyIndex || 0)
  }

  if (!preserveUploadDirectoryDrafts) {
    const nextUploadDirectories = normalizeUploadDirectoryDrafts(settings.uploadDirectories)
    Object.assign(uploadDirectoryDrafts, nextUploadDirectories)
  }

  if (!totalCreditAmount.value || isSavingTotalCredits.value) {
    const snapshotCreditItems = Array.isArray(snapshot.workspaceDashboard?.creditOverview?.items)
      ? snapshot.workspaceDashboard.creditOverview.items
      : []
    const totalCreditItem = snapshotCreditItems.find((item) => item.label === '总积分' || item.label === '累计充值积分')
    const resolvedTotalCredits = settings.creditState?.totalPurchasedCredits ?? totalCreditItem?.value ?? 0
    totalCreditAmount.value = String(resolvedTotalCredits)
  }
}

async function loadStudioSnapshot(options = {}) {
  try {
    const [snapshot, settings] = await Promise.all([
      getStudioSnapshot(),
      getSettings()
    ])
    applySnapshot(snapshot, settings, options)
  } catch (error) {
    console.error('Failed to load studio snapshot', error)
  }
}

async function loadActivationState({ silent = false } = {}) {
  if (!silent) {
    isActivationLoading.value = true
  }

  try {
    const fetchActivation = silent ? reloadActivation : getActivationStatus
    activationState.value = {
      ...createDefaultActivationState(),
      ...(await fetchActivation())
    }
  } catch (error) {
    activationState.value = {
      ...createDefaultActivationState(),
      message: buildErrorMessage(error, '授权状态读取失败')
    }
  } finally {
    isActivationLoading.value = false
  }
}

async function loadPromptTemplateState() {
  try {
    promptTemplates.value = await listPromptTemplates()
  } catch (error) {
    console.error('Failed to load prompt templates', error)
  }
}

async function refreshStudioRuntimeState() {
  if (!isActivated.value) {
    return
  }

  if (isRefreshingStudioRuntime) {
    return
  }

  isRefreshingStudioRuntime = true

  try {
    await loadStudioSnapshot({
      preserveDrafts: true,
      preserveApiConfig: true,
      preserveUploadDirectoryDrafts: true
    })
  } finally {
    isRefreshingStudioRuntime = false
  }
}

function handleBrandClick() {
  // Logo 点击事件预留：后续可在这里接入返回首页或重置工作区逻辑。
  activeMenu.value = 'workspace'
}

async function handleCopyDeviceCode() {
  const deviceCode = activationState.value.deviceCode || ''
  if (!deviceCode) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '复制失败：未获取到设备码'
    })
    return
  }

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(deviceCode)
      showActionFeedback({
        type: 'success',
        title: '成功',
        message: '设备码已复制'
      })
      return
    }
  } catch (error) {
    console.error('Failed to copy device code', error)
  }

  showActionFeedback({
    type: 'error',
    title: '失败',
    message: '复制失败：当前环境不支持自动复制'
  })
}

async function handleImportLicense() {
  try {
    const result = await importLicenseFile()
    if (result?.canceled) {
      return
    }

    activationState.value = {
      ...createDefaultActivationState(),
      ...result
    }

    if (result.status === 'activated') {
      await Promise.all([
        loadStudioSnapshot(),
        loadPromptTemplateState()
      ])
      showActionFeedback({
        type: 'success',
        title: '成功',
        message: result.message || '导入授权成功'
      })
      return
    }

    showActionFeedback({
      type: 'error',
      title: '失败',
      message: result.message || '授权校验失败，请重新导入授权文件'
    })
  } catch (error) {
    console.error('Failed to import license file', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `导入授权文件失败：${buildErrorMessage(error, '授权导入未完成')}`
    })
  }
}

async function handleThemeChange() {
  // 主题切换事件预留：后续可在这里接入本地存储或桌面端配置同步。
  activeTheme.value = 'dark'

  try {
    await saveSettings({
      themeMode: 'dark'
    })
  } catch (error) {
    console.error('Failed to persist theme', error)
  }
}

async function handleClearRuntimeState() {
  const shouldClear = typeof window !== 'undefined' && typeof window.confirm === 'function'
    ? window.confirm('确认执行一键清理吗？将重置参数设置、效果展示与日志缓存，但不会删除输出结果、提示词库、API-Key 和保存目录。')
    : true

  if (!shouldClear) {
    return
  }

  try {
    clearAllDraftPersistTimers()
    Object.values(formDrafts.value).forEach((draft) => {
      revokeDraftPreviews(draft || {})
    })

    await clearStudioRuntimeState()
    selectedExportIds.value = []
    await loadStudioSnapshot()
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '一键清理已完成，参数草稿与日志缓存已重置'
    })
  } catch (error) {
    console.error('Failed to clear studio runtime state', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `一键清理失败：${buildErrorMessage(error, '清理未完成')}`
    })
  }
}

function ensureDraftForMenu(menuKey) {
  if (formDrafts.value[menuKey]) {
    return
  }

  replaceDraft(menuKey, createDraftForm(menuKey))
}

async function resetDraftForMenu(menuKey) {
  ensureDraftForMenu(menuKey)
  clearDraftPersistTimer(menuKey)
  revokeDraftPreviews(formDrafts.value[menuKey] || {})
  const nextDraft = createDraftForm(menuKey)
  replaceDraft(menuKey, nextDraft)
  await persistDraftPatch(menuKey, nextDraft)
}

async function resetActiveDraftAfterSubmit() {
  await resetDraftForMenu(activeMenu.value)
}

function handleMenuSelect(menuKey) {
  // 菜单点击事件预留：后续可在这里接入真实业务工作区切换。
  activeMenu.value = menuKey
  ensureDraftForMenu(menuKey)
}

async function persistDraftPatch(menuKey, patch) {
  try {
    await saveStudioDraft({
      menuKey,
      patch
    })
  } catch (error) {
    console.error('Failed to save studio draft', error)
  }
}

function scheduleDraftPersist(menuKey, patch) {
  clearDraftPersistTimer(menuKey)
  const timer = window.setTimeout(() => {
    draftPersistTimers.delete(menuKey)
    void persistDraftPatch(menuKey, patch)
  }, 320)
  draftPersistTimers.set(menuKey, timer)
}

function handleFieldUpdate({ field, value }) {
  ensureDraftForMenu(activeMenu.value)
  const currentDraft = currentDraftForm.value
  let nextDraft = {
    ...currentDraft,
    [field]: value
  }

  if (activeMenu.value === 'series-generate' && field === 'generateCount') {
    const generateCount = Math.max(1, Math.min(100, Number(value) || 1))
    nextDraft = {
      ...currentDraft,
      generateCount,
      promptAssignments: createSeriesGeneratePromptAssignments(generateCount, currentDraft.promptAssignments)
    }
  }

  if (activeMenu.value === 'series-generate' && field === 'promptAssignments') {
    nextDraft = {
      ...currentDraft,
      promptAssignments: createSeriesGeneratePromptAssignments(currentDraft.generateCount, value)
    }
  }

  replaceDraft(activeMenu.value, nextDraft)
  scheduleDraftPersist(activeMenu.value, nextDraft)
}

async function applySingleImageSelection(file) {
  ensureDraftForMenu('single-image')
  revokePreview(formDrafts.value['single-image']?.sourceImage?.preview)
  const sourceImage = createImageAsset(file, 'single-image')
  const nextDraft = {
    ...formDrafts.value['single-image'],
    sourceImage
  }

  replaceDraft('single-image', nextDraft)
  scheduleDraftPersist('single-image', {
    sourceImage
  })
}

async function applySingleDesignSelection(file) {
  ensureDraftForMenu('single-design')
  revokePreview(formDrafts.value['single-design']?.sourceImage?.preview)
  const sourceImage = createImageAsset(file, 'single-design')
  const nextDraft = {
    ...formDrafts.value['single-design'],
    sourceImage
  }

  replaceDraft('single-design', nextDraft)
  scheduleDraftPersist('single-design', {
    sourceImage
  })
}

async function applySeriesDesignSelection(fileList = []) {
  if (!fileList.length) {
    return
  }

  if (fileList.length > 30) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '套图设计一次最多上传 30 张图片'
    })
    return
  }

  ensureDraftForMenu('series-design')
  revokeDraftPreviews(formDrafts.value['series-design'])
  const imageAssignments = fileList.map((file) => ({
    ...createImageAsset(file, 'series-design'),
    selected: true,
    prompt: '',
    imageType: ''
  }))
  const nextDraft = {
    ...formDrafts.value['series-design'],
    imageAssignments
  }

  replaceDraft('series-design', nextDraft)
  scheduleDraftPersist('series-design', {
    imageAssignments
  })
}

async function applySeriesGenerateSelection(file) {
  ensureDraftForMenu('series-generate')
  revokePreview(formDrafts.value['series-generate']?.sourceImage?.preview)
  const sourceImage = createImageAsset(file, 'series-generate')
  const nextDraft = {
    ...formDrafts.value['series-generate'],
    sourceImage
  }

  replaceDraft('series-generate', nextDraft)
  scheduleDraftPersist('series-generate', {
    sourceImage
  })
}

async function pickInputAssetsForMenu({ menuKey, allowMultiple = false }) {
  const pickedResult = await pickStudioInputAssets({
    menuKey,
    allowMultiple
  })

  if (pickedResult?.canceled) {
    return null
  }

  const files = Array.isArray(pickedResult?.files) ? pickedResult.files : []
  if (!files.length) {
    throw new Error('未选择可用的图片文件')
  }

  return files
}

async function handleOpenSingleImagePicker() {
  try {
    const files = await pickInputAssetsForMenu({
      menuKey: 'single-image'
    })
    if (!files) {
      return
    }
    await applySingleImageSelection(files[0])
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `上传测试图片失败：${buildErrorMessage(error, '未能选择图片')}`
    })
  }
}

async function handleOpenSingleDesignImagePicker() {
  try {
    const files = await pickInputAssetsForMenu({
      menuKey: 'single-design'
    })
    if (!files) {
      return
    }
    await applySingleDesignSelection(files[0])
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `上传参考图片失败：${buildErrorMessage(error, '未能选择图片')}`
    })
  }
}

async function handleOpenSeriesDesignPicker() {
  try {
    const files = await pickInputAssetsForMenu({
      menuKey: 'series-design',
      allowMultiple: true
    })
    if (!files) {
      return
    }
    await applySeriesDesignSelection(files)
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `上传套图素材失败：${buildErrorMessage(error, '未能选择图片')}`
    })
  }
}

async function handleOpenSeriesGeneratePicker() {
  try {
    const files = await pickInputAssetsForMenu({
      menuKey: 'series-generate'
    })
    if (!files) {
      return
    }
    await applySeriesGenerateSelection(files[0])
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `上传参考图失败：${buildErrorMessage(error, '未能选择图片')}`
    })
  }
}

function validateCurrentTaskBeforeSubmit() {
  const draft = currentDraftForm.value

  if (!String(draft.taskName || '').trim()) {
    return '请先输入任务名称'
  }

  if (activeMenu.value === 'single-image') {
    if (!draft.sourceImage) {
      return '请先上传一张测试图片'
    }

    if (!String(draft.prompt || '').trim()) {
      return '请先输入单图测试提示词'
    }

    return ''
  }

  if (activeMenu.value === 'single-design') {
    if (!String(draft.prompt || '').trim()) {
      return '请先输入单图设计提示词'
    }

    return ''
  }

  if (activeMenu.value === 'series-design') {
    const assignments = Array.isArray(draft.imageAssignments) ? draft.imageAssignments : []
    const selectedCount = assignments.filter((item) => item.selected !== false).length
    const hasEmptySelectedPrompt = assignments.some((item) => item.selected !== false && !String(item.prompt || '').trim())

    if (!assignments.length) {
      return '请先上传一套图片'
    }

    if (!String(draft.globalPrompt || '').trim()) {
      return '请先输入套图设计的全局风格提示词'
    }

    if (!selectedCount) {
      return '请至少选择 1 张需要替换的图片'
    }

    if (hasEmptySelectedPrompt) {
      return '请为每一张选中图片填写单独提示词'
    }

    if (assignments.some((item) => item.selected !== false && !String(item.imageType || '').trim())) {
      return '请为每一张选中图片选择图片类型'
    }

    return ''
  }

  if (activeMenu.value === 'series-generate') {
    const generateCount = Math.max(1, Math.min(100, Number(draft.generateCount) || 1))
    const promptAssignments = createSeriesGeneratePromptAssignments(generateCount, draft.promptAssignments)

    if (!draft.sourceImage) {
      return '请先上传一张参考图'
    }

    if (!String(draft.globalPrompt || '').trim()) {
      return '请先输入套图生成的全局风格提示词'
    }

    if (promptAssignments.some((item) => !String(item.prompt || '').trim())) {
      return '请完整填写每一张图片的单独提示词'
    }

    if (promptAssignments.some((item) => !String(item.imageType || '').trim())) {
      return '请为每一张图片选择图片类型'
    }
  }

  return ''
}

async function handleSubmitTask() {
  if (submitButtonState.value !== 'idle') {
    return
  }

  if (activeMenu.value === 'workspace' || activeMenu.value === 'model-pricing') {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '当前页面不支持提交任务'
    })
    return
  }

  ensureDraftForMenu(activeMenu.value)
  const validationMessage = validateCurrentTaskBeforeSubmit()
  if (validationMessage) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: validationMessage
    })
    return
  }

  try {
    setSubmitButtonState('submitting')
    clearDraftPersistTimer(activeMenu.value)
    const createdTask = await createStudioTask({
      menuKey: activeMenu.value,
      draft: formDrafts.value[activeMenu.value]
    })
    upsertTaskIntoState(createdTask)
    selectedExportIds.value = []
    await resetActiveDraftAfterSubmit()
    setSubmitButtonState('success')
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '任务已提交并加入任务队列'
    })
    void refreshStudioRuntimeState()
  } catch (error) {
    console.error('Failed to submit studio task', error)
    setSubmitButtonState('idle')
    await loadStudioSnapshot()
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `提交任务失败：${buildErrorMessage(error, '任务提交未完成')}`
    })
  }
}

function handleToggleExportItem(itemId) {
  if (selectedExportIds.value.includes(itemId)) {
    selectedExportIds.value = selectedExportIds.value.filter((currentId) => currentId !== itemId)
    return
  }

  selectedExportIds.value = [...selectedExportIds.value, itemId]
}

async function handleBatchDownload() {
  if (!selectedExportIds.value.length) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '批量下载失败：请选择至少一个导出结果'
    })
    return
  }

  try {
    const exportedArchive = await exportStudioResults({
      menuKey: activeMenu.value,
      selectedExportIds: selectedExportIds.value
    })

    if (exportedArchive?.canceled) {
      showActionFeedback({
        type: 'error',
        title: '失败',
        message: '批量下载失败：已取消保存'
      })
      return
    }

    showActionFeedback({
      type: 'success',
      title: '成功',
      message: `已导出 ${exportedArchive?.exportedCount || selectedExportIds.value.length} 个结果到压缩包`
    })
  } catch (error) {
    console.error('Failed to batch download studio results', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `批量下载失败：${buildErrorMessage(error, '导出压缩包未完成')}`
    })
  }
}

async function handleOpenOutputDirectory(outputPath) {
  if (!outputPath) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '打开输出目录失败：未找到可用的输出路径'
    })
    return
  }

  const normalizedOutputDirectory = outputPath.replace(/[\\/][^\\/]+\.[^\\/]+$/, '')

  try {
    await openOutputDirectory({
      outputDirectory: normalizedOutputDirectory
    })
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '已打开结果输出目录'
    })
  } catch (error) {
    console.error('Failed to open output directory', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `打开输出目录失败：${buildErrorMessage(error, '目录打开未完成')}`
    })
  }
}

async function handleDeleteExportItem(exportItemId) {
  if (!exportItemId) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '删除失败：未找到可删除的结果项'
    })
    return
  }

  const shouldDelete = typeof window !== 'undefined' && typeof window.confirm === 'function'
    ? window.confirm('确认删除该结果文件夹吗？删除后无法恢复。')
    : true

  if (!shouldDelete) {
    return
  }

  try {
    await deleteStudioExportItem({
      menuKey: activeMenu.value,
      exportItemId
    })
    selectedExportIds.value = selectedExportIds.value.filter((currentId) => currentId !== exportItemId)
    await loadStudioSnapshot()
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '结果文件夹已删除'
    })
  } catch (error) {
    console.error('Failed to delete studio export item', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `删除结果文件夹失败：${buildErrorMessage(error, '结果删除未完成')}`
    })
  }
}

function handleApiKeyUpdate({ index, value }) {
  if (![0, 1].includes(index)) {
    return
  }

  apiConfigDraft.apiKeys[index] = value
}

function handleSwitchApiKey(index) {
  if (![0, 1].includes(index)) {
    return
  }

  apiConfigDraft.activeApiKeyIndex = index
}

function handleUploadDirectoryDraftUpdate({ menuKey, value }) {
  if (!Object.prototype.hasOwnProperty.call(uploadDirectoryDrafts, menuKey)) {
    return
  }

  uploadDirectoryDrafts[menuKey] = value
}

async function handleSaveUploadDirectory(menuKey) {
  if (!Object.prototype.hasOwnProperty.call(uploadDirectoryDrafts, menuKey)) {
    return
  }

  try {
    const savedSettings = await saveSettings({
      uploadDirectories: {
        [menuKey]: String(uploadDirectoryDrafts[menuKey] || '').trim()
      }
    })
    Object.assign(uploadDirectoryDrafts, normalizeUploadDirectoryDrafts(savedSettings.uploadDirectories))
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: uploadDirectoryDrafts[menuKey]
        ? '默认打开目录已保存'
        : '默认打开目录已清空'
    })
  } catch (error) {
    console.error('Failed to save upload directory', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `保存目录失败：${buildErrorMessage(error, '目录保存未完成')}`
    })
  }
}

async function handleSaveApiConfig() {
  isSavingApiConfig.value = true

  try {
    const savedSettings = await saveSettings({
      apiKeys: apiConfigDraft.apiKeys.map((item) => item.trim()),
      activeApiKeyIndex: apiConfigDraft.activeApiKeyIndex
    })

    apiConfigDraft.apiKeys = Array.from({ length: 2 }, (_unused, index) => {
      return typeof savedSettings.apiKeys[index] === 'string' ? savedSettings.apiKeys[index] : ''
    })
    apiConfigDraft.activeApiKeyIndex = savedSettings.activeApiKeyIndex
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '配置已保存'
    })
  } catch (error) {
    console.error('Failed to save API config', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `保存配置失败：${buildErrorMessage(error, '配置保存未完成')}`
    })
  } finally {
    isSavingApiConfig.value = false
  }
}

function handleCreditAdjustmentValueUpdate(value) {
  creditAdjustmentAmount.value = String(value ?? '')
}

function handleTotalCreditValueUpdate(value) {
  totalCreditAmount.value = String(value ?? '')
}

async function handleApplyCreditAdjustment(operation) {
  const normalizedAmount = Number.parseInt(String(creditAdjustmentAmount.value || '').trim(), 10)

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '积分调整失败：请输入大于 0 的积分数值'
    })
    return
  }

  isApplyingCreditAdjustment.value = true

  try {
    await saveSettings({
      creditAdjustment: {
        operation,
        amount: normalizedAmount
      }
    })
    creditAdjustmentAmount.value = ''
    await loadStudioSnapshot({
      preserveDrafts: true,
      preserveApiConfig: true,
      preserveUploadDirectoryDrafts: true
    })
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: operation === 'decrease' ? '积分已扣减' : '积分已增加'
    })
  } catch (error) {
    console.error('Failed to adjust credits', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `积分调整失败：${buildErrorMessage(error, '积分调整未完成')}`
    })
  } finally {
    isApplyingCreditAdjustment.value = false
  }
}

async function handleSaveTotalCredits() {
  const normalizedTotalCredits = Number.parseInt(String(totalCreditAmount.value || '').trim(), 10)
  const remainingCredits = Number.parseInt(String(
    workspaceDashboard.value.creditOverview?.items?.find((item) => item.label === '剩余积分')?.value || '0'
  ).replace(/[^\d]/g, ''), 10) || 0

  if (!Number.isFinite(normalizedTotalCredits) || normalizedTotalCredits < 0) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '总积分保存失败：请输入大于等于 0 的积分数值'
    })
    return
  }

  if (normalizedTotalCredits < remainingCredits) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '总积分保存失败：总积分不能小于当前剩余积分'
    })
    return
  }

  isSavingTotalCredits.value = true

  try {
    await saveSettings({
      creditState: {
        totalPurchasedCredits: normalizedTotalCredits
      }
    })
    totalCreditAmount.value = String(normalizedTotalCredits)
    await loadStudioSnapshot({
      preserveDrafts: true,
      preserveApiConfig: true,
      preserveUploadDirectoryDrafts: true
    })
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '总积分已保存'
    })
  } catch (error) {
    console.error('Failed to save total credits', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `总积分保存失败：${buildErrorMessage(error, '总积分保存未完成')}`
    })
  } finally {
    isSavingTotalCredits.value = false
  }
}

async function handleSavePromptTemplate(payload) {
  try {
    await savePromptTemplate(payload)
    await loadPromptTemplateState()
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '提示词模板已保存'
    })
  } catch (error) {
    console.error('Failed to save prompt template', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `提示词模板保存失败：${buildErrorMessage(error, '模板保存未完成')}`
    })
  }
}

async function handleRemovePromptTemplate(templateId) {
  try {
    await removePromptTemplate({
      id: templateId
    })
    await loadPromptTemplateState()
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '提示词模板已删除'
    })
  } catch (error) {
    console.error('Failed to remove prompt template', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `提示词模板删除失败：${buildErrorMessage(error, '模板删除未完成')}`
    })
  }
}

onMounted(() => {
  void (async () => {
    await loadActivationState()
    if (isActivated.value) {
      await Promise.all([
        loadStudioSnapshot(),
        loadPromptTemplateState()
      ])
    }
  })()
  studioRuntimePollTimer = window.setInterval(() => {
    if (!isActivated.value || !hasActiveStudioTasks.value) {
      return
    }
    void refreshStudioRuntimeState()
  }, 3000)
})

onBeforeUnmount(() => {
  clearActionFeedback()
  clearSubmitButtonStateTimer()
  if (studioRuntimePollTimer) {
    clearInterval(studioRuntimePollTimer)
    studioRuntimePollTimer = null
  }
  clearAllDraftPersistTimers()
  Object.values(formDrafts.value).forEach((draft) => {
    revokeDraftPreviews(draft || {})
  })
})
</script>

<template>
  <main class="app-shell" :data-theme="activeTheme">
    <AppTopBar
      brand-label="秋 Ai"
      :theme-options="themeOptions"
      :active-theme="activeTheme"
      :activation-summary="activationSummary"
      @brand-click="handleBrandClick"
      @cleanup-click="handleClearRuntimeState"
      @theme-change="handleThemeChange"
    />

    <div v-if="actionNotice.visible" class="app-notice-layer" role="status" aria-live="polite">
      <div class="app-notice" :class="`app-notice--${actionNotice.type}`">
        <strong>{{ actionNotice.title }}</strong>
        <span>{{ actionNotice.message }}</span>
      </div>
    </div>

    <section
      v-if="isActivationLoading"
      class="activation-shell"
    >
      <ActivationGate
        :activation-state="activationState"
        :is-loading="true"
        @copy-device-code="handleCopyDeviceCode"
        @import-license="handleImportLicense"
        @refresh-license="loadActivationState"
      />
    </section>

    <section
      v-else-if="!isActivated"
      class="activation-shell"
    >
      <ActivationGate
        :activation-state="activationState"
        :is-loading="false"
        @copy-device-code="handleCopyDeviceCode"
        @import-license="handleImportLicense"
        @refresh-license="loadActivationState"
      />
    </section>

    <section v-else class="shell-grid">
      <aside class="shell-grid__sidebar">
        <WorkspaceSidebar
          :menu-items="menuItems"
          :active-menu="activeMenu"
          @menu-select="handleMenuSelect"
        />
      </aside>

      <section class="shell-grid__workspace">
        <DesignWorkspace
          :active-menu="activeMenu"
          :menu-label="currentMenuLabel"
          :draft-form="currentDraftForm"
          :model-options="currentModelOptions"
          :batch-options="batchOptions"
          :ratio-options="ratioOptions"
          :upload-directory-drafts="uploadDirectoryDrafts"
          :submit-button-state="submitButtonState"
          :long-running-hint="currentLongRunningHint"
          :model-pricing-catalog="modelPricingCatalog"
          :recharge-pricing-catalog="rechargePricingCatalog"
          :result-payload="resultPayload"
          :export-items="exportItems"
          :selected-export-ids="selectedExportIds"
          :latest-task="latestTaskForActiveMenu"
          :workspace-dashboard="workspaceDashboard"
          :host-info="hostInfo"
          :api-config-state="apiConfigDraft"
          :credit-adjustment-value="creditAdjustmentAmount"
          :total-credits-value="totalCreditAmount"
          :is-saving-api-config="isSavingApiConfig"
          :is-applying-credit-adjustment="isApplyingCreditAdjustment"
          :is-saving-total-credits="isSavingTotalCredits"
          :fixed-prompt-templates="fixedPromptTemplates"
          :custom-prompt-templates="customPromptTemplates"
          @update-field="handleFieldUpdate"
          @submit-task="handleSubmitTask"
          @toggle-export-item="handleToggleExportItem"
          @batch-download="handleBatchDownload"
          @select-single-image="handleOpenSingleImagePicker"
          @select-single-design-image="handleOpenSingleDesignImagePicker"
          @select-series-design-images="handleOpenSeriesDesignPicker"
          @select-series-generate-image="handleOpenSeriesGeneratePicker"
          @open-output-directory="handleOpenOutputDirectory"
          @update-api-key="handleApiKeyUpdate"
          @switch-api-key="handleSwitchApiKey"
          @save-api-config="handleSaveApiConfig"
          @update-credit-adjustment="handleCreditAdjustmentValueUpdate"
          @apply-credit-adjustment="handleApplyCreditAdjustment"
          @update-total-credits="handleTotalCreditValueUpdate"
          @save-total-credits="handleSaveTotalCredits"
          @save-prompt-template="handleSavePromptTemplate"
          @remove-prompt-template="handleRemovePromptTemplate"
          @update-upload-directory-draft="handleUploadDirectoryDraftUpdate"
          @save-upload-directory="handleSaveUploadDirectory"
        />
      </section>

      <aside class="shell-grid__tasks">
        <TaskManagerSidebar
          :tasks="sortedTasks"
          :active-menu="activeMenu"
          :menu-label="currentMenuLabel"
          :export-items="exportItems"
          :selected-export-ids="selectedExportIds"
          @toggle-export-item="handleToggleExportItem"
          @batch-download="handleBatchDownload"
          @open-output-directory="handleOpenOutputDirectory"
          @delete-export-item="handleDeleteExportItem"
        />
      </aside>
    </section>
  </main>
</template>
