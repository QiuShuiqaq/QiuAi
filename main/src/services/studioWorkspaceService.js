const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const os = require('node:os')
const { pathToFileURL } = require('node:url')
const { exportTaskDirectory: defaultExportTaskDirectory } = require('./taskExportService')
const { createStudioImageGenerationService, normalizeSingleImageModels } = require('./studioImageGenerationService')
const {
  ensureDirectory,
  getTaskDataDirectories,
  OUTPUT_ROOT_DIRECTORY,
  getFeatureDirectoryKey
} = require('./dataPathsService')
const { persistSourceFiles } = require('./inputAssetStorageService')

const STUDIO_WORKSPACE_KEY = 'studioWorkspace'

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const themeOptions = [
  { label: '暗黑', value: 'dark' },
  { label: '明亮', value: 'light' },
  { label: '护眼', value: 'eye-care' }
]

const menuItems = [
  { key: 'workspace', label: '工作台' },
  { key: 'single-image', label: '单图测试' },
  { key: 'single-design', label: '单图设计' },
  { key: 'series-design', label: '套图设计' },
  { key: 'series-generate', label: '套图生成' },
  { key: 'model-pricing', label: '模型价格' }
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

const batchOptions = [
  { label: '单批 4 个结果', value: 'batch-4' },
  { label: '单批 8 个结果', value: 'batch-8' },
  { label: '单批 12 个结果', value: 'batch-12' }
]

const menuLabelMap = Object.fromEntries(menuItems.map((item) => [item.key, item.label]))
const taskCategoryMap = {
  workspace: '单图测试',
  'single-image': '单图测试',
  'single-design': '单图设计',
  'series-design': '套图设计',
  'series-generate': '套图生成',
  'model-pricing': '单图测试'
}
const taskMenuMapByCategory = {
  单图测试: 'single-image',
  单图设计: 'single-design',
  套图设计: 'series-design',
  套图生成: 'series-generate'
}
const workspaceDashboardSections = [
  { cardKey: 'singleImageStats', menuKey: 'single-image', title: '单图测试统计' },
  { cardKey: 'seriesDesignStats', menuKey: 'series-design', title: '套图设计统计' },
  { cardKey: 'singleDesignStats', menuKey: 'single-design', title: '单图设计统计' },
  { cardKey: 'seriesGenerateStats', menuKey: 'series-generate', title: '套图生成统计' }
]

function getModelOptionsByMenu() {
  return imageModelOptions
}

function resolveDefaultModelForMenu() {
  const modelOptions = getModelOptionsByMenu()
  return modelOptions[0]?.value || 'gpt-image-2'
}

async function safeRuntimeLog (runtimeLogger, payload) {
  if (!runtimeLogger || typeof runtimeLogger.log !== 'function') {
    return
  }

  try {
    await runtimeLogger.log(payload)
  } catch {
    // 运行日志失败不影响主流程。
  }
}

function normalizeImageAsset(item = {}) {
  if (!item || !item.name) {
    return null
  }

  return {
    id: item.id || '',
    name: item.name,
    path: item.path || '',
    preview: item.preview || '',
    sizeLabel: item.sizeLabel || '',
    storedPath: item.storedPath || ''
  }
}

function normalizeImageAssignments(assignments = []) {
  return Array.isArray(assignments)
    ? assignments
      .map((item, index) => {
        const normalizedAsset = normalizeImageAsset(item)
        if (!normalizedAsset) {
          return null
        }

        return {
          ...normalizedAsset,
          id: item.id || `series-design-${index + 1}`,
          selected: item.selected !== false,
          prompt: item.prompt || '',
          imageType: item.imageType || ''
        }
      })
      .filter(Boolean)
    : []
}

function normalizePromptAssignments(promptAssignments = [], count = 1) {
  const normalizedCount = Math.max(1, Math.min(20, Number(count) || 1))
  const sourceAssignments = Array.isArray(promptAssignments) ? promptAssignments : []

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

function normalizeCompareModels(compareModels = []) {
  return normalizeSingleImageModels(compareModels)
}

function normalizeDraftForMenu(menuKey, draft = {}) {
  const defaultDraft = createDefaultDrafts()[menuKey] || {}
  const allowedModels = new Set(getModelOptionsByMenu(menuKey).map((item) => item.value))
  const preferredDraftModel = draft.model
  const nextModel = allowedModels.has(preferredDraftModel)
    ? preferredDraftModel
    : (defaultDraft.model || resolveDefaultModelForMenu(menuKey))

  if (menuKey === 'single-image') {
    return {
      ...defaultDraft,
      ...draft,
      model: nextModel,
      taskName: String(draft.taskName || defaultDraft.taskName || ''),
      sourceImage: normalizeImageAsset(draft.sourceImage) || defaultDraft.sourceImage,
      compareModels: normalizeCompareModels(draft.compareModels),
      quantity: 1,
      notes: draft.notes || '',
      size: draft.size || defaultDraft.size
    }
  }

  if (menuKey === 'single-design') {
    return {
      ...defaultDraft,
      ...draft,
      model: nextModel,
      taskName: String(draft.taskName || defaultDraft.taskName || ''),
      sourceImage: normalizeImageAsset(draft.sourceImage) || defaultDraft.sourceImage,
      quantity: 1,
      notes: draft.notes || '',
      size: draft.size || defaultDraft.size
    }
  }

  if (menuKey === 'series-design') {
    return {
      ...defaultDraft,
      ...draft,
      model: nextModel,
      taskName: String(draft.taskName || defaultDraft.taskName || ''),
      globalPrompt: draft.globalPrompt || '',
      imageAssignments: normalizeImageAssignments(draft.imageAssignments),
      batchCount: Math.max(1, Number(draft.batchCount) || defaultDraft.batchCount || 1),
      size: draft.size || defaultDraft.size
    }
  }

  if (menuKey === 'series-generate') {
    const generateCount = Math.max(1, Math.min(20, Number(draft.generateCount) || defaultDraft.generateCount || 1))
    return {
      ...defaultDraft,
      ...draft,
      model: nextModel,
      taskName: String(draft.taskName || defaultDraft.taskName || ''),
      sourceImage: normalizeImageAsset(draft.sourceImage) || defaultDraft.sourceImage,
      globalPrompt: draft.globalPrompt || '',
      generateCount,
      promptAssignments: normalizePromptAssignments(draft.promptAssignments, generateCount),
      batchCount: Math.max(1, Number(draft.batchCount) || defaultDraft.batchCount || 1),
      size: draft.size || defaultDraft.size
    }
  }

  return {
    ...defaultDraft,
    ...draft,
    model: nextModel
  }
}

function formatDisplayDateTime(dateValue) {
  const date = new Date(dateValue)
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ]
  const timeParts = [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0')
  ]
  return `${parts.join('-')} ${timeParts.join(':')}`
}

function createPreviewUrlFromSavedPath(savedPath = '') {
  if (!savedPath) {
    return ''
  }

  try {
    return pathToFileURL(path.resolve(savedPath)).href
  } catch {
    return ''
  }
}

function hydratePreviewForDisplay(item = {}) {
  return {
    ...item,
    preview: item.preview || createPreviewUrlFromSavedPath(item.savedPath)
  }
}

function hydrateResultPayloadForDisplay(resultPayload = {}) {
  return {
    ...resultPayload,
    comparisonResults: Array.isArray(resultPayload.comparisonResults)
      ? resultPayload.comparisonResults.map((item) => hydratePreviewForDisplay(item))
      : [],
    groupedResults: Array.isArray(resultPayload.groupedResults)
      ? resultPayload.groupedResults.map((group) => ({
          ...group,
          outputs: Array.isArray(group.outputs)
            ? group.outputs.map((item) => hydratePreviewForDisplay(item))
            : []
        }))
      : []
  }
}

function hydrateResultsByMenuForDisplay(resultsByMenu = {}) {
  return Object.fromEntries(Object.entries(resultsByMenu).map(([menuKey, resultPayload]) => {
    return [menuKey, hydrateResultPayloadForDisplay(resultPayload)]
  }))
}

function createDefaultDrafts() {
  return {
    workspace: {
      prompt: '',
      model: resolveDefaultModelForMenu('single-image')
    },
    'single-image': {
      prompt: '保持产品主体不变，优化光影与质感',
      model: resolveDefaultModelForMenu('single-image'),
      taskName: '',
      sourceImage: null,
      compareModels: ['nano-banana-fast', 'gpt-image-2', 'nano-banana-2', 'nano-banana-2-cl'],
      quantity: 1,
      size: '1:1',
      notes: ''
    },
    'single-design': {
      prompt: '生成一张适合电商展示的高质量商品图',
      model: resolveDefaultModelForMenu('single-design'),
      taskName: '',
      sourceImage: null,
      quantity: 1,
      size: '1:1',
      notes: ''
    },
    'series-design': {
      globalPrompt: '统一套图风格与商品调性',
      model: resolveDefaultModelForMenu('series-design'),
      taskName: '',
      imageAssignments: [],
      batchCount: 1,
      size: '1:1'
    },
    'series-generate': {
      globalPrompt: '统一商品详情图整体风格',
      model: resolveDefaultModelForMenu('series-generate'),
      taskName: '',
      sourceImage: null,
      generateCount: 4,
      promptAssignments: normalizePromptAssignments([], 4),
      batchCount: 1,
      size: '1:1'
    },
    'model-pricing': {
      prompt: '',
      model: resolveDefaultModelForMenu('single-image')
    }
  }
}

function createDefaultResultsByMenu() {
  return {
    workspace: {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'single-image': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'single-design': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'series-design': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'series-generate': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'model-pricing': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    }
  }
}

function createDefaultExportItemsByMenu() {
  return Object.fromEntries(menuItems.map((item) => [
    item.key,
    []
  ]))
}

function createDefaultTasks() {
  return []
}

function createDefaultState() {
  return {
    formDrafts: createDefaultDrafts(),
    resultsByMenu: createDefaultResultsByMenu(),
    exportItemsByMenu: createDefaultExportItemsByMenu(),
    tasks: createDefaultTasks()
  }
}

function listDirectoryEntriesSync(directoryPath, {
  readdirSync = fsSync.readdirSync
} = {}) {
  try {
    return readdirSync(directoryPath, { withFileTypes: true })
  } catch {
    return []
  }
}

function statDirectorySync(directoryPath, {
  statSync = fsSync.statSync
} = {}) {
  try {
    return statSync(directoryPath)
  } catch {
    return null
  }
}

function buildScannedExportItemId({ menuKey, outputRootDirectory, directoryPath }) {
  const relativePath = path.relative(outputRootDirectory, directoryPath).replace(/\\/g, '/')
  return `${menuKey}:${relativePath}`
}

function resolveExportItemIdentity(item = {}) {
  return item.directoryPath || item.outputDirectory || item.savedPath || item.name || item.id || ''
}

function scanStoredExportItemsByMenu({
  outputRootDirectory = OUTPUT_ROOT_DIRECTORY,
  readdirSync = fsSync.readdirSync,
  statSync = fsSync.statSync
} = {}) {
  const exportItemsByMenu = createDefaultExportItemsByMenu()
  const supportedMenuKeys = ['single-image', 'single-design', 'series-design', 'series-generate']

  for (const menuKey of supportedMenuKeys) {
    const featureRootDirectory = path.resolve(outputRootDirectory, getFeatureDirectoryKey(menuKey))
    const taskEntries = listDirectoryEntriesSync(featureRootDirectory, { readdirSync })
      .filter((entry) => entry.isDirectory())
    const scannedItems = []

    for (const taskEntry of taskEntries) {
      const taskDirectory = path.resolve(featureRootDirectory, taskEntry.name)
      const groupEntries = listDirectoryEntriesSync(taskDirectory, { readdirSync })
        .filter((entry) => entry.isDirectory())

      for (const groupEntry of groupEntries) {
        const groupDirectory = path.resolve(taskDirectory, groupEntry.name)
        const groupStats = statDirectorySync(groupDirectory, { statSync })
        const itemCount = listDirectoryEntriesSync(groupDirectory, { readdirSync }).length

        scannedItems.push({
          ...createFolderExportItem({
            id: buildScannedExportItemId({
              menuKey,
              outputRootDirectory,
              directoryPath: groupDirectory
            }),
            name: groupEntry.name,
            directoryPath: groupDirectory,
            itemCount,
            groupTitle: groupEntry.name
          }),
          updatedAt: groupStats?.mtime?.toISOString?.() || ''
        })
      }
    }

    exportItemsByMenu[menuKey] = scannedItems.sort((left, right) => {
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0
      return rightTime - leftTime || String(left.name || '').localeCompare(String(right.name || ''))
    })
  }

  return exportItemsByMenu
}

function mergeExportItemsByMenu({
  scannedExportItemsByMenu,
  storedExportItemsByMenu
}) {
  const mergedExportItemsByMenu = createDefaultExportItemsByMenu()

  for (const menuKey of Object.keys(mergedExportItemsByMenu)) {
    const mergedItems = []
    const seenIdentities = new Set()

    for (const item of scannedExportItemsByMenu[menuKey] || []) {
      const identity = resolveExportItemIdentity(item)
      if (!identity || seenIdentities.has(identity)) {
        continue
      }

      seenIdentities.add(identity)
      mergedItems.push(item)
    }

    for (const item of storedExportItemsByMenu[menuKey] || []) {
      const identity = resolveExportItemIdentity(item)
      if (!identity || seenIdentities.has(identity)) {
        continue
      }

      seenIdentities.add(identity)
      mergedItems.push(item)
    }

    mergedExportItemsByMenu[menuKey] = mergedItems
  }

  return mergedExportItemsByMenu
}

function mergeStudioState(savedState = {}) {
  const defaultState = createDefaultState()
  const mergedFormDrafts = {
    ...defaultState.formDrafts,
    ...(savedState.formDrafts || {})
  }
  const normalizedFormDrafts = Object.fromEntries(menuItems.map((item) => {
    return [
      item.key,
      normalizeDraftForMenu(item.key, mergedFormDrafts[item.key] || {})
    ]
  }))

  return {
    formDrafts: normalizedFormDrafts,
    resultsByMenu: Object.fromEntries(menuItems.map((item) => {
      return [
        item.key,
        {
          ...(defaultState.resultsByMenu[item.key] || {}),
          ...((savedState.resultsByMenu || {})[item.key] || {})
        }
      ]
    })),
    exportItemsByMenu: Object.fromEntries(menuItems.map((item) => {
      return [
        item.key,
        Array.isArray((savedState.exportItemsByMenu || {})[item.key])
          ? (savedState.exportItemsByMenu || {})[item.key]
          : (defaultState.exportItemsByMenu[item.key] || [])
      ]
    })),
    tasks: Array.isArray(savedState.tasks) ? savedState.tasks : defaultState.tasks
  }
}

function sortTasks(tasks = []) {
  return [...tasks].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

function resolveTaskMenuKey(task = {}) {
  if (task.menuKey && menuLabelMap[task.menuKey]) {
    return task.menuKey
  }

  return taskMenuMapByCategory[task.category] || ''
}

function countStoredResults(exportItems = []) {
  return exportItems.filter((item) => {
    return item && (item.savedPath || item.directoryPath || item.outputDirectory || item.status === '已存储')
  }).length
}

function countCurrentResults(resultPayload = {}) {
  const groupedResultCount = (resultPayload.groupedResults || []).reduce((total, group) => {
    return total + (group.outputs || []).length
  }, 0)

  return (resultPayload.textResults || []).length + (resultPayload.comparisonResults || []).length + groupedResultCount
}

function buildWorkspaceStatsCard({ state, tasks = [], menuKey, title }) {
  const relatedTasks = sortTasks(tasks).filter((task) => resolveTaskMenuKey(task) === menuKey)
  const completedTaskCount = relatedTasks.filter((task) => task.status === '已完成').length
  const failedTaskCount = relatedTasks.filter((task) => task.status === '失败').length
  const exportItems = state.exportItemsByMenu[menuKey] || []
  const resultPayload = state.resultsByMenu[menuKey] || { textResults: [], images: [] }
  const items = [
    { label: '模型调用次数', value: String(relatedTasks.length) },
    { label: '任务总数', value: String(relatedTasks.length) },
    { label: '已完成任务', value: String(completedTaskCount) },
    { label: '失败任务', value: String(failedTaskCount) },
    { label: '当前结果数', value: String(countCurrentResults(resultPayload)) },
    { label: '已存储结果', value: String(countStoredResults(exportItems)) }
  ]

  return {
    title,
    items
  }
}

function buildWorkspaceDashboard(state, tasks = []) {
  return Object.fromEntries(workspaceDashboardSections.map((section) => [
    section.cardKey,
    buildWorkspaceStatsCard({
      state,
      tasks,
      menuKey: section.menuKey,
      title: section.title
    })
  ]))
}

function safeResolveUserName() {
  try {
    return os.userInfo().username || 'unknown'
  } catch (_error) {
    return 'unknown'
  }
}

function buildHostInfo() {
  const cpuList = os.cpus() || []

  return {
    systemName: os.hostname(),
    platformName: `${os.platform()} ${os.release()}`,
    architecture: os.arch(),
    cpuModel: cpuList[0]?.model || 'Unknown CPU',
    userName: safeResolveUserName(),
    runtimeName: `Node ${process.versions.node}`
  }
}

function buildSettingsSummary(settings = {}) {
  return {
    apiKeys: Array.isArray(settings.apiKeys) ? settings.apiKeys.slice(0, 2) : ['', ''],
    activeApiKeyIndex: Number.isInteger(settings.activeApiKeyIndex) ? settings.activeApiKeyIndex : 0
  }
}

async function buildResultPayload(menuKey, draft, taskId, outputDirectory, {
  generateImageResults,
  onProgress
}) {
  if (menuKey === 'single-image') {
    return generateImageResults({
      menuKey,
      draft,
      taskId,
      outputDirectory,
      onProgress
    })
  }

  if (menuKey === 'single-design') {
    return generateImageResults({
      menuKey,
      draft,
      taskId,
      outputDirectory,
      onProgress
    })
  }

  if (menuKey === 'series-design') {
    return generateImageResults({
      menuKey,
      draft,
      taskId,
      outputDirectory,
      onProgress
    })
  }

  if (menuKey === 'series-generate') {
    return generateImageResults({
      menuKey,
      draft,
      taskId,
      outputDirectory,
      onProgress
    })
  }

  return {
    textResults: [],
    comparisonResults: [],
    groupedResults: [],
    summary: null
  }
}

function parseDataUrlPayload(dataUrl = '') {
  const matched = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl)
  if (!matched) {
    return null
  }

  const mimeType = matched[1] || 'application/octet-stream'
  const payload = matched[2] || ''
  const extensionMap = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/svg+xml': '.svg'
  }

  return {
    buffer: Buffer.from(payload, 'base64'),
    extension: extensionMap[mimeType] || '.bin'
  }
}

