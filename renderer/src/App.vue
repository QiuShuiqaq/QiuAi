<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AppTopBar from './components/AppTopBar.vue'
import WorkspaceSidebar from './components/WorkspaceSidebar.vue'
import DesignWorkspace from './components/DesignWorkspace.vue'
import TaskManagerSidebar from './components/TaskManagerSidebar.vue'
import {
  createStudioTask,
  deleteStudioExportItem,
  exportStudioResults,
  getSettings,
  getStudioSnapshot,
  openOutputDirectory,
  saveSettings,
  saveStudioDraft
} from './services/desktopBridge'

const themeOptions = [
  { label: '暗黑', value: 'dark' },
  { label: '明亮', value: 'light' },
  { label: '护眼', value: 'eye-care' }
]

const menuItems = [
  { key: 'workspace', label: '工作台' },
  { key: 'copywriting', label: '文案设计' },
  { key: 'single-image', label: '单图测试' },
  { key: 'single-design', label: '单图设计' },
  { key: 'series-design', label: '套图设计' },
  { key: 'series-generate', label: '套图生成' },
  { key: 'model-pricing', label: '模型价格' }
]

const copywritingModelOptions = [
  { label: 'gemini-3-pro', value: 'gemini-3-pro' },
  { label: 'gemini-3.1-pro', value: 'gemini-3.1-pro' }
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
  { name: 'nano-banana-2-4k-cl', credits: '3000 / 次', price: '¥0.15~¥0.3 / 次' },
  { name: 'nano-banana-pro-4k-vip', credits: '16000 / 次', price: '¥0.8~¥1.6 / 次' },
  { name: 'nano-banana', credits: '1400 / 次', price: '¥0.07~¥0.14 / 次' },
  { name: 'gemini-3-pro', credits: '按 token 计算', price: 'input: ¥1~¥2/M tokens / output: ¥6~¥12/M tokens' },
  { name: 'gemini-3.1-pro', credits: '按 token 计算', price: 'input: ¥1~¥2/M tokens / output: ¥6~¥12/M tokens' },
  { name: 'gemini-2.5-pro', credits: '按 token 计算', price: 'input: ¥1.25~¥2.5/M tokens / output: ¥6.25~¥12.5/M tokens' },
  { name: 'sora-create-character', credits: '200 / 次', price: '¥0.01~¥0.02 / 次' },
  { name: 'sora-upload-character', credits: '200 / 次', price: '¥0.01~¥0.02 / 次' },
  { name: 'gpt-image-2', credits: '600 / 次', price: '¥0.03~¥0.06 / 次' },
  { name: 'nano-banana-pro', credits: '1800 / 次', price: '¥0.09~¥0.18 / 次' },
  { name: 'nano-banana-fast', credits: '440 / 次', price: '¥0.022~¥0.044 / 次' },
  { name: 'nano-banana-2', credits: '1200 / 次', price: '¥0.06~¥0.12 / 次' },
  { name: 'nano-banana-pro-vt', credits: '1800 / 次', price: '¥0.09~¥0.18 / 次' },
  { name: 'nano-banana-pro-cl', credits: '6000 / 次', price: '¥0.3~¥0.6 / 次' },
  { name: 'nano-banana-2-cl', credits: '1600 / 次', price: '¥0.08~¥0.16 / 次' },
  { name: 'nano-banana-pro-vip', credits: '10000 / 次', price: '¥0.5~¥1 / 次' }
]

const batchOptions = [
  { label: '单批 4 个结果', value: 'batch-4' },
  { label: '单批 8 个结果', value: 'batch-8' },
  { label: '单批 12 个结果', value: 'batch-12' }
]

const ratioOptions = [
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' }
]

const activeTheme = ref('dark')
const activeMenu = ref('workspace')
const copywritingImageInput = ref(null)
const singleImageInput = ref(null)
const singleDesignImageInput = ref(null)
const seriesDesignImageInput = ref(null)
const seriesGenerateImageInput = ref(null)
const isSavingApiConfig = ref(false)
const selectedExportIds = ref([])
const submitButtonState = ref('idle')
const tasks = ref([])
const formDrafts = ref(createDefaultFormDrafts())
const resultsByMenu = ref(createEmptyResultsByMenu())
const exportItemsByMenu = ref(createEmptyExportItemsByMenu())
const workspaceDashboard = ref(createEmptyWorkspaceDashboard())
const hostInfo = ref(createEmptyHostInfo())
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
let actionNoticeTimer = null
let submitButtonStateTimer = null
let studioRuntimePollTimer = null
let isRefreshingStudioRuntime = false

