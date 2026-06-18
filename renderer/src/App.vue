<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AppTopBar from './components/AppTopBar.vue'
import AdminPasswordDialog from './components/AdminPasswordDialog.vue'
import AdminApiKeyDialog from './components/AdminApiKeyDialog.vue'
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
  refreshDashboardCredits,
  getStudioSnapshot,
  importLicenseFile,
  listPromptTemplates,
  listNegativePromptTemplates,
  openOutputDirectory,
  pickStudioInputAssets,
  reloadActivation,
  removeNegativePromptTemplate,
  removePromptTemplate,
  saveAdminApiKey,
  saveNegativePromptTemplate,
  saveSettings,
  savePromptTemplate,
  saveStudioDraft,
  stopStudioTask
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
  { price: '30¥', credits: '100000积分', validity: '一周', bonus: '' },
  { price: '60¥', credits: '250000积分', validity: '一月', bonus: '送5%' },
  { price: '150¥', credits: '750000积分', validity: '一季', bonus: '送10%' },
  { price: '300¥', credits: '1600000积分', validity: '半年', bonus: '送10%' },
  { price: '1500¥', credits: '9000000积分', validity: '一年', bonus: '送10%' },
  { price: '3000¥', credits: '20000000积分', validity: '三年', bonus: '送100%' }
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
const seriesGroupConcurrency = ref(2)
const activeMenu = ref('workspace')
const downloadCleanupEnabled = ref(true)
const selectedExportIds = ref([])
const selectedExportIdsByMenu = ref(createEmptyExportSelectionsByMenu())
const submitButtonState = ref('idle')
const tasks = ref([])
const formDrafts = ref(createDefaultFormDrafts())
const resultsByMenu = ref(createEmptyResultsByMenu())
const exportItemsByMenu = ref(createEmptyExportItemsByMenu())
const previousExportItemsByMenu = ref(createEmptyExportItemsByMenu())
const workspaceDashboard = ref(createEmptyWorkspaceDashboard())
const hostInfo = ref(createEmptyHostInfo())
const promptTemplates = ref([])
const negativePromptTemplates = ref([])
const actionNotice = reactive({
  visible: false,
  type: 'success',
  title: '',
  message: ''
})
const uploadDirectoryDrafts = reactive(createEmptyUploadDirectoryDrafts())
const activationState = ref(createDefaultActivationState())
const isActivationLoading = ref(true)
const isRefreshingTotalCredits = ref(false)
const isRefreshingRemainingCredits = ref(false)
const adminLogoClickCount = ref(0)
const isAdminPasswordDialogVisible = ref(false)
const isAdminPasswordSubmitting = ref(false)
const adminPasswordDraft = ref('')
const isAdminApiConfigUnlocked = ref(false)
const isAdminApiKeyDialogVisible = ref(false)
const adminApiKeyDraft = ref('')
const isAdminApiKeySaving = ref(false)
const adminPasswordFeedback = ref('')
const adminApiKeyFeedback = ref('')
const isClearRuntimeConfirmVisible = ref(false)
const isClearingRuntimeState = ref(false)
const runtimeResetSequence = ref(0)
const previousTaskStatusMap = new Map()
let actionNoticeTimer = null
let submitButtonStateTimer = null
let studioRuntimePollTimer = null
let isRefreshingStudioRuntime = false
const draftPersistTimers = new Map()

const HIGH_RISK_PROMPT_PATTERNS = ['和原图一致', '保持原样', '不改动布局', '复刻原图', '完全一致', '不要变化']
const MEDIUM_RISK_PROMPT_PATTERNS = ['尽量不变', '保留原图风格', '轻微修改', '只改一点', '背景不动']
const TASK_SCALE_LIMITS = {
  'series-generate': {
    warn: 40,
    block: 120
  },
  'series-design': {
    warn: 30,
    block: 80
  }
}

const DEFAULT_EMPTY_PROMPT_TEMPLATE_ID = 'system-empty-image-type'
const DEFAULT_EMPTY_PROMPT_TEMPLATE_NAME = '无类型图片'

const DEFAULT_EMPTY_NEGATIVE_TEMPLATE_ID = 'system-empty-negative-prompt'
const DEFAULT_EMPTY_NEGATIVE_TEMPLATE_NAME = '无负向提示词'

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

function createImageAsset(file, idPrefix, preview = true) {
  const previewValue = typeof file.preview === 'string' ? file.preview : ''
  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    path: file.path || '',
    sizeLabel: `${Math.max(1, Math.round((Number(file.size) || 0) / 1024))} KB`,
    preview: preview
      ? (previewValue || (file instanceof File ? URL.createObjectURL(file) : ''))
      : '',
    storedPath: ''
  }
}

function normalizeBatchPrompts(batchPrompts = [], batchCount = 1) {
  const normalizedCount = Math.max(1, Number(batchCount) || 1)
  const sourcePrompts = Array.isArray(batchPrompts) ? batchPrompts : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    return String(sourcePrompts[index] || '')
  })
}

