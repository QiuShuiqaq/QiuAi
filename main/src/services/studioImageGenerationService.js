const { createHttpClientService } = require('./httpClientService')
const { createDrawTask } = require('./drawTaskService')
const { getCompletedDrawResult } = require('./completedDrawResultService')
const { toDataUrl, getMimeTypeFromPath } = require('./localInputAssetService')

const FIXED_SINGLE_IMAGE_MODELS = ['nano-banana-fast', 'gpt-image-2']
const DEFAULT_OPTIONAL_SINGLE_IMAGE_MODELS = ['nano-banana-2', 'nano-banana-2-cl']
const MAX_SERIES_DESIGN_IMAGES = 30
const SERIES_DESIGN_SOFT_WEIGHT = 12
const SERIES_DESIGN_HARD_WEIGHT = 20
const SERIES_GENERATE_SOFT_TOTAL = 8
const SERIES_GENERATE_HARD_TOTAL = 20
const DEFAULT_CONCURRENCY = 2
const MAX_RETRY_COUNT = 2

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

async function safeRuntimeLog(runtimeLogger, payload) {
  if (!runtimeLogger || typeof runtimeLogger.log !== 'function') {
    return
  }

  try {
    await runtimeLogger.log(payload)
  } catch {
    // 运行日志失败不影响主流程。
  }
}

function resolveApiKey(settings = {}) {
  if (typeof settings.apiKey === 'string' && settings.apiKey.trim()) {
    return settings.apiKey.trim()
  }

  const activeIndex = Number.isInteger(settings.activeApiKeyIndex) ? settings.activeApiKeyIndex : 0
  const apiKey = Array.isArray(settings.apiKeys) ? settings.apiKeys[activeIndex] : ''
  return typeof apiKey === 'string' ? apiKey.trim() : ''
}

function composePrompt(parts = []) {
  return parts
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join('\n')
}

function normalizeSingleImageModels(compareModels = []) {
  const allowedModels = new Set([
    'gpt-image-2',
    'nano-banana-pro',
    'nano-banana-fast',
    'nano-banana-2',
    'nano-banana-pro-vt',
    'nano-banana-pro-cl',
    'nano-banana-2-cl',
    'nano-banana-pro-vip',
    'nano-banana-2-4k-cl',
    'nano-banana-pro-4k-vip',
    'nano-banana'
  ])
  const usedModels = new Set(FIXED_SINGLE_IMAGE_MODELS)
  const optionalModels = DEFAULT_OPTIONAL_SINGLE_IMAGE_MODELS.map((defaultModel, index) => {
    const candidateModel = Array.isArray(compareModels) ? compareModels[index + 2] : ''
    if (allowedModels.has(candidateModel) && !usedModels.has(candidateModel)) {
      usedModels.add(candidateModel)
      return candidateModel
    }

    usedModels.add(defaultModel)
    return defaultModel
  })

  return [...FIXED_SINGLE_IMAGE_MODELS, ...optionalModels]
}

function resolveImageSize(model = '') {
  if (model === 'nano-banana-2-4k-cl' || model === 'nano-banana-pro-4k-vip') {
    return '4K'
  }

  return '1K'
}

function normalizeProgressValue(progressValue, fallbackValue = 0) {
  const numericProgress = Number(progressValue)
  if (!Number.isFinite(numericProgress)) {
    return fallbackValue
  }

  return Math.max(0, Math.min(100, Math.round(numericProgress)))
}

function buildImageErrorMessage(result = {}, fallbackMessage = '图片任务执行失败') {
  if (result.failure_reason === 'input_moderation') {
    return '图片任务失败：输入内容触发审核限制'
  }

  if (result.failure_reason === 'output_moderation') {
    return '图片任务失败：输出内容触发审核限制'
  }

  if (typeof result.error === 'string' && result.error.trim()) {
    return result.error.trim()
  }

  return fallbackMessage
}