function sanitizePathSegment(value, fallbackValue = 'result') {
  const sanitizedValue = String(value || fallbackValue)
    .replace(/[<>:"/\\|?*\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return sanitizedValue || fallbackValue
}

function isPathInsideDirectory(targetPath, rootDirectory) {
  const normalizedRootDirectory = path.resolve(rootDirectory)
  const normalizedTargetPath = path.resolve(targetPath)
  const relativePath = path.relative(normalizedRootDirectory, normalizedTargetPath)

  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

function resolveTaskFolderBaseName({ draft, menuKey, taskId }) {
  return sanitizePathSegment(draft.taskName || '', `${menuKey}-${taskId}`)
}

function createFolderExportItem({ id, name, directoryPath, itemCount, groupTitle }) {
  return {
    id,
    name,
    status: '已存储',
    type: 'FOLDER',
    directoryPath,
    outputDirectory: directoryPath,
    groupTitle,
    itemCount
  }
}

function createDefaultTaskNumber() {
  const now = new Date()
  const dateSegment = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('')

  return `QAI-${dateSegment}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

async function saveStudioResults({
  menuKey,
  taskId,
  draft,
  resultPayload,
  outputDirectory,
  writeFile = fs.writeFile
}) {
  const exportItems = []
  const persistedResultPayload = {
    ...resultPayload,
    textResults: Array.isArray(resultPayload.textResults) ? resultPayload.textResults.slice() : [],
    comparisonResults: [],
    groupedResults: []
  }
  const folderBaseName = resolveTaskFolderBaseName({
    draft,
    menuKey,
    taskId
  })

  await ensureDirectory(outputDirectory)

  if ((resultPayload.textResults || []).length) {
    const folderName = `${folderBaseName}0`
    const groupDirectory = path.resolve(outputDirectory, folderName)
    await ensureDirectory(groupDirectory)

    for (const [index, text] of (resultPayload.textResults || []).entries()) {
      const savedPath = path.resolve(groupDirectory, `${String(index).padStart(2, '0')}-${sanitizePathSegment(text.title || `text-${index + 1}`, `text-${index + 1}`)}.txt`)
      await writeFile(savedPath, text.content || String(text), 'utf8')
    }

    exportItems.push(createFolderExportItem({
      id: `${taskId}-export-folder-0`,
      name: folderName,
      directoryPath: groupDirectory,
      itemCount: (resultPayload.textResults || []).length,
      groupTitle: folderName
    }))
  }

  if ((resultPayload.comparisonResults || []).length) {
    const folderName = `${folderBaseName}0`
    const groupDirectory = path.resolve(outputDirectory, folderName)
    await ensureDirectory(groupDirectory)

    for (const [index, image] of (resultPayload.comparisonResults || []).entries()) {
      let savedPath = image.savedPath || ''

      if (!savedPath || !await fileExists(savedPath)) {
        const parsedPreview = parseDataUrlPayload(image.preview || '')
        if (!parsedPreview) {
          continue
        }

        savedPath = path.resolve(groupDirectory, `${String(index).padStart(2, '0')}-${sanitizePathSegment(image.model || 'image', 'image')}${parsedPreview.extension}`)
        await writeFile(savedPath, parsedPreview.buffer)
      } else {
        const targetPath = path.resolve(groupDirectory, `${String(index).padStart(2, '0')}-${path.basename(savedPath)}`)
        if (path.resolve(savedPath) !== path.resolve(targetPath)) {
          await fs.copyFile(savedPath, targetPath)
        }
        savedPath = targetPath
      }

      persistedResultPayload.comparisonResults.push({
        ...image,
        preview: '',
        savedPath
      })
    }

    exportItems.push(createFolderExportItem({
      id: `${taskId}-export-folder-0`,
      name: folderName,
      directoryPath: groupDirectory,
      itemCount: (resultPayload.comparisonResults || []).length,
      groupTitle: folderName
    }))
  }

  for (const [groupIndex, group] of (resultPayload.groupedResults || []).entries()) {
    const folderName = `${folderBaseName}${groupIndex}`
    const groupDirectory = path.resolve(outputDirectory, folderName)
    await ensureDirectory(groupDirectory)
    const persistedGroup = {
      ...group,
      outputs: []
    }

    for (const [index, output] of (group.outputs || []).entries()) {
      let savedPath = ''
      const parsedPreview = parseDataUrlPayload(output.preview || '')
      const outputBaseName = sanitizePathSegment(output.title || `result-${index + 1}`, `result-${index + 1}`)

      if (parsedPreview) {
        savedPath = path.resolve(groupDirectory, `${String(index).padStart(2, '0')}-${outputBaseName}${parsedPreview.extension}`)
        await writeFile(savedPath, parsedPreview.buffer)
      } else if (output.savedPath && await fileExists(output.savedPath)) {
        savedPath = path.resolve(groupDirectory, `${String(index).padStart(2, '0')}-${outputBaseName}${path.extname(output.savedPath) || ''}`)
        if (path.resolve(output.savedPath) !== path.resolve(savedPath)) {
          await fs.copyFile(output.savedPath, savedPath)
        }
      } else {
        continue
      }

      persistedGroup.outputs.push({
        ...output,
        preview: '',
        savedPath
      })
    }

    persistedResultPayload.groupedResults.push(persistedGroup)

    exportItems.push(createFolderExportItem({
      id: `${group.id}-export-folder`,
      name: folderName,
      directoryPath: groupDirectory,
      itemCount: (group.outputs || []).length,
      groupTitle: folderName
    }))
  }

  if (!exportItems.length) {
    const folderName = `${folderBaseName}0`
    const groupDirectory = path.resolve(outputDirectory, folderName)
    const savedPath = path.resolve(groupDirectory, `${menuKey}-${taskId}-result.txt`)
    await ensureDirectory(groupDirectory)
    await writeFile(savedPath, `${menuLabelMap[menuKey]} 结果占位`, 'utf8')
    exportItems.push(createFolderExportItem({
      id: `${taskId}-export-folder-fallback`,
      name: folderName,
      directoryPath: groupDirectory,
      itemCount: 1,
      groupTitle: folderName
    }))
  }

  return {
    exportItems,
    persistedResultPayload
  }
}

function resolveInputCount(menuKey, draft) {
  if (menuKey === 'single-image') {
    return draft.sourceImage ? 1 : 0
  }

  if (menuKey === 'single-design') {
    return draft.sourceImage ? 1 : 0
  }

  if (menuKey === 'series-design') {
    return (draft.imageAssignments || []).filter((item) => item.selected !== false).length
  }

  if (menuKey === 'series-generate') {
    return draft.sourceImage ? 1 : 0
  }

  return 0
}

function resolvePlannedOutputCount(resultPayload = {}) {
  return countCurrentResults(resultPayload)
}

function formatElapsedLabel(elapsedMilliseconds = 0) {
  const normalizedElapsedMilliseconds = Number.isFinite(elapsedMilliseconds) ? Math.max(0, elapsedMilliseconds) : 0
  return `生成耗时 ${(normalizedElapsedMilliseconds / 1000).toFixed(1)} 秒`
}

function resolveSummaryModels(menuKey, draft = {}, resultPayload = {}) {
  if (menuKey === 'single-image') {
    return [...new Set((resultPayload.comparisonResults || []).map((item) => item.model).filter(Boolean))]
  }

  if (menuKey === 'single-design') {
    return [...new Set((resultPayload.comparisonResults || []).map((item) => item.model).filter(Boolean))]
  }

  if (menuKey === 'series-design' || menuKey === 'series-generate') {
    const groupedModels = (resultPayload.groupedResults || []).flatMap((group) => {
      return (group.outputs || []).map((item) => item.model).filter(Boolean)
    })
    return [...new Set(groupedModels)]
  }

  return draft.model ? [draft.model] : []
}

function enrichResultPayloadSummary({ menuKey, draft, resultPayload, elapsedMilliseconds }) {
  const summary = resultPayload.summary || {}
  const resultCount = countCurrentResults(resultPayload)
  const models = resolveSummaryModels(menuKey, draft, resultPayload)

  return {
    ...resultPayload,
    summary: {
      ...summary,
      statusLabel: '已完成',
      modelLabel: models.length ? `使用模型 ${models.join(' / ')}` : '',
      resultCountLabel: `结果数量 ${resultCount}`,
      elapsedLabel: formatElapsedLabel(elapsedMilliseconds)
    }
  }
}

function resolveEstimatedInputCount(menuKey, draft = {}) {
  if (menuKey === 'single-image') {
    return draft.sourceImage ? 1 : 0
  }

  if (menuKey === 'single-design') {
    return draft.sourceImage ? 1 : 0
  }

  if (menuKey === 'series-design') {
    return Array.isArray(draft.imageAssignments)
      ? draft.imageAssignments.filter((item) => item.selected !== false).length
      : 0
  }

  if (menuKey === 'series-generate') {
    return draft.sourceImage ? 1 : 0
  }

  return 0
}

function resolveEstimatedPlannedOutputCount(menuKey, draft = {}) {
  if (menuKey === 'single-image') {
    return normalizeCompareModels(draft.compareModels).length
  }

  if (menuKey === 'single-design') {
    return 1
  }

  if (menuKey === 'series-design') {
    const assignmentCount = Array.isArray(draft.imageAssignments) ? draft.imageAssignments.length : 0
    return assignmentCount * Math.max(1, Number(draft.batchCount) || 1)
  }

  if (menuKey === 'series-generate') {
    return Math.max(1, Number(draft.batchCount) || 1) * Math.max(1, Number(draft.generateCount) || 1)
  }

  return 0
}

function resolveTaskTitle(menuKey, draft = {}) {
  if (menuKey === 'single-image') {
    return '单图四模型对比'
  }

  if (menuKey === 'single-design') {
    return '单图设计效果'
  }

  if (menuKey === 'series-design') {
    return `套图定向生成 ${Math.max(1, Number(draft.batchCount) || 1)} 组`
  }

  if (menuKey === 'series-generate') {
    return `套图生成 ${Math.max(1, Number(draft.batchCount) || 1)} 批 x ${Math.max(1, Number(draft.generateCount) || 1)} 张`
  }

  return `${menuLabelMap[menuKey]}任务`
}

function resolveTaskModelSummary(menuKey, draft = {}) {
  if (menuKey === 'single-image') {
    return normalizeCompareModels(draft.compareModels).join(' / ')
  }

  if (menuKey === 'single-design') {
    return draft.model || ''
  }

  return draft.model || ''
}

function buildTaskRecord({
  menuKey,
  draft,
  taskId,
  taskNumber,
  createdAt,
  inputDirectory,
  outputDirectory,
  inputCount,
  plannedOutputCount,
  batchCount,
  status,
  progress,
  error = ''
}) {
  const nextTask = {
    id: taskId,
    taskNumber,
    menuKey,
    category: taskCategoryMap[menuKey] || '单图测试',
    title: resolveTaskTitle(menuKey, draft, plannedOutputCount),
    modelSummary: resolveTaskModelSummary(menuKey, draft),
    inputCount,
    plannedOutputCount,
    batchCount,
    status,
    progress,
    createdAt,
    inputDirectory,
    outputDirectory
  }

  if (error) {
    nextTask.error = error
  }

  return nextTask
}

function buildQueuedTaskSummary({ menuKey, draft, taskId, taskNumber, createdAt, inputDirectory, outputDirectory }) {
  return buildTaskRecord({
    menuKey,
    draft,
    taskId,
    taskNumber,
    createdAt,
    inputDirectory,
    outputDirectory,
    inputCount: resolveEstimatedInputCount(menuKey, draft),
    plannedOutputCount: resolveEstimatedPlannedOutputCount(menuKey, draft),
    batchCount: menuKey === 'series-generate'
      ? Math.max(1, Number(draft.batchCount) || 1)
      : (menuKey === 'series-design' ? Math.max(1, Number(draft.batchCount) || 1) : 1),
    status: '等待中',
    progress: 0
  })
}

function buildRunningTaskSummary({ menuKey, draft, taskId, taskNumber, createdAt, inputDirectory, outputDirectory }) {
  return {
    ...buildQueuedTaskSummary({
      menuKey,
      draft,
      taskId,
      taskNumber,
      createdAt,
      inputDirectory,
      outputDirectory
    }),
    status: '进行中',
    progress: 0
  }
}

function normalizeTaskProgress(progressValue, fallbackValue = 0) {
  const numericProgress = Number(progressValue)
  if (!Number.isFinite(numericProgress)) {
    return fallbackValue
  }

  return Math.max(0, Math.min(100, Math.round(numericProgress)))
}

function buildTaskSummary({ menuKey, draft, taskId, taskNumber, createdAt, inputDirectory, outputDirectory, resultPayload }) {
  return buildTaskRecord({
    menuKey,
    draft,
    taskId,
    taskNumber,
    createdAt,
    inputDirectory,
    outputDirectory,
    inputCount: resolveInputCount(menuKey, draft, resultPayload),
    plannedOutputCount: resolvePlannedOutputCount(resultPayload),
    batchCount: menuKey === 'series-generate'
      ? Math.max(1, Number(draft.batchCount) || 1)
      : (menuKey === 'series-design' ? Math.max(1, Number(draft.batchCount) || 1) : 1),
    status: '已完成',
    progress: 100
  })
}

function buildFailedTaskSummary({ menuKey, draft, taskId, taskNumber, createdAt, inputDirectory, outputDirectory, errorMessage }) {
  return buildTaskRecord({
    menuKey,
    draft,
    taskId,
    taskNumber,
    createdAt,
    inputDirectory,
    outputDirectory,
    inputCount: resolveEstimatedInputCount(menuKey, draft),
    plannedOutputCount: 0,
    batchCount: menuKey === 'series-generate'
      ? Math.max(1, Number(draft.batchCount) || 1)
      : (menuKey === 'series-design' ? Math.max(1, Number(draft.batchCount) || 1) : 1),
    status: '失败',
    progress: 100,
    error: errorMessage
  })
}

function createStudioWorkspaceService({
  store,
  settingsService,
  promptTemplateService,
  messageRecorder,
  runtimeLogger,
  outputRootDirectory = OUTPUT_ROOT_DIRECTORY,
  createId = () => crypto.randomUUID(),
  createTaskNumber = createDefaultTaskNumber,
  getNow = () => new Date().toISOString(),
  ensureDirectory: ensureDirectoryDependency = ensureDirectory,
  persistSourceFiles: persistSourceFilesDependency = persistSourceFiles,
  writeFile = fs.writeFile,
  mkdtemp = fs.mkdtemp,
  copyFile = fs.copyFile,
  copyDirectory = (sourceDirectory, targetDirectory) => fs.cp(sourceDirectory, targetDirectory, { recursive: true }),
  removeDirectory = (targetPath) => fs.rm(targetPath, { recursive: true, force: true }),
  readdirSync = fsSync.readdirSync,
  statSync = fsSync.statSync,
  getNowMs = () => Date.now(),
  exportScanCacheTtlMs = 3000,
  exportTaskDirectory: exportTaskDirectoryDependency = defaultExportTaskDirectory,
  generateImageResults,
  taskManagerService
}) {
  const studioImageGenerationService = createStudioImageGenerationService({
    settingsService,
    promptTemplateService,
    messageRecorder,
    runtimeLogger
  })
  const generateImageResultsDependency = generateImageResults || studioImageGenerationService.generateImageResults
  const queuedTaskExecutions = []
  let isTaskQueueRunning = false
  let taskQueuePromise = Promise.resolve()
  let cachedExportItemsByMenu = null
  let cachedExportItemsAt = 0
  let isExportItemsCacheDirty = true

  function invalidateExportItemsCache() {
    cachedExportItemsByMenu = null
    cachedExportItemsAt = 0
    isExportItemsCacheDirty = true
  }

  async function persistTaskAndState({
    task,
    formDraftPatch = null,
    resultsByMenuPatch = null,
    exportItemsByMenuPatch = null
  }) {
    const latestState = getStoredState()
    const nextTasks = [
      task,
      ...getStoredTasks(latestState).filter((item) => item.id !== task.id)
    ]

    saveState({
      ...latestState,
      formDrafts: formDraftPatch
        ? {
            ...latestState.formDrafts,
            ...formDraftPatch
          }
        : latestState.formDrafts,
      resultsByMenu: resultsByMenuPatch
        ? {
            ...latestState.resultsByMenu,
            ...resultsByMenuPatch
          }
        : latestState.resultsByMenu,
      exportItemsByMenu: exportItemsByMenuPatch
        ? {
            ...latestState.exportItemsByMenu,
            ...exportItemsByMenuPatch
          }
        : latestState.exportItemsByMenu,
      tasks: nextTasks
    })

    if (exportItemsByMenuPatch) {
      invalidateExportItemsCache()
    }

    if (taskManagerService && typeof taskManagerService.saveTask === 'function') {
      await taskManagerService.saveTask(task)
    }

    return task
  }

  async function prepareDraftForExecution({ menuKey, draft, inputDirectory, outputDirectory }) {
    await ensureDirectoryDependency(inputDirectory)
    await ensureDirectoryDependency(outputDirectory)

    const sourcePaths = []
    const sourcePathAssignments = []

    if (menuKey === 'single-image') {
      const sourcePath = draft.sourceImage?.path || draft.sourceImage?.storedPath || ''
      if (sourcePath) {
        sourcePathAssignments.push({ type: 'single-source' })
        sourcePaths.push(sourcePath)
      }
    }

    if (menuKey === 'single-design') {
      const sourcePath = draft.sourceImage?.path || draft.sourceImage?.storedPath || ''
      if (sourcePath) {
        sourcePathAssignments.push({ type: 'single-design-source' })
        sourcePaths.push(sourcePath)
      }
    }

    if (menuKey === 'series-design') {
      draft.imageAssignments.forEach((item, index) => {
        const sourcePath = item.path || item.storedPath || ''
        if (sourcePath) {
          sourcePathAssignments.push({ type: 'series-design', index })
          sourcePaths.push(sourcePath)
        }
      })
    }

    if (menuKey === 'series-generate') {
      const sourcePath = draft.sourceImage?.path || draft.sourceImage?.storedPath || ''
      if (sourcePath) {
        sourcePathAssignments.push({ type: 'series-generate-source' })
        sourcePaths.push(sourcePath)
      }
    }

    const persistedSourcePaths = sourcePaths.length
      ? await persistSourceFilesDependency({
          sourcePaths,
          targetDirectory: inputDirectory
        })
      : []

    const preparedDraft = JSON.parse(JSON.stringify(draft))
    sourcePathAssignments.forEach((assignment, index) => {
      const storedPath = persistedSourcePaths[index] || ''
      if (!storedPath) {
        return
      }

      if (assignment.type === 'single-source' && preparedDraft.sourceImage) {
        preparedDraft.sourceImage.storedPath = storedPath
      }

      if (assignment.type === 'single-design-source' && preparedDraft.sourceImage) {
        preparedDraft.sourceImage.storedPath = storedPath
      }

      if (assignment.type === 'series-design' && preparedDraft.imageAssignments?.[assignment.index]) {
        preparedDraft.imageAssignments[assignment.index].storedPath = storedPath
      }

      if (assignment.type === 'series-generate-source' && preparedDraft.sourceImage) {
        preparedDraft.sourceImage.storedPath = storedPath
      }
    })

    return preparedDraft
  }

  async function runQueuedTaskExecution({
    menuKey,
    draft,
    taskId,
    taskNumber,
    createdAt,
    inputDirectory,
    outputDirectory
  }) {
    const runningTask = buildRunningTaskSummary({
      menuKey,
      draft,
      taskId,
      taskNumber,
      createdAt,
      inputDirectory,
      outputDirectory
    })

    await persistTaskAndState({
      task: runningTask
    })

    try {
      let latestRunningTask = runningTask
      const executionStartedAt = new Date(getNow()).getTime()
      const preparedDraft = await prepareDraftForExecution({
        menuKey,
        draft,
        inputDirectory,
        outputDirectory
      })
      const handleTaskProgress = async ({ progress, status } = {}) => {
        const normalizedProgress = normalizeTaskProgress(progress, latestRunningTask.progress)
        const cappedProgress = status === 'succeeded'
          ? Math.min(99, normalizedProgress)
          : normalizedProgress

        if (cappedProgress <= latestRunningTask.progress) {
          return
        }

        latestRunningTask = {
          ...latestRunningTask,
          progress: cappedProgress
        }

        await persistTaskAndState({
          task: latestRunningTask
        })
      }
      const resultPayload = await buildResultPayload(menuKey, preparedDraft, taskId, outputDirectory, {
        generateImageResults: generateImageResultsDependency,
        onProgress: handleTaskProgress
      })
      const {
        exportItems,
        persistedResultPayload
      } = await saveStudioResults({
        menuKey,
        taskId,
        draft: preparedDraft,
        resultPayload,
        outputDirectory,
        writeFile
      })
      const executionCompletedAt = new Date(getNow()).getTime()
      const enrichedResultPayload = enrichResultPayloadSummary({
        menuKey,
        draft: preparedDraft,
        resultPayload: persistedResultPayload,
        elapsedMilliseconds: executionCompletedAt - executionStartedAt
      })
      const completedTask = buildTaskSummary({
        menuKey,
        draft: preparedDraft,
        taskId,
        taskNumber,
        createdAt,
        inputDirectory,
        outputDirectory,
        resultPayload: enrichedResultPayload
      })

      await persistTaskAndState({
        task: completedTask,
        formDraftPatch: {
          [menuKey]: preparedDraft
        },
        resultsByMenuPatch: {
          [menuKey]: enrichedResultPayload
        },
        exportItemsByMenuPatch: {
          [menuKey]: exportItems
        }
      })

      await safeRuntimeLog(runtimeLogger, {
        level: 'info',
        event: 'studio-task-succeeded',
        taskId,
        menuKey,
        outputDirectory
      })
    } catch (error) {
      const failedTask = buildFailedTaskSummary({
        menuKey,
        draft,
        taskId,
        taskNumber,
        createdAt,
        inputDirectory,
        outputDirectory,
        errorMessage: error.message
      })

      await persistTaskAndState({
        task: failedTask
      })

      await safeRuntimeLog(runtimeLogger, {
        level: 'error',
        event: 'studio-task-failed',
        taskId,
        menuKey,
        outputDirectory,
        error: error.message
      })
    }
  }

  async function processQueuedTasks() {
    if (isTaskQueueRunning) {
      return taskQueuePromise
    }

    isTaskQueueRunning = true

    try {
      while (queuedTaskExecutions.length) {
        const nextExecution = queuedTaskExecutions.shift()
        await runQueuedTaskExecution(nextExecution)
      }
    } finally {
      isTaskQueueRunning = false
    }
  }

  function enqueueTaskExecution(executionPayload) {
    queuedTaskExecutions.push(executionPayload)

    if (!isTaskQueueRunning) {
      taskQueuePromise = processQueuedTasks()
    }
  }

  function getStoredState() {
    return mergeStudioState(store.get(STUDIO_WORKSPACE_KEY, {}))
  }

  function getStoredTasks(state = getStoredState()) {
    if (taskManagerService && typeof taskManagerService.listTasks === 'function') {
      return sortTasks(taskManagerService.listTasks())
    }

    return sortTasks(state.tasks)
  }

  function saveState(nextState) {
    store.set(STUDIO_WORKSPACE_KEY, nextState)
    return nextState
  }

  function getResolvedExportItemsByMenu(state = getStoredState()) {
    const now = getNowMs()
    const shouldReuseCache = !isExportItemsCacheDirty &&
      cachedExportItemsByMenu &&
      now - cachedExportItemsAt <= exportScanCacheTtlMs

    const scannedExportItemsByMenu = shouldReuseCache
      ? cachedExportItemsByMenu
      : scanStoredExportItemsByMenu({
          outputRootDirectory,
          readdirSync,
          statSync
        })

    if (!shouldReuseCache) {
      cachedExportItemsByMenu = scannedExportItemsByMenu
      cachedExportItemsAt = now
      isExportItemsCacheDirty = false
    }

    return mergeExportItemsByMenu({
      scannedExportItemsByMenu,
      storedExportItemsByMenu: state.exportItemsByMenu || {}
    })
  }

  function getSnapshot() {
    const state = getStoredState()
    const settings = settingsService.getSettings()
    const tasks = getStoredTasks(state)
    const exportItemsByMenu = getResolvedExportItemsByMenu(state)
    const derivedState = {
      ...state,
      exportItemsByMenu
    }

    return {
      themeMode: settings.themeMode || 'dark',
      themeOptions,
      menuItems,
      batchOptions,
      imageModelOptions,
      modelPricingCatalog,
      formDrafts: state.formDrafts,
      resultsByMenu: hydrateResultsByMenuForDisplay(state.resultsByMenu),
      exportItemsByMenu,
      tasks,
      workspaceDashboard: buildWorkspaceDashboard(derivedState, tasks),
      settingsSummary: buildSettingsSummary(settings),
      hostInfo: buildHostInfo()
    }
  }

  async function saveDraft({ menuKey = 'workspace', patch = {} } = {}) {
    const state = getStoredState()
    const nextDraft = normalizeDraftForMenu(menuKey, {
      ...(state.formDrafts[menuKey] || createDefaultDrafts()[menuKey] || {}),
      ...patch
    })

    saveState({
      ...state,
      formDrafts: {
        ...state.formDrafts,
        [menuKey]: nextDraft
      }
    })

    return nextDraft
  }

  async function createTask({ menuKey = 'workspace', draft: incomingDraft } = {}) {
    const state = getStoredState()
    const taskId = createId()
    const taskNumber = createTaskNumber()
    const draft = normalizeDraftForMenu(menuKey, {
      ...(state.formDrafts[menuKey] || createDefaultDrafts()[menuKey] || {}),
      ...(incomingDraft || {})
    })
    const {
      inputDirectory,
      outputDirectory
    } = getTaskDataDirectories({
      featureKey: menuKey,
      taskId
    })
    const createdAt = formatDisplayDateTime(getNow())
    const queuedTask = buildQueuedTaskSummary({
      menuKey,
      draft,
      taskId,
      taskNumber,
      createdAt,
      inputDirectory,
      outputDirectory
    })

    await persistTaskAndState({
      task: queuedTask,
      formDraftPatch: {
        [menuKey]: draft
      }
    })

    enqueueTaskExecution({
      menuKey,
      draft,
      taskId,
      taskNumber,
      createdAt,
      inputDirectory,
      outputDirectory
    })

    return queuedTask
  }

  async function deleteExportItem({
    menuKey = 'workspace',
    exportItemId = ''
  } = {}) {
    if (!exportItemId) {
      throw new Error('导出结果编号不能为空')
    }

    const state = getStoredState()
    const exportItems = getResolvedExportItemsByMenu(state)[menuKey] || []
    const exportItem = exportItems.find((item) => item.id === exportItemId)

    if (!exportItem) {
      throw new Error('未找到对应的导出结果')
    }

    const candidateDirectory = exportItem.directoryPath ||
      exportItem.outputDirectory ||
      (exportItem.savedPath ? path.dirname(exportItem.savedPath) : '')

    if (!candidateDirectory) {
      throw new Error('未找到可删除的结果目录')
    }

    if (!isPathInsideDirectory(candidateDirectory, outputRootDirectory)) {
      throw new Error('结果目录不在允许删除的输出目录范围内')
    }

    await removeDirectory(candidateDirectory)

    const storedExportItems = state.exportItemsByMenu[menuKey] || []

    saveState({
      ...state,
      exportItemsByMenu: {
        ...state.exportItemsByMenu,
        [menuKey]: storedExportItems.filter((item) => {
          const itemDirectory = item.directoryPath || item.outputDirectory || (item.savedPath ? path.dirname(item.savedPath) : '')
          return item.id !== exportItemId && itemDirectory !== candidateDirectory
        })
      }
    })
    invalidateExportItemsCache()

    await safeRuntimeLog(runtimeLogger, {
      level: 'info',
      scope: 'studio-workspace',
      message: 'Deleted stored studio export item',
      details: {
        menuKey,
        exportItemId,
        targetDirectory: candidateDirectory
      }
    })

    return {
      menuKey,
      exportItemId,
      deleted: true
    }
  }

  async function exportSelectedResults({
    menuKey = 'workspace',
    selectedExportIds = [],
    targetZipPath = ''
  } = {}) {
    if (!targetZipPath) {
      throw new Error('导出压缩包路径不能为空')
    }

    const normalizedSelectedIds = Array.isArray(selectedExportIds)
      ? selectedExportIds.filter(Boolean)
      : []

    if (!normalizedSelectedIds.length) {
      throw new Error('请选择至少一个导出结果')
    }

    const state = getStoredState()
    const exportItems = getResolvedExportItemsByMenu(state)[menuKey] || []
    const selectedIdSet = new Set(normalizedSelectedIds)
    const selectedItems = exportItems.filter((item) => selectedIdSet.has(item.id))

    if (!selectedItems.length) {
      throw new Error('未找到已选中的导出结果')
    }

    const stagingDirectory = await mkdtemp(path.join(os.tmpdir(), 'qiuai-studio-export-'))

    try {
      for (const [index, item] of selectedItems.entries()) {
        const sourceDirectory = item.directoryPath || item.outputDirectory || ''
        if (sourceDirectory) {
          const targetDirectory = path.resolve(
            stagingDirectory,
            `${String(index).padStart(2, '0')}-${sanitizePathSegment(item.name || item.groupTitle || 'result-group', 'result-group')}`
          )
          await copyDirectory(sourceDirectory, targetDirectory)
          continue
        }

        const sourcePath = item.savedPath || ''
        if (!sourcePath) {
          throw new Error(`结果文件缺失：${item.name || item.id}`)
        }

        const groupDirectory = path.resolve(stagingDirectory, sanitizePathSegment(item.groupTitle || menuLabelMap[menuKey] || 'result-group', 'result-group'))
        const targetFilePath = path.resolve(groupDirectory, `${String(index + 1).padStart(2, '0')}-${path.basename(sourcePath)}`)
        await ensureDirectoryDependency(groupDirectory)
        await copyFile(sourcePath, targetFilePath)
      }

      const exportedArchive = await exportTaskDirectoryDependency({
        sourceDirectory: stagingDirectory,
        targetZipPath
      })

      return {
        menuKey,
        exportedCount: selectedItems.length,
        targetZipPath: exportedArchive.targetZipPath
      }
    } finally {
      await removeDirectory(stagingDirectory).catch(() => {})
    }
  }

  return {
    getSnapshot,
    saveDraft,
    createTask,
    deleteExportItem,
    exportSelectedResults,
    waitForIdle: async () => {
      await taskQueuePromise
    }
  }
}

module.exports = {
  STUDIO_WORKSPACE_KEY,
  themeOptions,
  menuItems,
  batchOptions,
  imageModelOptions,
  modelPricingCatalog,
  createStudioWorkspaceService
}