function resolveDefaultModelForMenu(menuKey) {
  if (menuKey === 'copywriting') {
    return copywritingModelOptions[0].value
  }

  return imageModelOptions[0].value
}

function createImageAsset(file, idPrefix, preview = true) {
  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    path: file.path || '',
    sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} KB`,
    preview: preview ? URL.createObjectURL(file) : '',
    storedPath: ''
  }
}

function createSeriesGeneratePromptAssignments(count, existingAssignments = []) {
  const normalizedCount = Math.max(1, Math.min(20, Number(count) || 1))
  const sourceAssignments = Array.isArray(existingAssignments) ? existingAssignments : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    const currentAssignment = sourceAssignments[index] || {}

    return {
      id: currentAssignment.id || `series-generate-${index + 1}`,
      index: index + 1,
      prompt: currentAssignment.prompt || ''
    }
  })
}

function createDraftForm(menuKey) {
  if (menuKey === 'copywriting') {
    return {
      prompt: '请根据商品卖点批量生成文案',
      model: resolveDefaultModelForMenu(menuKey),
      taskName: '',
      copyMode: 'prompt-only',
      referenceImages: [],
      quantity: 5,
      creativity: 68
    }
  }

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
      generateCount: 4,
      promptAssignments: createSeriesGeneratePromptAssignments(4),
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

function createEmptyWorkspaceDashboard() {
  return {
    copywritingStats: createEmptyStatsCard('文案生成统计'),
    seriesDesignStats: createEmptyStatsCard('套图设计统计'),
    singleImageStats: createEmptyStatsCard('单图测试统计'),
    seriesGenerateStats: createEmptyStatsCard('套图生成统计')
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

function normalizeStoredDraft(menuKey, storedDraft = {}) {
  const normalizedDraft = {
    ...createDraftForm(menuKey),
    ...storedDraft
  }

  if (menuKey === 'series-generate') {
    const generateCount = Math.max(1, Math.min(20, Number(normalizedDraft.generateCount) || 1))
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
  const referenceImages = draft.referenceImages || []
  const imageAssignments = draft.imageAssignments || []

  referenceImages.forEach((item) => revokePreview(item.preview))
  imageAssignments.forEach((item) => revokePreview(item.preview))
  revokePreview(draft.sourceImage?.preview)
}

function replaceDraft(menuKey, nextDraft) {
  formDrafts.value = {
    ...formDrafts.value,
    [menuKey]: nextDraft
  }
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

const currentModelOptions = computed(() => {
  if (activeMenu.value === 'copywriting') {
    return copywritingModelOptions
  }

  return imageModelOptions
})

const sortedTasks = computed(() => {
  return [...tasks.value].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
})

const latestTaskForActiveMenu = computed(() => {
  const matchedTask = sortedTasks.value.find((task) => task.menuKey === activeMenu.value)
  return matchedTask || sortedTasks.value[0] || null
})

const resultPayload = computed(() => {
  return resultsByMenu.value[activeMenu.value] || resultsByMenu.value.workspace
})

const exportItems = computed(() => {
  return exportItemsByMenu.value[activeMenu.value] || exportItemsByMenu.value.workspace
})

const currentDraftForm = computed(() => {
  return formDrafts.value[activeMenu.value] || createDraftForm(activeMenu.value)
})

function applySnapshot(snapshot = {}, settings = {}, options = {}) {
  const {
    preserveDrafts = false,
    preserveApiConfig = false
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

async function refreshStudioRuntimeState() {
  if (isRefreshingStudioRuntime) {
    return
  }

  isRefreshingStudioRuntime = true

  try {
    await loadStudioSnapshot({
      preserveDrafts: true,
      preserveApiConfig: true
    })
  } finally {
    isRefreshingStudioRuntime = false
  }
}

function handleBrandClick() {
  // Logo 点击事件预留：后续可在这里接入返回首页或重置工作区逻辑。
  activeMenu.value = 'workspace'
}

async function handleThemeChange(nextTheme) {
  // 主题切换事件预留：后续可在这里接入本地存储或桌面端配置同步。
  activeTheme.value = nextTheme

  try {
    await saveSettings({
      themeMode: nextTheme
    })
  } catch (error) {
    console.error('Failed to persist theme', error)
  }
}

function handleWechatClick() {
  // 微信按钮点击事件预留：后续可在这里接入联系入口或二维码弹窗。
}

function ensureDraftForMenu(menuKey) {
  if (formDrafts.value[menuKey]) {
    return
  }

  replaceDraft(menuKey, createDraftForm(menuKey))
}

async function resetDraftForMenu(menuKey) {
  ensureDraftForMenu(menuKey)
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

function handleFieldUpdate({ field, value }) {
  ensureDraftForMenu(activeMenu.value)
  const currentDraft = currentDraftForm.value
  let nextDraft = {
    ...currentDraft,
    [field]: value
  }

  if (activeMenu.value === 'series-generate' && field === 'generateCount') {
    const generateCount = Math.max(1, Math.min(20, Number(value) || 1))
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
  void persistDraftPatch(activeMenu.value, nextDraft)
}

function handleOpenCopywritingImagePicker() {
  copywritingImageInput.value?.click()
}

function handleSelectCopywritingImages(event) {
  const fileList = Array.from(event?.target?.files || [])

  if (!fileList.length) {
    return
  }

  ensureDraftForMenu('copywriting')
  revokeDraftPreviews(formDrafts.value.copywriting)
  const referenceImages = fileList.map((file) => createImageAsset(file, 'copywriting-image'))
  const nextDraft = {
    ...formDrafts.value.copywriting,
    copyMode: 'image-reference',
    referenceImages
  }

  replaceDraft('copywriting', nextDraft)
  void persistDraftPatch('copywriting', {
    copyMode: 'image-reference',
    referenceImages
  })
  event.target.value = ''
}

function handleClearCopywritingImages() {
  ensureDraftForMenu('copywriting')
  revokeDraftPreviews(formDrafts.value.copywriting)
  const nextDraft = {
    ...formDrafts.value.copywriting,
    copyMode: 'prompt-only',
    referenceImages: []
  }

  replaceDraft('copywriting', nextDraft)
  void persistDraftPatch('copywriting', {
    copyMode: 'prompt-only',
    referenceImages: []
  })
}

function handleOpenSingleImagePicker() {
  singleImageInput.value?.click()
}

function handleSelectSingleImage(event) {
  const file = event?.target?.files?.[0]
  if (!file) {
    return
  }

  ensureDraftForMenu('single-image')
  revokePreview(formDrafts.value['single-image']?.sourceImage?.preview)
  const sourceImage = createImageAsset(file, 'single-image')
  const nextDraft = {
    ...formDrafts.value['single-image'],
    sourceImage
  }

  replaceDraft('single-image', nextDraft)
  void persistDraftPatch('single-image', {
    sourceImage
  })
  event.target.value = ''
}

function handleOpenSingleDesignImagePicker() {
  singleDesignImageInput.value?.click()
}

function handleSelectSingleDesignImage(event) {
  const file = event?.target?.files?.[0]
  if (!file) {
    return
  }

  ensureDraftForMenu('single-design')
  revokePreview(formDrafts.value['single-design']?.sourceImage?.preview)
  const sourceImage = createImageAsset(file, 'single-design')
  const nextDraft = {
    ...formDrafts.value['single-design'],
    sourceImage
  }

  replaceDraft('single-design', nextDraft)
  void persistDraftPatch('single-design', {
    sourceImage
  })
  event.target.value = ''
}

function handleOpenSeriesDesignPicker() {
  seriesDesignImageInput.value?.click()
}

function handleSelectSeriesDesignImages(event) {
  const fileList = Array.from(event?.target?.files || [])
  if (!fileList.length) {
    return
  }

  if (fileList.length > 30) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '套图设计一次最多上传 30 张图片'
    })
    event.target.value = ''
    return
  }

  ensureDraftForMenu('series-design')
  revokeDraftPreviews(formDrafts.value['series-design'])
  const imageAssignments = fileList.map((file) => ({
    ...createImageAsset(file, 'series-design'),
    selected: true,
    prompt: ''
  }))
  const nextDraft = {
    ...formDrafts.value['series-design'],
    imageAssignments
  }

  replaceDraft('series-design', nextDraft)
  void persistDraftPatch('series-design', {
    imageAssignments
  })
  event.target.value = ''
}

function handleOpenSeriesGeneratePicker() {
  seriesGenerateImageInput.value?.click()
}

function handleSelectSeriesGenerateImage(event) {
  const file = event?.target?.files?.[0]
  if (!file) {
    return
  }

  ensureDraftForMenu('series-generate')
  revokePreview(formDrafts.value['series-generate']?.sourceImage?.preview)
  const sourceImage = createImageAsset(file, 'series-generate')
  const nextDraft = {
    ...formDrafts.value['series-generate'],
    sourceImage
  }

  replaceDraft('series-generate', nextDraft)
  void persistDraftPatch('series-generate', {
    sourceImage
  })
  event.target.value = ''
}

function validateCurrentTaskBeforeSubmit() {
  const draft = currentDraftForm.value

  if (!String(draft.taskName || '').trim()) {
    return '请先输入任务名称'
  }

  if (activeMenu.value === 'copywriting') {
    if (!String(draft.prompt || '').trim()) {
      return '请先输入文案需求'
    }

    return ''
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
    const batchCount = Math.max(1, Number(draft.batchCount) || 1)

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

    if (selectedCount * batchCount > 20) {
      return '当前任务过重，请将“选中图片数 x 批次”控制在 20 以内'
    }

    return ''
  }

  if (activeMenu.value === 'series-generate') {
    const generateCount = Math.max(1, Math.min(20, Number(draft.generateCount) || 1))
    const promptAssignments = createSeriesGeneratePromptAssignments(generateCount, draft.promptAssignments)
    const totalCount = Math.max(1, Number(draft.batchCount) || 1) * generateCount

    if (!draft.sourceImage) {
      return '请先上传一张参考图'
    }

    if (!String(draft.globalPrompt || '').trim()) {
      return '请先输入套图生成的全局风格提示词'
    }

    if (promptAssignments.some((item) => !String(item.prompt || '').trim())) {
      return '请完整填写每一张图片的单独提示词'
    }

    if (totalCount > 20) {
      return '当前任务过重，请将“生成数量 x 批次”控制在 20 以内'
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
    await createStudioTask({
      menuKey: activeMenu.value,
      draft: formDrafts.value[activeMenu.value]
    })
    selectedExportIds.value = []
    await loadStudioSnapshot()
    await resetActiveDraftAfterSubmit()
    setSubmitButtonState('success')
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: '任务已提交并加入任务队列'
    })
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

onMounted(() => {
  void loadStudioSnapshot()
  studioRuntimePollTimer = window.setInterval(() => {
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
      @brand-click="handleBrandClick"
      @theme-change="handleThemeChange"
      @wechat-click="handleWechatClick"
    />

    <div v-if="actionNotice.visible" class="app-notice-layer" role="status" aria-live="polite">
      <div class="app-notice" :class="`app-notice--${actionNotice.type}`">
        <strong>{{ actionNotice.title }}</strong>
        <span>{{ actionNotice.message }}</span>
      </div>
    </div>

    <section class="shell-grid">
      <input
        ref="copywritingImageInput"
        class="visually-hidden"
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        multiple
        @change="handleSelectCopywritingImages"
      />
      <input
        ref="singleImageInput"
        class="visually-hidden"
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        @change="handleSelectSingleImage"
      />
      <input
        ref="singleDesignImageInput"
        class="visually-hidden"
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        @change="handleSelectSingleDesignImage"
      />
      <input
        ref="seriesDesignImageInput"
        class="visually-hidden"
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        multiple
        @change="handleSelectSeriesDesignImages"
      />
      <input
        ref="seriesGenerateImageInput"
        class="visually-hidden"
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        @change="handleSelectSeriesGenerateImage"
      />

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
          :submit-button-state="submitButtonState"
          :model-pricing-catalog="modelPricingCatalog"
          :result-payload="resultPayload"
          :export-items="exportItems"
          :selected-export-ids="selectedExportIds"
          :latest-task="latestTaskForActiveMenu"
          :workspace-dashboard="workspaceDashboard"
          :host-info="hostInfo"
          :api-config-state="apiConfigDraft"
          :is-saving-api-config="isSavingApiConfig"
          @update-field="handleFieldUpdate"
          @submit-task="handleSubmitTask"
          @toggle-export-item="handleToggleExportItem"
          @batch-download="handleBatchDownload"
          @select-copywriting-images="handleOpenCopywritingImagePicker"
          @clear-copywriting-images="handleClearCopywritingImages"
          @select-single-image="handleOpenSingleImagePicker"
          @select-single-design-image="handleOpenSingleDesignImagePicker"
          @select-series-design-images="handleOpenSeriesDesignPicker"
          @select-series-generate-image="handleOpenSeriesGeneratePicker"
          @open-output-directory="handleOpenOutputDirectory"
          @update-api-key="handleApiKeyUpdate"
          @switch-api-key="handleSwitchApiKey"
          @save-api-config="handleSaveApiConfig"
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