function createResultCardFromSavedImage(savedImage = {}, { id, model, title, promptSummary, sourceImageName }) {
  return {
    id,
    model,
    title,
    preview: savedImage.previewUrl || '',
    promptSummary,
    sourceImageName,
    status: '已完成',
    savedPath: savedImage.savedPath || ''
  }
}

function createSeriesOutputFromSavedImage(savedImage = {}, { id, title, model, sourceTag }) {
  return {
    id,
    title,
    model,
    preview: savedImage.previewUrl || '',
    savedPath: savedImage.savedPath || '',
    sourceTag
  }
}

function normalizeSeriesGeneratePromptAssignments(promptAssignments = [], generateCount = 1) {
  const normalizedGenerateCount = Math.max(1, Math.min(20, Number(generateCount) || 1))
  const sourceAssignments = Array.isArray(promptAssignments) ? promptAssignments : []

  return Array.from({ length: normalizedGenerateCount }, (_unused, index) => {
    const currentAssignment = sourceAssignments[index] || {}

    return {
      id: currentAssignment.id || `series-generate-${index + 1}`,
      index: index + 1,
      prompt: String(currentAssignment.prompt || '').trim()
    }
  })
}

async function mapWithConcurrency(items = [], mapper, concurrency = DEFAULT_CONCURRENCY) {
  const normalizedConcurrency = Math.max(1, Math.min(DEFAULT_CONCURRENCY + 1, Number(concurrency) || DEFAULT_CONCURRENCY))
  const results = new Array(items.length)
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({
    length: Math.min(normalizedConcurrency, Math.max(items.length, 1))
  }, () => runWorker()))

  return results
}

async function createReferenceUrls(filePaths = [], {
  toDataUrlDependency = toDataUrl,
  getMimeTypeFromPathDependency = getMimeTypeFromPath
} = {}) {
  const urls = []

  for (const filePath of filePaths) {
    urls.push(await toDataUrlDependency({
      filePath,
      mimeType: getMimeTypeFromPathDependency(filePath)
    }))
  }

  return urls
}

function createAggregateProgressReporter({ totalSubtasks = 1, onProgress } = {}) {
  const normalizedSubtaskCount = Math.max(1, Number(totalSubtasks) || 1)
  const subtaskProgress = Array.from({ length: normalizedSubtaskCount }, () => 0)
  let lastReportedProgress = 0

  return {
    async reportSubtaskProgress(subtaskIndex, progressValue, status = 'running') {
      if (typeof onProgress !== 'function') {
        return
      }

      const normalizedIndex = Math.max(0, Math.min(normalizedSubtaskCount - 1, Number(subtaskIndex) || 0))
      const normalizedProgress = normalizeProgressValue(progressValue, subtaskProgress[normalizedIndex])
      subtaskProgress[normalizedIndex] = Math.max(subtaskProgress[normalizedIndex], normalizedProgress)

      const aggregateProgress = Math.max(
        lastReportedProgress,
        Math.round(subtaskProgress.reduce((sum, currentValue) => sum + currentValue, 0) / normalizedSubtaskCount)
      )

      if (aggregateProgress === lastReportedProgress && status === 'running') {
        return
      }

      lastReportedProgress = aggregateProgress
      await onProgress({
        progress: aggregateProgress,
        status: aggregateProgress >= 100 ? 'succeeded' : status
      })
    }
  }
}