function createSeriesGeneratePromptAssignments(count, existingAssignments = [], batchCount = 1) {
  const normalizedCount = Math.max(1, Math.min(500, Number(count) || 1))
  const normalizedBatchCount = Math.max(1, Number(batchCount) || 1)
  const sourceAssignments = Array.isArray(existingAssignments) ? existingAssignments : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    const currentAssignment = sourceAssignments[index] || {}

    return {
      id: currentAssignment.id || `series-generate-${index + 1}`,
      index: index + 1,
      prompt: currentAssignment.prompt || '',
      templateId: currentAssignment.templateId || DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
      imageType: currentAssignment.imageType || '',
      differentialEnabled: currentAssignment.differentialEnabled === true,
      batchPrompts: normalizeBatchPrompts(currentAssignment.batchPrompts, normalizedBatchCount)
    }
  })
}

function normalizeSeriesGenerateAssignments(assignments = [], count = 1, batchCount = 1) {
  return createSeriesGeneratePromptAssignments(count, assignments, batchCount)
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
      globalPrompt: '围绕XXX统一商品视觉风格，保持XXX主体一致，画面干净专业',
      legacyGlobalPrompt: '',
      defaultAssignmentRatio: '1:1',
      defaultAssignmentModel: resolveDefaultModelForMenu(menuKey),
      model: resolveDefaultModelForMenu(menuKey),
      taskName: '',
      imageAssignments: [],
      batchCount: 1,
      size: '1:1'
    }
  }

  if (menuKey === 'series-generate') {
    return {
      globalPrompt: '围绕XXX统一商品详情图风格，突出XXX主体与卖点，适合电商展示',
      legacyGlobalPrompt: '',
      model: resolveDefaultModelForMenu(menuKey),
      taskName: '',
      sourceImage: null,
      generateCount: 1,
      promptAssignments: createSeriesGeneratePromptAssignments(1),
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

function createEmptyExportSelectionsByMenu() {
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

function ensureEmptyPromptTemplate(templates = []) {
  const sourceTemplates = Array.isArray(templates) ? templates : []
  const hasDefaultTemplate = sourceTemplates.some((template) => template?.id === DEFAULT_EMPTY_PROMPT_TEMPLATE_ID)
  if (hasDefaultTemplate) {
    return sourceTemplates
  }

  return [
    {
      id: DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
      name: DEFAULT_EMPTY_PROMPT_TEMPLATE_NAME,
      category: '系统提示词',
      prompt: '',
      source: 'system-fixed'
    },
    ...sourceTemplates
  ]
}

function ensureEmptyNegativePromptTemplate(templates = []) {
  const sourceTemplates = Array.isArray(templates) ? templates : []
  const hasDefaultTemplate = sourceTemplates.some((template) => template?.id === DEFAULT_EMPTY_NEGATIVE_TEMPLATE_ID)
  if (hasDefaultTemplate) {
    return sourceTemplates
  }

  return [
    {
      id: DEFAULT_EMPTY_NEGATIVE_TEMPLATE_ID,
      name: DEFAULT_EMPTY_NEGATIVE_TEMPLATE_NAME,
      category: '反向提示词',
      prompt: '',
      source: 'system-fixed'
    },
    ...sourceTemplates
  ]
}

function normalizeStoredDraft(menuKey, storedDraft = {}) {
  const normalizedDraft = {
    ...createDraftForm(menuKey),
    ...storedDraft
  }

  if (menuKey === 'series-design' || menuKey === 'series-generate') {
    normalizedDraft.legacyGlobalPrompt = String(normalizedDraft.legacyGlobalPrompt || '')
    normalizedDraft.globalPrompt = String(normalizedDraft.globalPrompt || '')
    normalizedDraft.negativeTemplateId = String(normalizedDraft.negativeTemplateId || DEFAULT_EMPTY_NEGATIVE_TEMPLATE_ID)
    normalizedDraft.negativePrompt = String(normalizedDraft.negativePrompt || '')
  }

  if (menuKey === 'series-generate') {
    const generateCount = Math.max(1, Math.min(500, Number(normalizedDraft.generateCount) || 1))
    normalizedDraft.generateCount = generateCount
    normalizedDraft.promptAssignments = createSeriesGeneratePromptAssignments(
      generateCount,
      normalizedDraft.promptAssignments,
      Math.max(1, Number(normalizedDraft.batchCount) || 1)
    )
  }

  return normalizedDraft
}

function normalizeSeriesDesignAssignments(assignments = [], batchCount = 1) {
  const normalizedBatchCount = Math.max(1, Number(batchCount) || 1)
  return (Array.isArray(assignments) ? assignments : []).map((assignment) => {
    return {
      ...assignment,
      templateId: assignment.templateId || DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
      imageType: assignment.imageType || '',
      differentialEnabled: assignment.differentialEnabled === true,
      batchPrompts: normalizeBatchPrompts(assignment.batchPrompts, normalizedBatchCount)
    }
  })
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

function buildTaskFailureFeedbackMessage(task = {}) {
  const rawError = String(task.error || '').trim()

  if (!rawError) {
    return '生图失败，请稍后重试或检查当前任务参数'
  }

  if (rawError.includes('杈撳嚭鍐呭瑙﹀彂瀹℃牳闄愬埗')) {
    return '生图失败：图片内容触发平台审核限制，请调整提示词、图片内容或生成方向后重试'
  }

  if (rawError.includes('杈撳叆鍐呭瑙﹀彂瀹℃牳闄愬埗')) {
    return '生图失败：提示词或输入内容触发平台审核限制，请修改提示词后重试'
  }

  if (rawError.includes('鍥剧墖浠诲姟鎵ц瓒呮椂')) {
    return '生图失败：本次生成超时，建议减少数量或拆分任务后重试'
  }

  if (rawError.includes('鍥剧墖浠诲姟闀挎椂闂存棤杩涘睍')) {
    return '生图失败：图片生成长时间没有进展，建议稍后重试'
  }

  if (rawError.includes('请先保存可用的 API-Key')) {
    return '生图失败：服务配置无效，请先检查并保存可用的 API-Key'
  }

  return `生图失败：${rawError}`
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

function handleFailedTaskNotifications(nextTasks = []) {
  const normalizedTasks = Array.isArray(nextTasks) ? nextTasks : []

  for (const task of normalizedTasks) {
    if (!task?.id) {
      continue
    }

    const previousStatus = previousTaskStatusMap.get(task.id)
    previousTaskStatusMap.set(task.id, task.status)

    if (task.status !== '失败') {
      continue
    }

    if (previousStatus === '失败') {
      continue
    }

    showActionFeedback({
      type: 'error',
      title: '失败',
      message: buildTaskFailureFeedbackMessage(task)
    })
  }
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

function syncSelectedExportIdsForMenu(menuKey) {
  const currentExportItems = exportItemsByMenu.value[menuKey] || []
  const previousItems = previousExportItemsByMenu.value[menuKey] || []
  const previousSelection = new Set(selectedExportIdsByMenu.value[menuKey] || [])
  const existingIds = new Set(previousItems.map((item) => item?.id).filter((itemId) => typeof itemId === 'string' && itemId.trim()))

  const nextSelectedIds = currentExportItems
    .map((item) => item?.id)
    .filter((itemId) => typeof itemId === 'string' && itemId.trim())
    .filter((itemId) => !existingIds.has(itemId) || previousSelection.has(itemId))

  selectedExportIdsByMenu.value = {
    ...selectedExportIdsByMenu.value,
    [menuKey]: nextSelectedIds
  }

  if (menuKey === activeMenu.value) {
    selectedExportIds.value = nextSelectedIds
  }
}

function syncAllSelectedExportIds() {
  menuItems.forEach((item) => {
    syncSelectedExportIdsForMenu(item.key)
  })

  previousExportItemsByMenu.value = Object.fromEntries(menuItems.map((item) => [
    item.key,
    Array.isArray(exportItemsByMenu.value[item.key]) ? [...exportItemsByMenu.value[item.key]] : []
  ]))
}

const fixedPromptTemplates = computed(() => {
  return promptTemplates.value.filter((item) => item.source === 'system-fixed')
})

const customPromptTemplates = computed(() => {
  return promptTemplates.value.filter((item) => item.source === 'custom')
})

const fixedNegativePromptTemplates = computed(() => {
  return negativePromptTemplates.value.filter((item) => item.source === 'system-fixed')
})

const customNegativePromptTemplates = computed(() => {
  return negativePromptTemplates.value.filter((item) => item.source === 'custom')
})

const allPromptTemplates = computed(() => {
  return [...fixedPromptTemplates.value, ...customPromptTemplates.value]
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

function resolveTaskScaleSummary(menuKey, draft = {}) {
  if (menuKey !== 'series-generate' && menuKey !== 'series-design') {
    return null
  }

  const limits = TASK_SCALE_LIMITS[menuKey]
  const totalOutputs = menuKey === 'series-generate'
    ? Math.max(1, Number(draft.generateCount) || 1) * Math.max(1, Number(draft.batchCount) || 1)
    : (
        (Array.isArray(draft.imageAssignments)
          ? draft.imageAssignments.filter((item) => item.selected !== false).length
          : 0) * Math.max(1, Number(draft.batchCount) || 1)
      )

  let level = 'safe'
  let levelLabel = '正常'
  if (totalOutputs > limits.block) {
    level = 'block'
    levelLabel = '禁止提交'
  } else if (totalOutputs > limits.warn) {
    level = 'warn'
    levelLabel = '谨慎提交'
  }

  const estimatedCredits = latestTaskForActiveMenu.value?.estimatedCredits && latestTaskForActiveMenu.value.menuKey === menuKey
    ? latestTaskForActiveMenu.value.estimatedCredits
    : 0

  return {
    totalOutputs,
    estimatedCredits,
    level,
    levelLabel
  }
}

const currentTaskScaleSummary = computed(() => {
  return resolveTaskScaleSummary(activeMenu.value, currentDraftForm.value)
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
  syncAllSelectedExportIds()
  tasks.value = Array.isArray(snapshot.tasks) ? snapshot.tasks : []
  handleFailedTaskNotifications(tasks.value)
  workspaceDashboard.value = {
    ...createEmptyWorkspaceDashboard(),
    ...(snapshot.workspaceDashboard || {})
  }
  hostInfo.value = {
    ...createEmptyHostInfo(),
    ...(snapshot.hostInfo || {})
  }
  activeTheme.value = settings.themeMode || snapshot.themeMode || 'dark'
  seriesGroupConcurrency.value = [2, 3, 4].includes(Number(settings.seriesGroupConcurrency))
    ? Number(settings.seriesGroupConcurrency)
    : 2
  downloadCleanupEnabled.value = settings.downloadCleanupEnabled !== false

  if (!preserveApiConfig) {
    adminApiKeyDraft.value = settings.apiKey || ''
  }

  if (!preserveUploadDirectoryDrafts) {
    const nextUploadDirectories = normalizeUploadDirectoryDrafts(settings.uploadDirectories)
    Object.assign(uploadDirectoryDrafts, nextUploadDirectories)
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
    promptTemplates.value = ensureEmptyPromptTemplate(await listPromptTemplates())
  } catch (error) {
    console.error('Failed to load prompt templates', error)
  }
}

async function loadNegativePromptTemplateState() {
  try {
    negativePromptTemplates.value = ensureEmptyNegativePromptTemplate(await listNegativePromptTemplates())
  } catch (error) {
    console.error('Failed to load negative prompt templates', error)
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
  adminLogoClickCount.value += 1

  if (adminLogoClickCount.value >= 5) {
    adminLogoClickCount.value = 0
    adminPasswordDraft.value = ''
    isAdminPasswordDialogVisible.value = true
  }
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
        loadPromptTemplateState(),
        loadNegativePromptTemplateState()
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
  // 涓婚鍒囨崲浜嬩欢棰勭暀锛氬悗缁彲鍦ㄨ繖閲屾帴鍏ユ湰鍦板瓨鍌ㄦ垨妗岄潰绔厤缃悓姝ャ€?
  activeTheme.value = 'dark'

  try {
    await saveSettings({
      themeMode: 'dark'
    })
  } catch (error) {
    console.error('Failed to persist theme', error)
  }
}

async function handleSeriesGroupConcurrencyChange(nextValue) {
  const normalizedValue = [2, 3, 4].includes(Number(nextValue)) ? Number(nextValue) : 2

  try {
    const savedSettings = await saveSettings({
      seriesGroupConcurrency: normalizedValue
    })
    seriesGroupConcurrency.value = [2, 3, 4].includes(Number(savedSettings.seriesGroupConcurrency))
      ? Number(savedSettings.seriesGroupConcurrency)
      : normalizedValue
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: `套图并发已切换到 ${seriesGroupConcurrency.value}`
    })
  } catch (error) {
    console.error('Failed to save series group concurrency', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `保存套图并发失败：${buildErrorMessage(error, '设置保存未完成')}`
    })
  }
}

function openClearRuntimeConfirm() {
  isClearRuntimeConfirmVisible.value = true
}

function closeClearRuntimeConfirm() {
  if (isClearingRuntimeState.value) {
    return
  }

  isClearRuntimeConfirmVisible.value = false
}

async function confirmClearRuntimeState() {
  isClearingRuntimeState.value = true

  try {
    clearAllDraftPersistTimers()
    Object.values(formDrafts.value).forEach((draft) => {
      revokeDraftPreviews(draft || {})
    })

    await clearStudioRuntimeState()
    runtimeResetSequence.value += 1
    selectedExportIds.value = []
    await loadStudioSnapshot()
    isClearRuntimeConfirmVisible.value = false
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
  } finally {
    isClearingRuntimeState.value = false
  }
}

function ensureDraftForMenu(menuKey) {
  if (formDrafts.value[menuKey]) {
    return
  }

  replaceDraft(menuKey, createDraftForm(menuKey))
}

function handleMenuSelect(menuKey) {
  // 鑿滃崟鐐瑰嚮浜嬩欢棰勭暀锛氬悗缁彲鍦ㄨ繖閲屾帴鍏ョ湡瀹炰笟鍔″伐浣滃尯鍒囨崲銆?
  activeMenu.value = menuKey
  ensureDraftForMenu(menuKey)
  selectedExportIds.value = [...(selectedExportIdsByMenu.value[menuKey] || [])]
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

function scheduleDraftPersist(menuKey, nextDraft) {
  clearDraftPersistTimer(menuKey)
  const timer = window.setTimeout(async () => {
    draftPersistTimers.delete(menuKey)
    await persistDraftPatch(menuKey, nextDraft)
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
    const generateCount = Math.max(1, Math.min(500, Number(value) || 1))
    const batchCount = Math.max(1, Number(currentDraft.batchCount) || 1)
    nextDraft = {
      ...currentDraft,
      generateCount,
      promptAssignments: createSeriesGeneratePromptAssignments(generateCount, currentDraft.promptAssignments, batchCount)
    }
  }

  if (activeMenu.value === 'series-generate' && field === 'batchCount') {
    const batchCount = Math.max(1, Number(value) || 1)
    nextDraft = {
      ...currentDraft,
      batchCount,
      promptAssignments: normalizeSeriesGenerateAssignments(
        currentDraft.promptAssignments,
        currentDraft.generateCount,
        batchCount
      )
    }
  }

  if (activeMenu.value === 'series-generate' && field === 'promptAssignments') {
    nextDraft = {
      ...currentDraft,
      promptAssignments: createSeriesGeneratePromptAssignments(
        currentDraft.generateCount,
        value,
        Math.max(1, Number(currentDraft.batchCount) || 1)
      )
    }
  }

  if (activeMenu.value === 'series-design' && field === 'batchCount') {
    const batchCount = Math.max(1, Number(value) || 1)
    nextDraft = {
      ...currentDraft,
      batchCount,
      imageAssignments: normalizeSeriesDesignAssignments(currentDraft.imageAssignments, batchCount)
    }
  }

  if (activeMenu.value === 'series-design' && field === 'imageAssignments') {
    nextDraft = {
      ...currentDraft,
      imageAssignments: normalizeSeriesDesignAssignments(value, Math.max(1, Number(currentDraft.batchCount) || 1))
    }
  }

  if ((activeMenu.value === 'series-design' || activeMenu.value === 'series-generate') && field === 'negativeTemplateId') {
    nextDraft = applyNegativeTemplateSelection(currentDraft, value)
  }

  replaceDraft(activeMenu.value, nextDraft)
  scheduleDraftPersist(activeMenu.value, nextDraft)
}

function applyNegativeTemplateSelection(currentDraft, templateId) {
  const matchedTemplate = [...fixedNegativePromptTemplates.value, ...customNegativePromptTemplates.value]
    .find((item) => item.id === templateId)
  return {
    ...currentDraft,
    negativeTemplateId: templateId,
    negativePrompt: matchedTemplate?.prompt || ''
  }
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
    imageType: '',
    size: formDrafts.value['series-design']?.defaultAssignmentRatio || formDrafts.value['series-design']?.size || '1:1',
    model: formDrafts.value['series-design']?.defaultAssignmentModel || formDrafts.value['series-design']?.model || '',
    templateId: DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
    differentialEnabled: false,
    batchPrompts: Array.from({ length: Math.max(1, Number(formDrafts.value['series-design']?.batchCount) || 1) }, () => ''),
    tagIds: [],
    tagNames: []
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
    const hasEmptySelectedPrompt = assignments.some((item) => {
      if (item.selected === false) {
        return false
      }

      if (item.differentialEnabled === true) {
        const batchPrompts = normalizeBatchPrompts(item.batchPrompts, Math.max(1, Number(draft.batchCount) || 1))
        return batchPrompts.some((prompt) => !String(prompt || '').trim())
      }

      return !String(item.prompt || '').trim()
    })

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

    return ''
  }

  if (activeMenu.value === 'series-generate') {
    const generateCount = Math.max(1, Math.min(500, Number(draft.generateCount) || 1))
    const promptAssignments = createSeriesGeneratePromptAssignments(
      generateCount,
      draft.promptAssignments,
      Math.max(1, Number(draft.batchCount) || 1)
    )

    if (!draft.sourceImage) {
      return '请先上传一张参考图'
    }

    if (!String(draft.globalPrompt || '').trim()) {
      return '请先输入套图生成的全局风格提示词'
    }

    if (promptAssignments.some((item) => {
      if (item.differentialEnabled === true) {
        const batchPrompts = normalizeBatchPrompts(item.batchPrompts, Math.max(1, Number(draft.batchCount) || 1))
        return batchPrompts.some((prompt) => !String(prompt || '').trim())
      }

      return !String(item.prompt || '').trim()
    })) {
      return '请完整填写每一张图片的单独提示词'
    }

  }

  return ''
}

function detectPromptRisk(promptText = '') {
  const normalizedPrompt = String(promptText || '')
  const highRiskKeyword = HIGH_RISK_PROMPT_PATTERNS.find((item) => normalizedPrompt.includes(item))
  if (highRiskKeyword) {
    return {
      level: 'warning',
      keyword: highRiskKeyword,
      message: `检测到高风险提示词“${highRiskKeyword}”，可能导致保留原图或生成失败`
    }
  }

  const mediumRiskKeyword = MEDIUM_RISK_PROMPT_PATTERNS.find((item) => normalizedPrompt.includes(item))
  if (mediumRiskKeyword) {
    return {
      level: 'warning',
      keyword: mediumRiskKeyword,
      message: `检测到风险提示词“${mediumRiskKeyword}”，可能导致保留原图或生成失败`
    }
  }

  return null
}

function notifyPromptRiskIfNeeded(promptText = '') {
  const promptRisk = detectPromptRisk(promptText)
  if (!promptRisk) {
    return
  }

  showActionFeedback({
    type: promptRisk.level,
    title: '提示',
    message: promptRisk.message
  })
}

function buildDraftForSubmit(menuKey) {
  const draft = normalizeStoredDraft(menuKey, currentDraftForm.value)

  if (menuKey === 'series-design' || menuKey === 'series-generate') {
    return {
      ...draft,
      globalPrompt: String(draft.globalPrompt || ''),
      negativeTemplateId: String(draft.negativeTemplateId || DEFAULT_EMPTY_NEGATIVE_TEMPLATE_ID),
      negativePrompt: String(draft.negativePrompt || ''),
      legacyGlobalPrompt: String(draft.legacyGlobalPrompt || '')
    }
  }

  return draft
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
    const draftToSubmit = buildDraftForSubmit(activeMenu.value)
    if (currentTaskScaleSummary.value?.level === 'block') {
      setSubmitButtonState('idle')
      showActionFeedback({
        type: 'error',
        title: '失败',
        message: '当前任务量过大，请拆分后再提交'
      })
      return
    }
    const promptRisk = detectPromptRisk(draftToSubmit.globalPrompt)
    if (promptRisk) {
      showActionFeedback({
        type: promptRisk.level,
        title: '提示',
        message: promptRisk.message
      })
    }
    const createdTask = await createStudioTask({
      menuKey: activeMenu.value,
      draft: draftToSubmit
    })
    upsertTaskIntoState(createdTask)
    selectedExportIds.value = []
    selectedExportIdsByMenu.value = {
      ...selectedExportIdsByMenu.value,
      [activeMenu.value]: []
    }
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
    selectedExportIdsByMenu.value = {
      ...selectedExportIdsByMenu.value,
      [activeMenu.value]: selectedExportIds.value
    }
    return
  }

  selectedExportIds.value = [...selectedExportIds.value, itemId]
  selectedExportIdsByMenu.value = {
    ...selectedExportIdsByMenu.value,
    [activeMenu.value]: selectedExportIds.value
  }
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
    const exportedIds = [...selectedExportIds.value]
    const exportedArchive = await exportStudioResults({
      menuKey: activeMenu.value,
      selectedExportIds: exportedIds
    })

    if (exportedArchive?.canceled) {
      showActionFeedback({
        type: 'error',
        title: '失败',
        message: '批量下载失败：已取消保存'
      })
      return
    }

    if (downloadCleanupEnabled.value) {
      const cleanupResults = await Promise.allSettled(exportedIds.map((exportItemId) => deleteStudioExportItem({
        menuKey: activeMenu.value,
        exportItemId
      })))
      const hasCleanupFailure = cleanupResults.some((result) => result.status === 'rejected')
      selectedExportIds.value = []
      selectedExportIdsByMenu.value = {
        ...selectedExportIdsByMenu.value,
        [activeMenu.value]: []
      }
      await loadStudioSnapshot({
        preserveDrafts: true,
        preserveApiConfig: true,
        preserveUploadDirectoryDrafts: true
      })
      showActionFeedback({
        type: hasCleanupFailure ? 'error' : 'success',
        title: hasCleanupFailure ? '失败' : '成功',
        message: hasCleanupFailure
          ? '批量下载成功，但部分结果文件夹自动清理失败'
          : '批量下载成功，源结果文件夹已自动删除'
      })
      return
    }

    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '批量下载成功，请确认压缩包完整后再手动清理源结果文件夹'
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
    selectedExportIdsByMenu.value = {
      ...selectedExportIdsByMenu.value,
      [activeMenu.value]: selectedExportIds.value
    }
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

function handleCloseAdminPasswordDialog() {
  isAdminPasswordDialogVisible.value = false
  isAdminPasswordSubmitting.value = false
  isAdminApiConfigUnlocked.value = false
  isAdminApiKeyDialogVisible.value = false
  adminPasswordDraft.value = ''
  adminPasswordFeedback.value = ''
  adminApiKeyFeedback.value = ''
}

function handleConfirmAdminPassword() {
  isAdminPasswordSubmitting.value = true
  adminPasswordFeedback.value = ''

  if (adminPasswordDraft.value !== 'qiuai@123') {
    isAdminPasswordSubmitting.value = false
    adminPasswordFeedback.value = '密码错误，请重新输入'
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '管理员验证失败：密码错误'
    })
    return
  }

  isAdminPasswordSubmitting.value = false
  isAdminPasswordDialogVisible.value = false
  isAdminApiConfigUnlocked.value = true
  isAdminApiKeyDialogVisible.value = true
  adminApiKeyFeedback.value = '管理员验证通过，请继续保存 API-Key'
  showActionFeedback({
    type: 'success',
    title: '成功',
    message: '管理员验证通过，请继续保存 API-Key'
  })
}

function handleCloseAdminApiKeyDialog() {
  isAdminApiKeyDialogVisible.value = false
  isAdminApiConfigUnlocked.value = false
  adminPasswordDraft.value = ''
  adminPasswordFeedback.value = ''
  adminApiKeyFeedback.value = ''
}

async function handleSaveAdminApiKey() {
  isAdminApiKeySaving.value = true
  adminApiKeyFeedback.value = ''

  try {
    const savedSettings = await saveAdminApiKey({
      apiKey: adminApiKeyDraft.value,
      password: adminPasswordDraft.value
    })

    adminApiKeyDraft.value = savedSettings.apiKey || ''
    isAdminApiConfigUnlocked.value = true
    adminApiKeyFeedback.value = 'API-Key 已保存成功'
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: 'API-Key 已保存成功'
    })
  } catch (error) {
    console.error('Failed to save admin api key', error)
    adminApiKeyFeedback.value = buildErrorMessage(error, '保存未完成')
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `管理员保存 API-Key 失败：${buildErrorMessage(error, '保存未完成')}`
    })
  } finally {
    isAdminApiKeySaving.value = false
  }
}

async function handleToggleDownloadCleanup(value) {
  try {
    const savedSettings = await saveSettings({
      downloadCleanupEnabled: value
    })
    downloadCleanupEnabled.value = savedSettings.downloadCleanupEnabled !== false
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: downloadCleanupEnabled.value ? '已开启下载后自动清理' : '已关闭下载后自动清理'
    })
  } catch (error) {
    console.error('Failed to save download cleanup preference', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `保存下载清理设置失败：${buildErrorMessage(error, '设置保存未完成')}`
    })
  }
}