function validateStudioImageTask({ menuKey, draft }) {
  if (menuKey === 'single-image') {
    if (!draft.sourceImage?.storedPath && !draft.sourceImage?.path) {
      throw new Error('单图测试需要先上传一张测试图片')
    }

    return
  }

  if (menuKey === 'single-design') {
    if (!String(draft.prompt || '').trim()) {
      throw new Error('单图设计需要先输入提示词')
    }

    return
  }

  if (menuKey === 'series-design') {
    const assignments = Array.isArray(draft.imageAssignments) ? draft.imageAssignments : []
    const selectedAssignments = assignments.filter((item) => item.selected !== false)

    if (!assignments.length) {
      throw new Error('套图设计需要先上传一套图片')
    }

    if (assignments.length > MAX_SERIES_DESIGN_IMAGES) {
      throw new Error(`套图设计最多支持 ${MAX_SERIES_DESIGN_IMAGES} 张图片`)
    }

    if (!selectedAssignments.length) {
      throw new Error('套图设计至少需要选择 1 张待替换图片')
    }

    if (!String(draft.globalPrompt || '').trim()) {
      throw new Error('套图设计需要填写全局风格提示词')
    }

    if (selectedAssignments.some((item) => !String(item.prompt || '').trim())) {
      throw new Error('套图设计需要为每一张选中图片填写单独提示词')
    }

    const taskWeight = selectedAssignments.length * Math.max(1, Number(draft.batchCount) || 1)
    if (taskWeight > SERIES_DESIGN_HARD_WEIGHT) {
      throw new Error(`套图设计当前任务过重，请将“选中图片数 x 批次”控制在 ${SERIES_DESIGN_HARD_WEIGHT} 以内`)
    }

    return
  }

  if (menuKey === 'series-generate') {
    if (!draft.sourceImage?.storedPath && !draft.sourceImage?.path) {
      throw new Error('套图生成需要先上传一张参考图')
    }

    if (!String(draft.globalPrompt || '').trim()) {
      throw new Error('套图生成需要填写全局风格提示词')
    }

    const promptAssignments = normalizeSeriesGeneratePromptAssignments(draft.promptAssignments, draft.generateCount)
    if (promptAssignments.some((item) => !item.prompt)) {
      throw new Error('套图生成需要为每一张图片填写单独提示词')
    }

    const totalImageCount = Math.max(1, Number(draft.batchCount) || 1) * Math.max(1, Number(draft.generateCount) || 1)
    if (totalImageCount > SERIES_GENERATE_HARD_TOTAL) {
      throw new Error(`套图生成当前任务过重，请将“生成数量 x 批次”控制在 ${SERIES_GENERATE_HARD_TOTAL} 以内`)
    }
  }
}