async function handleStopTask(task) {
  if (!task?.id) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '结束任务失败：未找到可结束的任务'
    })
    return
  }

  const shouldStop = typeof window !== 'undefined' && typeof window.confirm === 'function'
    ? window.confirm('确认结束这个任务吗？结束后任务将标记为失败，已冻结积分会返还，已生成结果会保留。')
    : true

  if (!shouldStop) {
    return
  }

  try {
    await stopStudioTask({
      taskId: task.id
    })
    await loadStudioSnapshot({
      preserveDrafts: true,
      preserveApiConfig: true,
      preserveUploadDirectoryDrafts: true
    })
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '任务已结束'
    })
  } catch (error) {
    console.error('Failed to stop studio task', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `结束任务失败：${buildErrorMessage(error, '任务结束未完成')}`
    })
  }
}

async function handleRefreshDashboardTotalCredits() {
  isRefreshingTotalCredits.value = true

  try {
    await refreshDashboardCredits({
      target: 'total'
    })
    await loadStudioSnapshot({
      preserveDrafts: true,
      preserveApiConfig: true,
      preserveUploadDirectoryDrafts: true
    })
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '总积分已更新'
    })
  } catch (error) {
    console.error('Failed to refresh dashboard total credits', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `更新总积分失败：${buildErrorMessage(error, '已保留上次成功值')}`
    })
  } finally {
    isRefreshingTotalCredits.value = false
  }
}

async function handleRefreshDashboardRemainingCredits() {
  isRefreshingRemainingCredits.value = true

  try {
    await refreshDashboardCredits({
      target: 'remaining'
    })
    await loadStudioSnapshot({
      preserveDrafts: true,
      preserveApiConfig: true,
      preserveUploadDirectoryDrafts: true
    })
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '剩余积分已更新'
    })
  } catch (error) {
    console.error('Failed to refresh dashboard remaining credits', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `更新剩余积分失败：${buildErrorMessage(error, '已保留上次成功值')}`
    })
  } finally {
    isRefreshingRemainingCredits.value = false
  }
}

async function handleSavePromptTemplate(payload) {
  try {
    await savePromptTemplate(payload)
    await loadPromptTemplateState()
    notifyPromptRiskIfNeeded(payload.prompt)
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

async function handleSaveNegativePromptTemplate(payload) {
  try {
    await saveNegativePromptTemplate(payload)
    await loadNegativePromptTemplateState()
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '反向提示词模板已保存'
    })
  } catch (error) {
    console.error('Failed to save negative prompt template', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `反向提示词模板保存失败：${buildErrorMessage(error, '模板保存未完成')}`
    })
  }
}

async function handleRemoveNegativePromptTemplate(templateId) {
  try {
    await removeNegativePromptTemplate({
      id: templateId
    })
    await loadNegativePromptTemplateState()
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '反向提示词模板已删除'
    })
  } catch (error) {
    console.error('Failed to remove negative prompt template', error)
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `反向提示词模板删除失败：${buildErrorMessage(error, '模板删除未完成')}`
    })
  }
}