function createStudioImageGenerationService({
  settingsService,
  messageRecorder,
  runtimeLogger,
  createHttpClientServiceDependency = createHttpClientService,
  createDrawTaskDependency = createDrawTask,
  getCompletedDrawResultDependency = getCompletedDrawResult,
  toDataUrlDependency = toDataUrl,
  getMimeTypeFromPathDependency = getMimeTypeFromPath,
  wait = sleep
}) {
  async function executeRemoteImageTask({
    jobLabel,
    model,
    prompt,
    aspectRatio,
    imageSize,
    filePaths,
    outputDirectory,
    onProgress
  }) {
    const settings = settingsService.getSettings()
    const apiKey = resolveApiKey(settings)

    if (!apiKey) {
      throw new Error('请先保存可用的 API-Key。')
    }

    const httpClient = createHttpClientServiceDependency({
      apiBaseUrl: settings.apiBaseUrl,
      apiKey,
      messageRecorder
    })
    const urls = await createReferenceUrls(filePaths, {
      toDataUrlDependency,
      getMimeTypeFromPathDependency
    })

    for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt += 1) {
      const remoteTask = await createDrawTaskDependency({
        model,
        prompt,
        aspectRatio,
        imageSize,
        urls
      }, {
        httpClient
      })

      await safeRuntimeLog(runtimeLogger, {
        level: 'info',
        event: 'studio-image-remote-task-created',
        remoteTaskId: remoteTask.id,
        model,
        jobLabel,
        attempt: attempt + 1
      })

      let completedResult

      do {
        completedResult = await getCompletedDrawResultDependency({
          id: remoteTask.id,
          outputDirectory
        }, {
          httpClient
        })

        if (typeof onProgress === 'function' && ['running', 'succeeded'].includes(completedResult.status)) {
          await onProgress({
            progress: completedResult.status === 'succeeded'
              ? 100
              : normalizeProgressValue(completedResult.progress),
            status: completedResult.status
          })
        }

        if (completedResult.status === 'running') {
          await wait(2500)
        }
      } while (completedResult.status === 'running')

      if (completedResult.status === 'succeeded') {
        return completedResult
      }

      const shouldRetry = completedResult.failure_reason === 'error' && attempt < MAX_RETRY_COUNT
      await safeRuntimeLog(runtimeLogger, {
        level: shouldRetry ? 'warn' : 'error',
        event: shouldRetry ? 'studio-image-task-retry' : 'studio-image-task-failed',
        remoteTaskId: remoteTask.id,
        model,
        jobLabel,
        attempt: attempt + 1,
        failureReason: completedResult.failure_reason || '',
        error: completedResult.error || ''
      })

      if (!shouldRetry) {
        throw new Error(buildImageErrorMessage(completedResult))
      }
    }

    throw new Error('图片任务执行失败')
  }

  async function generateSingleImageResults({ draft, taskId, outputDirectory, onProgress }) {
    const sourceFilePath = draft.sourceImage?.storedPath || draft.sourceImage?.path || ''
    const compareModels = normalizeSingleImageModels(draft.compareModels)
    const progressReporter = createAggregateProgressReporter({
      totalSubtasks: compareModels.length,
      onProgress
    })
    const comparisonResults = await mapWithConcurrency(compareModels, async (model, index) => {
      const completedResult = await executeRemoteImageTask({
        jobLabel: `single-image-${index + 1}`,
        model,
        prompt: composePrompt([draft.prompt, draft.notes]),
        aspectRatio: draft.size || '1:1',
        imageSize: resolveImageSize(model),
        filePaths: [sourceFilePath],
        outputDirectory,
        onProgress: async ({ progress, status }) => {
          await progressReporter.reportSubtaskProgress(index, progress, status)
        }
      })
      const savedImage = completedResult.results?.[0]
      if (!savedImage) {
        throw new Error(`${model} 未返回可用图片`)
      }

      return createResultCardFromSavedImage(savedImage, {
        id: `${taskId}-single-image-${index + 1}`,
        model,
        title: `${model} 对比结果`,
        promptSummary: draft.prompt || '',
        sourceImageName: draft.sourceImage?.name || ''
      })
    })

    return {
      textResults: [],
      comparisonResults,
      groupedResults: [],
      summary: {
        title: '单图四模型对比',
        description: `${draft.sourceImage?.name || '测试图片'} / ${comparisonResults.length} 个模型`
      }
    }
  }

  async function generateSingleDesignResults({ draft, taskId, outputDirectory, onProgress }) {
    const sourceFilePath = draft.sourceImage?.storedPath || draft.sourceImage?.path || ''
    const completedResult = await executeRemoteImageTask({
      jobLabel: 'single-design-1',
      model: draft.model,
      prompt: composePrompt([draft.prompt, draft.notes]),
      aspectRatio: draft.size || '1:1',
      imageSize: resolveImageSize(draft.model),
      filePaths: sourceFilePath ? [sourceFilePath] : [],
      outputDirectory,
      onProgress
    })
    const savedImage = completedResult.results?.[0]
    if (!savedImage) {
      throw new Error(`${draft.model} 未返回可用图片`)
    }

    const comparisonResults = [
      createResultCardFromSavedImage(savedImage, {
        id: `${taskId}-single-design-1`,
        model: draft.model,
        title: `${draft.model} 设计结果`,
        promptSummary: draft.prompt || '',
        sourceImageName: draft.sourceImage?.name || ''
      })
    ]

    return {
      textResults: [],
      comparisonResults,
      groupedResults: [],
      summary: {
        title: '单图设计效果',
        description: `${draft.sourceImage?.name || '文生图'} / ${draft.model}`
      }
    }
  }

  async function generateSeriesDesignResults({ draft, taskId, outputDirectory, onProgress }) {
    const assignments = Array.isArray(draft.imageAssignments) ? draft.imageAssignments : []
    const selectedAssignments = assignments.filter((item) => item.selected !== false)
    const batchCount = Math.max(1, Number(draft.batchCount) || 1)
    const progressReporter = createAggregateProgressReporter({
      totalSubtasks: Math.max(1, selectedAssignments.length * batchCount),
      onProgress
    })
    const taskWeight = selectedAssignments.length * batchCount
    if (taskWeight > SERIES_DESIGN_SOFT_WEIGHT) {
      await safeRuntimeLog(runtimeLogger, {
        level: 'warn',
        event: 'studio-series-design-soft-threshold',
        taskId,
        weight: taskWeight,
        batchCount,
        selectedCount: selectedAssignments.length
      })
    }

    const originalOutputs = await Promise.all(assignments.map(async (assignment, index) => {
      const sourceFilePath = assignment.storedPath || assignment.path || ''
      const preview = sourceFilePath
        ? await toDataUrlDependency({
            filePath: sourceFilePath,
            mimeType: getMimeTypeFromPathDependency(sourceFilePath)
          })
        : ''

      return {
        id: `${taskId}-series-design-original-${index + 1}`,
        title: assignment.name,
        model: 'original',
        preview,
        savedPath: sourceFilePath,
        sourceTag: 'original'
      }
    }))

    const groupedResults = []

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      const generatedReplacementMap = new Map()

      const generatedItems = await mapWithConcurrency(selectedAssignments, async (assignment, selectedIndex) => {
        const sourceFilePath = assignment.storedPath || assignment.path || ''
        const subtaskIndex = (batchIndex * selectedAssignments.length) + selectedIndex
        const completedResult = await executeRemoteImageTask({
          jobLabel: `series-design-${batchIndex + 1}-${selectedIndex + 1}`,
          model: draft.model,
          prompt: composePrompt([draft.globalPrompt, assignment.prompt]),
          aspectRatio: draft.size || '1:1',
          imageSize: resolveImageSize(draft.model),
          filePaths: [sourceFilePath],
          outputDirectory,
          onProgress: async ({ progress, status }) => {
            await progressReporter.reportSubtaskProgress(subtaskIndex, progress, status)
          }
        })
        const savedImage = completedResult.results?.[0]
        if (!savedImage) {
          throw new Error(`${assignment.name} 未返回可用图片`)
        }

        return {
          assignmentId: assignment.id,
          output: createSeriesOutputFromSavedImage(savedImage, {
            id: `${taskId}-series-design-${batchIndex + 1}-${selectedIndex + 1}`,
            title: assignment.name,
            model: draft.model,
            sourceTag: 'generated'
          })
        }
      })

      generatedItems.forEach((item) => {
        generatedReplacementMap.set(item.assignmentId, item.output)
      })

      groupedResults.push({
        id: `${taskId}-series-design-group-${batchIndex + 1}`,
        groupType: 'batch',
        groupTitle: `第 ${batchIndex + 1} 组`,
        promptSummary: draft.globalPrompt || '',
        notes: `已替换 ${selectedAssignments.length} 张图片`,
        outputs: assignments.map((assignment, index) => {
          return generatedReplacementMap.get(assignment.id) || {
            ...originalOutputs[index],
            id: `${taskId}-series-design-batch-${batchIndex + 1}-original-${index + 1}`
          }
        })
      })
    }

    return {
      textResults: [],
      comparisonResults: [],
      groupedResults,
      summary: {
        title: `套图设计 ${batchCount} 组`,
        description: `${draft.model} / 每组 ${assignments.length} 张`
      }
    }
  }

  async function generateSeriesGenerateResults({ draft, taskId, outputDirectory, onProgress }) {
    const batchCount = Math.max(1, Number(draft.batchCount) || 1)
    const promptAssignments = normalizeSeriesGeneratePromptAssignments(draft.promptAssignments, draft.generateCount)
    const generateCount = promptAssignments.length
    const totalImageCount = batchCount * generateCount
    const progressReporter = createAggregateProgressReporter({
      totalSubtasks: Math.max(1, totalImageCount),
      onProgress
    })
    if (totalImageCount > SERIES_GENERATE_SOFT_TOTAL) {
      await safeRuntimeLog(runtimeLogger, {
        level: 'warn',
        event: 'studio-series-generate-soft-threshold',
        taskId,
        totalImageCount,
        batchCount,
        generateCount
      })
    }

    const sourceFilePath = draft.sourceImage?.storedPath || draft.sourceImage?.path || ''
    const groupedResults = []

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      const outputs = await mapWithConcurrency(promptAssignments, async (promptAssignment, outputIndex) => {
        const subtaskIndex = (batchIndex * generateCount) + outputIndex
        const completedResult = await executeRemoteImageTask({
          jobLabel: `series-generate-${batchIndex + 1}-${outputIndex + 1}`,
          model: draft.model,
          prompt: composePrompt([draft.globalPrompt, promptAssignment.prompt]),
          aspectRatio: draft.size || '1:1',
          imageSize: resolveImageSize(draft.model),
          filePaths: [sourceFilePath],
          outputDirectory,
          onProgress: async ({ progress, status }) => {
            await progressReporter.reportSubtaskProgress(subtaskIndex, progress, status)
          }
        })
        const savedImage = completedResult.results?.[0]
        if (!savedImage) {
          throw new Error(`第 ${batchIndex + 1} 组结果 ${outputIndex + 1} 未返回可用图片`)
        }

        return createSeriesOutputFromSavedImage(savedImage, {
          id: `${taskId}-series-generate-${batchIndex + 1}-${outputIndex + 1}`,
          title: `第 ${outputIndex + 1} 张`,
          model: draft.model,
          sourceTag: 'generated'
        })
      })

      groupedResults.push({
        id: `${taskId}-series-generate-group-${batchIndex + 1}`,
        groupType: 'batch',
        groupTitle: `第 ${batchIndex + 1} 组`,
        promptSummary: draft.globalPrompt || '',
        notes: '',
        outputs
      })
    }

    return {
      textResults: [],
      comparisonResults: [],
      groupedResults,
      summary: {
        title: `套图生成 ${batchCount} 组 x ${generateCount} 张`,
        description: `${draft.model} / ${draft.sourceImage?.name || '参考图'}`
      }
    }
  }

  async function generateImageResults({ menuKey, draft, taskId, outputDirectory, onProgress }) {
    validateStudioImageTask({
      menuKey,
      draft
    })

    if (menuKey === 'single-image') {
      return generateSingleImageResults({
        draft,
        taskId,
        outputDirectory,
        onProgress
      })
    }

    if (menuKey === 'single-design') {
      return generateSingleDesignResults({
        draft,
        taskId,
        outputDirectory,
        onProgress
      })
    }

    if (menuKey === 'series-design') {
      return generateSeriesDesignResults({
        draft,
        taskId,
        outputDirectory,
        onProgress
      })
    }

    if (menuKey === 'series-generate') {
      return generateSeriesGenerateResults({
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

  return {
    generateImageResults,
    normalizeSingleImageModels
  }
}

module.exports = {
  FIXED_SINGLE_IMAGE_MODELS,
  DEFAULT_OPTIONAL_SINGLE_IMAGE_MODELS,
  MAX_SERIES_DESIGN_IMAGES,
  SERIES_DESIGN_SOFT_WEIGHT,
  SERIES_DESIGN_HARD_WEIGHT,
  SERIES_GENERATE_SOFT_TOTAL,
  SERIES_GENERATE_HARD_TOTAL,
  normalizeSingleImageModels,
  createStudioImageGenerationService
}