onMounted(() => {
  void (async () => {
    await loadActivationState()
    if (isActivated.value) {
      await Promise.all([
        loadStudioSnapshot(),
        loadPromptTemplateState(),
        loadNegativePromptTemplateState()
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
      brand-label="QiuAi"
      :theme-options="themeOptions"
      :active-theme="activeTheme"
      :activation-summary="activationSummary"
      :series-group-concurrency="seriesGroupConcurrency"
      @brand-click="handleBrandClick"
      @cleanup-click="openClearRuntimeConfirm"
      @series-group-concurrency-change="handleSeriesGroupConcurrencyChange"
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
          :task-scale-summary="currentTaskScaleSummary"
          :model-pricing-catalog="modelPricingCatalog"
          :recharge-pricing-catalog="rechargePricingCatalog"
          :result-payload="resultPayload"
          :export-items="exportItems"
          :selected-export-ids="selectedExportIds"
          :latest-task="latestTaskForActiveMenu"
          :workspace-dashboard="workspaceDashboard"
          :host-info="hostInfo"
          :is-refreshing-total-credits="isRefreshingTotalCredits"
          :is-refreshing-remaining-credits="isRefreshingRemainingCredits"
          :runtime-reset-sequence="runtimeResetSequence"
          :is-clear-runtime-confirm-visible="isClearRuntimeConfirmVisible"
          :is-clearing-runtime-state="isClearingRuntimeState"
          :fixed-prompt-templates="fixedPromptTemplates"
          :custom-prompt-templates="customPromptTemplates"
          :fixed-negative-prompt-templates="fixedNegativePromptTemplates"
          :custom-negative-prompt-templates="customNegativePromptTemplates"
          :all-prompt-templates="allPromptTemplates"
          @update-field="handleFieldUpdate"
          @submit-task="handleSubmitTask"
          @toggle-export-item="handleToggleExportItem"
          @batch-download="handleBatchDownload"
          @select-single-image="handleOpenSingleImagePicker"
          @select-single-design-image="handleOpenSingleDesignImagePicker"
          @select-series-design-images="handleOpenSeriesDesignPicker"
          @select-series-generate-image="handleOpenSeriesGeneratePicker"
          @open-output-directory="handleOpenOutputDirectory"
          @refresh-total-credits="handleRefreshDashboardTotalCredits"
          @refresh-remaining-credits="handleRefreshDashboardRemainingCredits"
          @save-prompt-template="handleSavePromptTemplate"
          @remove-prompt-template="handleRemovePromptTemplate"
          @save-negative-prompt-template="handleSaveNegativePromptTemplate"
          @remove-negative-prompt-template="handleRemoveNegativePromptTemplate"
          @confirm-clear-runtime-state="confirmClearRuntimeState"
          @close-clear-runtime-confirm="closeClearRuntimeConfirm"
          @update-upload-directory-draft="handleUploadDirectoryDraftUpdate"
          @save-upload-directory="handleSaveUploadDirectory"
        />
      </section>

      <AdminPasswordDialog
        :visible="isAdminPasswordDialogVisible"
        :password="adminPasswordDraft"
        :is-submitting="isAdminPasswordSubmitting"
        :feedback-message="adminPasswordFeedback"
        @update-password="adminPasswordDraft = $event"
        @confirm="handleConfirmAdminPassword"
        @close="handleCloseAdminPasswordDialog"
      />

      <AdminApiKeyDialog
        :visible="isAdminApiConfigUnlocked && isAdminApiKeyDialogVisible"
        :api-key="adminApiKeyDraft"
        :is-saving="isAdminApiKeySaving"
        :feedback-message="adminApiKeyFeedback"
        @update-api-key="adminApiKeyDraft = $event"
        @save="handleSaveAdminApiKey"
        @close="handleCloseAdminApiKeyDialog"
      />

      <aside class="shell-grid__tasks">
        <TaskManagerSidebar
          :tasks="sortedTasks"
          :active-menu="activeMenu"
          :menu-label="currentMenuLabel"
          :export-items="exportItems"
          :selected-export-ids="selectedExportIds"
          :download-cleanup-enabled="downloadCleanupEnabled"
          @toggle-export-item="handleToggleExportItem"
          @batch-download="handleBatchDownload"
          @open-output-directory="handleOpenOutputDirectory"
          @delete-export-item="handleDeleteExportItem"
          @toggle-download-cleanup="handleToggleDownloadCleanup"
          @stop-task="handleStopTask"
        />
      </aside>
    </section>
  </main>
</template>

