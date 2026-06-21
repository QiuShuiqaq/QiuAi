const { createHttpClientService } = require('./httpClientService')
const { createDrawTask } = require('./drawTaskService')
const { getCompletedDrawResult } = require('./completedDrawResultService')
const { toDataUrl, getMimeTypeFromPath } = require('./localInputAssetService')

const FIXED_SINGLE_IMAGE_MODELS = ['nano-banana-fast', 'gpt-image-2']
const DEFAULT_OPTIONAL_SINGLE_IMAGE_MODELS = ['nano-banana-2', 'nano-banana-2-cl']
const MAX_SERIES_DESIGN_IMAGES = 30
const SERIES_DESIGN_SOFT_WEIGHT = 12
const SERIES_GENERATE_SOFT_TOTAL = 8
const SERIES_GROUP_CONCURRENCY = 4
const MAX_SERIES_GENERATE_GROUP_SIZE = 500
const REMOTE_RESULT_POLL_INTERVAL_MS = 2500
const REMOTE_RESULT_TOTAL_TIMEOUT_MS = 2 * 60 * 60 * 1000
const REMOTE_RESULT_STALL_TIMEOUT_MS = 2 * 60 * 60 * 1000
const GROUPED_REMOTE_RESULT_TOTAL_TIMEOUT_MS = 10 * 60 * 1000
const GROUPED_REMOTE_RESULT_STALL_TIMEOUT_MS = 10 * 60 * 1000
const GROUPED_REMOTE_RESULT_POLL_INTERVAL_MAX_MS = 10000
const GROUPED_SUBTASK_AUTO_RETRY_COUNT = 0
const SERIES_GENERATE_IMAGE_TYPE_OPTIONS = ['商品主图', '详情图', '细节图', '尺寸图', '白底图', '颜色图']
const SERIES_GENERATE_IMAGE_TYPE_CONFIG = {
  商品主图: {
    outputLabel: '主图',
    templateId: 'product-main',
    instruction: '按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。'
  },
  详情图: {
    outputLabel: '详情图',
    templateId: 'product-detail',
    instruction: '按详情图生成：输出产品详细说明图，强调卖点信息、使用说明、功能结构或场景说明；禁止仅做主视觉海报。'
  },
  细节图: {
    outputLabel: '细节图',
    templateId: 'product-closeup',
    instruction: '按细节图生成：输出产品局部放大图，重点展示材质、做工、纹理或关键细节；禁止生成整套场景主视觉。'
  },
  尺寸图: {
    outputLabel: '尺寸图',
    templateId: 'product-size',
    instruction: '按尺寸图生成：输出带尺寸标注的说明图，清晰表达长宽高或关键规格；禁止省略尺寸信息。'
  },
  白底图: {
    outputLabel: '白底图',
    templateId: 'product-whitebg',
    instruction: '按白底图生成：输出纯白背景电商图，主体完整清晰、边缘干净；禁止加入场景背景和复杂装饰。'
  },
  颜色图: {
    outputLabel: '颜色图',
    templateId: 'product-color',
    instruction: '按颜色图生成：输出产品颜色变化效果图，保持产品结构一致，仅突出颜色差异；禁止改变主体款式。'
  }
}
const DEFAULT_CONCURRENCY = 2
const MAX_RETRY_COUNT = 2
const ASPECT_RATIO_PRESET_MAP = {
  'a4-portrait': '3:4',
  'a4-landscape': '4:3',
  'a5-portrait': '3:4',
  'a5-landscape': '4:3',
  '8k-landscape': '16:9',
  '8k-portrait': '9:16'
}

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
    // 杩愯鏃ュ織澶辫触涓嶅奖鍝嶄富娴佺▼銆?
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

function normalizePromptLinesStable(value = '') {
  return String(value || '')
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function composePromptStable(parts = []) {
  const seen = new Set()

  return (Array.isArray(parts) ? parts : [])
    .flatMap((item) => normalizePromptLinesStable(item))
    .filter((line) => {
      if (seen.has(line)) {
        return false
      }

      seen.add(line)
      return true
    })
    .join('\n')
}

function normalizeNegativePromptTextStable(negativePrompt = '') {
  return normalizePromptLinesStable(negativePrompt).join('，')
}

function composeStructuredPrompt({
  dedicatedPrompt = '',
  globalPrompt = '',
  negativePrompt = ''
} = {}) {
  const positivePrompt = composePromptStable([dedicatedPrompt, globalPrompt])
  const normalizedNegativePrompt = normalizeNegativePromptTextStable(negativePrompt)

  if (!normalizedNegativePrompt) {
    return positivePrompt
  }

  return [positivePrompt, `严格避免以下问题：${normalizedNegativePrompt}`]
    .filter(Boolean)
    .join('\n')
}

function normalizeDifferentialBatchPrompts(batchPrompts = [], batchCount = 1) {
  const normalizedCount = Math.max(1, Number(batchCount) || 1)
  const sourcePrompts = Array.isArray(batchPrompts) ? batchPrompts : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    return String(sourcePrompts[index] || '').trim()
  })
}

function resolveBatchPromptValue({
  differentialEnabled = false,
  batchPrompts = [],
  fallbackPrompt = '',
  batchIndex = 0,
  batchCount = 1
} = {}) {
  if (differentialEnabled !== true) {
    return String(fallbackPrompt || '').trim()
  }

  const normalizedBatchPrompts = normalizeDifferentialBatchPrompts(batchPrompts, batchCount)
  return normalizedBatchPrompts[batchIndex] || ''
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

function resolveAspectRatio(size = '1:1') {
  const normalizedSize = String(size || '').trim()
  return ASPECT_RATIO_PRESET_MAP[normalizedSize] || normalizedSize || '1:1'
}

function normalizeProgressValue(progressValue, fallbackValue = 0) {
  const numericProgress = Number(progressValue)
  if (!Number.isFinite(numericProgress)) {
    return fallbackValue
  }

  return Math.max(0, Math.min(100, Math.round(numericProgress)))
}

function isRemoteResultPollingTimedOut({
  pollStartedAt = 0,
  lastProgressAt = 0,
  getNowMs = () => Date.now(),
  remoteResultTimeoutMs = REMOTE_RESULT_TOTAL_TIMEOUT_MS,
  remoteResultStallTimeoutMs = REMOTE_RESULT_STALL_TIMEOUT_MS
} = {}) {
  const now = getNowMs()

  if (now - pollStartedAt >= remoteResultTimeoutMs) {
    return 'total'
  }

  if (now - lastProgressAt >= remoteResultStallTimeoutMs) {
    return 'stall'
  }

  return ''
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

function isModerationFailureMessage(message = '') {
  const normalizedMessage = String(message || '').trim()
  return normalizedMessage === '图片任务失败：输入内容触发审核限制' ||
    normalizedMessage === '图片任务失败：输出内容触发审核限制'
}

function shouldAutoRetryGroupedItemError(error = {}) {
  const message = String(error?.message || '').trim()
  const code = String(error?.code || '').trim()
  const status = Number(error?.response?.status ?? error?.status ?? 0)

  if (isModerationFailureMessage(message)) {
    return true
  }

  if (
    message === '图片任务长时间无进展，请稍后重试' ||
    message === '图片任务执行超时，请拆分任务或稍后重试'
  ) {
    return true
  }

  if (message === 'generate image failed' || message.includes('generate image failed')) {
    return true
  }

  if ((status >= 500 && status < 600) || status === 429) {
    return true
  }

  if (/status code (429|5\d{2})/i.test(message)) {
    return true
  }

  return [
    'socket hang up',
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNABORTED',
    'network error'
  ].some((keyword) => message.includes(keyword) || code.includes(keyword))
}

function createResultCardFromSavedImage(savedImage = {}, { id, model, title, promptSummary, sourceImageName, promptFinal = '' }) {
  return {
    id,
    model,
    title,
    preview: savedImage.previewUrl || '',
    promptSummary,
    promptFinal,
    sourceImageName,
    status: '已完成',
    savedPath: savedImage.savedPath || ''
  }
}

function createSeriesOutputFromSavedImage(savedImage = {}, {
  id,
  title,
  model,
  sourceTag,
  promptFinal = '',
  startedAt = '',
  completedAt = '',
  elapsedMs = 0
}) {
  return {
    id,
    title,
    model,
    preview: savedImage.previewUrl || '',
    savedPath: savedImage.savedPath || '',
    sourceTag,
    promptFinal,
    startedAt,
    completedAt,
    elapsedMs: Math.max(0, Number(elapsedMs) || 0)
  }
}

function createSeriesEmptyOutput({
  id,
  title,
  model,
  promptFinal = '',
  assignmentId = '',
  error,
  startedAt = '',
  completedAt = '',
  elapsedMs = 0
} = {}) {
  return {
    id,
    title,
    model,
    preview: '',
    savedPath: '',
    sourceTag: 'empty',
    promptFinal,
    assignmentId,
    status: '失败',
    error: String(error || '').trim() || '图片任务执行失败',
    startedAt,
    completedAt,
    elapsedMs: Math.max(0, Number(elapsedMs) || 0)
  }
}

function normalizeSeriesGeneratePromptAssignments(promptAssignments = [], generateCount = 1, batchCount = 1) {
  const normalizedGenerateCount = Math.max(1, Math.min(MAX_SERIES_GENERATE_GROUP_SIZE, Number(generateCount) || 1))
  const sourceAssignments = Array.isArray(promptAssignments) ? promptAssignments : []

  return Array.from({ length: normalizedGenerateCount }, (_unused, index) => {
    const currentAssignment = sourceAssignments[index] || {}
    const normalizedImageType = SERIES_GENERATE_IMAGE_TYPE_OPTIONS.includes(currentAssignment.imageType)
      ? currentAssignment.imageType
      : ''

    return {
      id: currentAssignment.id || `series-generate-${index + 1}`,
      index: index + 1,
      prompt: String(currentAssignment.prompt || '').trim(),
      templateId: String(currentAssignment.templateId || ''),
      imageType: normalizedImageType,
      differentialEnabled: currentAssignment.differentialEnabled === true,
      batchPrompts: normalizeDifferentialBatchPrompts(currentAssignment.batchPrompts, batchCount)
    }
  })
}

function buildSeriesGenerateOutputDescriptors(promptAssignments = []) {
  const typeCounters = new Map()

  return promptAssignments.map((assignment, index) => {
    const config = SERIES_GENERATE_IMAGE_TYPE_CONFIG[assignment.imageType] || {
      outputLabel: `第${index + 1}张`,
      instruction: ''
    }
    const currentCount = typeCounters.get(config.outputLabel) || 0
    typeCounters.set(config.outputLabel, currentCount + 1)

    return {
      ...assignment,
      outputTitle: `${config.outputLabel}${currentCount}`,
      composedPrompt: composePrompt([assignment.prompt])
    }
  })
}

function resolveGroupedPollIntervalMs({
  attemptCount = 0,
  baseIntervalMs = REMOTE_RESULT_POLL_INTERVAL_MS,
  maxIntervalMs = GROUPED_REMOTE_RESULT_POLL_INTERVAL_MAX_MS
} = {}) {
  const normalizedAttemptCount = Math.max(0, Number(attemptCount) || 0)
  const nextIntervalMs = baseIntervalMs * (normalizedAttemptCount < 2 ? 1 : 2 ** Math.min(3, normalizedAttemptCount - 1))
  return Math.min(maxIntervalMs, nextIntervalMs)
}

function buildSeriesDesignOutputDescriptors(assignments = []) {
  const typeCounters = new Map()

  return assignments.map((assignment, index) => {
    const config = SERIES_GENERATE_IMAGE_TYPE_CONFIG[assignment.imageType] || {
      outputLabel: assignment.name || `第${index + 1}张`,
      instruction: ''
    }
    const currentCount = typeCounters.get(config.outputLabel) || 0
    typeCounters.set(config.outputLabel, currentCount + 1)

    return {
      ...assignment,
      model: assignment.model || '',
      size: assignment.size || '1:1',
      tagNames: Array.isArray(assignment.tagNames) ? assignment.tagNames : [],
      differentialEnabled: assignment.differentialEnabled === true,
      batchPrompts: Array.isArray(assignment.batchPrompts) ? assignment.batchPrompts : [],
      outputTitle: SERIES_GENERATE_IMAGE_TYPE_CONFIG[assignment.imageType]
        ? `${config.outputLabel}${currentCount}`
        : config.outputLabel,
      composedPrompt: composePrompt([
        ...(Array.isArray(assignment.tagNames) ? assignment.tagNames : []),
        assignment.prompt
      ])
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

async function runTasksWithConcurrency(taskFactories = [], concurrency = SERIES_GROUP_CONCURRENCY) {
  const normalizedFactories = Array.isArray(taskFactories) ? taskFactories : []
  const normalizedConcurrency = Math.max(1, Number(concurrency) || 1)
  const results = new Array(normalizedFactories.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < normalizedFactories.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await normalizedFactories[currentIndex]()
    }
  }

  await Promise.all(Array.from({
    length: Math.min(normalizedConcurrency, normalizedFactories.length)
  }, () => worker()))

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

    if (selectedAssignments.some((item) => {
      if (item.differentialEnabled === true) {
        const batchPrompts = normalizeDifferentialBatchPrompts(item.batchPrompts, draft.batchCount)
        return batchPrompts.some((prompt) => !prompt)
      }

      return !String(item.prompt || '').trim()
    })) {
      throw new Error('套图设计需要为每一张选中图片填写单独提示词')
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

    const promptAssignments = normalizeSeriesGeneratePromptAssignments(draft.promptAssignments, draft.generateCount, draft.batchCount)
    if (promptAssignments.some((item) => {
      if (item.differentialEnabled === true) {
        return item.batchPrompts.some((prompt) => !String(prompt || '').trim())
      }

      return !item.prompt
    })) {
      throw new Error('套图生成需要为每一张图片填写单独提示词')
    }

  }
}

function createSeriesPendingOutput({
  id,
  title,
  model,
  promptFinal = '',
  assignmentId = '',
  sourceTag = 'pending',
  status = '等待中',
  error = '',
  startedAt = ''
} = {}) {
  return {
    id,
    title,
    model,
    preview: '',
    savedPath: '',
    sourceTag,
    promptFinal,
    assignmentId,
    status,
    error: String(error || '').trim(),
    startedAt,
    completedAt: '',
    elapsedMs: 0
  }
}

function resolveTaskRetryLimit(maxRetryCountOverride) {
  if (!Number.isFinite(Number(maxRetryCountOverride))) {
    return MAX_RETRY_COUNT
  }

  return Math.max(0, Math.floor(Number(maxRetryCountOverride)))
}

function createStudioImageGenerationService({
  settingsService,
  messageRecorder,
  runtimeLogger,
  requestMetricRecorder,
  createHttpClientServiceDependency = createHttpClientService,
  createDrawTaskDependency = createDrawTask,
  getCompletedDrawResultDependency = getCompletedDrawResult,
  toDataUrlDependency = toDataUrl,
  getMimeTypeFromPathDependency = getMimeTypeFromPath,
  wait = sleep,
  getNowMs = () => Date.now(),
  remoteResultTimeoutMs = REMOTE_RESULT_TOTAL_TIMEOUT_MS,
  remoteResultStallTimeoutMs = REMOTE_RESULT_STALL_TIMEOUT_MS,
  remoteResultPollIntervalMs = REMOTE_RESULT_POLL_INTERVAL_MS
}) {
  async function executeRemoteImageTask({
    jobLabel,
    model,
    prompt,
    aspectRatio,
    imageSize,
    filePaths,
    outputDirectory,
    onProgress,
    refreshStallTimeoutOnRunningPoll = false,
    remoteResultTimeoutMsOverride = remoteResultTimeoutMs,
    remoteResultStallTimeoutMsOverride = remoteResultStallTimeoutMs,
    resolveNextPollIntervalMs = null,
    maxRetryCountOverride
  }) {
    const settings = settingsService.getSettings()
    const apiKey = resolveApiKey(settings)

    if (!apiKey) {
      throw new Error('请先保存可用的 API-Key。')
    }

    const httpClient = createHttpClientServiceDependency({
      apiBaseUrl: settings.apiBaseUrl,
      apiKey,
      messageRecorder,
      requestMetricRecorder
    })
    const urls = await createReferenceUrls(filePaths, {
      toDataUrlDependency,
      getMimeTypeFromPathDependency
    })

    const maxRetryCount = resolveTaskRetryLimit(maxRetryCountOverride)

    for (let attempt = 0; attempt <= maxRetryCount; attempt += 1) {
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
      const pollStartedAt = getNowMs()
      let lastObservedProgress = 0
      let lastProgressAt = pollStartedAt
      let runningPollCount = 0

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
          runningPollCount += 1
          const normalizedProgress = normalizeProgressValue(completedResult.progress, lastObservedProgress)
          if (normalizedProgress > lastObservedProgress) {
            lastObservedProgress = normalizedProgress
            lastProgressAt = getNowMs()
          }

          const timeoutKind = isRemoteResultPollingTimedOut({
            pollStartedAt,
            lastProgressAt,
            getNowMs,
            remoteResultTimeoutMs: remoteResultTimeoutMsOverride,
            remoteResultStallTimeoutMs: remoteResultStallTimeoutMsOverride
          })

          if (timeoutKind === 'total') {
            throw new Error('图片任务执行超时，请拆分任务或稍后重试')
          }

          if (timeoutKind === 'stall') {
            throw new Error('图片任务长时间无进展，请稍后重试')
          }

          if (refreshStallTimeoutOnRunningPoll) {
            lastProgressAt = getNowMs()
          }

          const nextPollIntervalMs = typeof resolveNextPollIntervalMs === 'function'
            ? resolveNextPollIntervalMs({
                runningPollCount,
                lastObservedProgress
              })
            : remoteResultPollIntervalMs

          await wait(nextPollIntervalMs)
        }
      } while (completedResult.status === 'running')

      if (completedResult.status === 'succeeded') {
        return completedResult
      }

      const shouldRetry = completedResult.failure_reason === 'error' && attempt < maxRetryCount
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
      const promptFinal = composePrompt([draft.prompt, draft.notes])
      const completedResult = await executeRemoteImageTask({
        jobLabel: `single-image-${index + 1}`,
        model,
        prompt: promptFinal,
        aspectRatio: resolveAspectRatio(draft.size || '1:1'),
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
        promptFinal,
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
    const promptFinal = composePrompt([draft.prompt, draft.notes])
    const completedResult = await executeRemoteImageTask({
      jobLabel: 'single-design-1',
      model: draft.model,
      prompt: promptFinal,
      aspectRatio: resolveAspectRatio(draft.size || '1:1'),
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
        promptFinal,
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

  async function generateSeriesDesignResults({ draft, taskId, outputDirectory, onProgress, onIntermediateResult }) {
    const seriesGroupConcurrency = SERIES_GROUP_CONCURRENCY
    const assignments = Array.isArray(draft.imageAssignments) ? draft.imageAssignments : []
    const selectedAssignments = buildSeriesDesignOutputDescriptors(assignments.filter((item) => item.selected !== false))
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

    async function emitIntermediateGroupedResults() {
      if (typeof onIntermediateResult !== 'function') {
        return
      }

      await onIntermediateResult({
        textResults: [],
        comparisonResults: [],
        groupedResults: groupedResults.slice(),
        summary: {
          title: `套图设计 ${batchCount} 组`,
          description: `${draft.model} / 每组 ${assignments.length} 张`
        }
      })
    }

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      const generatedReplacementMap = new Map()
      let completedCount = 0
      let failedCount = 0
      const pendingOutputMap = new Map()

      const buildCurrentGroup = () => {
        return {
          id: `${taskId}-series-design-group-${batchIndex + 1}`,
          groupIndex: batchIndex,
          groupType: 'batch',
          groupTitle: `第 ${batchIndex + 1} 组`,
          promptSummary: draft.globalPrompt || '',
          notes: `已替换 ${selectedAssignments.length} 张图片`,
          status: failedCount > 0 ? (completedCount > 0 ? 'partial' : 'failed') : (
            completedCount >= selectedAssignments.length ? 'succeeded' : 'running'
          ),
          completedCount,
          failedCount,
          outputs: assignments.map((assignment, index) => {
            return generatedReplacementMap.get(assignment.id) ||
              pendingOutputMap.get(assignment.id) || {
                ...originalOutputs[index],
                id: `${taskId}-series-design-batch-${batchIndex + 1}-original-${index + 1}`
              }
          })
        }
      }

      selectedAssignments.forEach((assignment, selectedIndex) => {
        const batchPrompt = resolveBatchPromptValue({
          differentialEnabled: assignment.differentialEnabled,
          batchPrompts: assignment.batchPrompts,
          fallbackPrompt: assignment.composedPrompt,
          batchIndex,
          batchCount
        })
        const promptFinal = composeStructuredPrompt({
          dedicatedPrompt: batchPrompt,
          globalPrompt: draft.globalPrompt,
          negativePrompt: draft.negativePrompt
        })

        const outputStartedAt = new Date(getNowMs()).toISOString()
        pendingOutputMap.set(assignment.id, createSeriesPendingOutput({
          id: `${taskId}-series-design-${batchIndex + 1}-${selectedIndex + 1}-pending`,
          title: assignment.outputTitle,
          model: assignment.model || draft.model,
          promptFinal,
          assignmentId: assignment.id,
          startedAt: outputStartedAt
        }))
      })

      groupedResults.push(buildCurrentGroup())
      await emitIntermediateGroupedResults()

      const generatedItems = await runTasksWithConcurrency(
        selectedAssignments.map((assignment, selectedIndex) => {
          return async () => {
            const sourceFilePath = assignment.storedPath || assignment.path || ''
            const subtaskIndex = (batchIndex * selectedAssignments.length) + selectedIndex
            const subtaskStartedAtMs = getNowMs()
            const subtaskStartedAt = new Date(subtaskStartedAtMs).toISOString()
            const batchPrompt = resolveBatchPromptValue({
              differentialEnabled: assignment.differentialEnabled,
              batchPrompts: assignment.batchPrompts,
              fallbackPrompt: assignment.composedPrompt,
              batchIndex,
              batchCount
            })
            const promptFinal = composeStructuredPrompt({
              dedicatedPrompt: batchPrompt,
              globalPrompt: draft.globalPrompt,
              negativePrompt: draft.negativePrompt
            })

            for (let groupedAttempt = 0; groupedAttempt <= GROUPED_SUBTASK_AUTO_RETRY_COUNT; groupedAttempt += 1) {
              try {
                const completedResult = await executeRemoteImageTask({
                  jobLabel: `series-design-${batchIndex + 1}-${selectedIndex + 1}`,
                  model: assignment.model || draft.model,
                  prompt: promptFinal,
                  aspectRatio: resolveAspectRatio(assignment.size || draft.size || '1:1'),
                  imageSize: resolveImageSize(assignment.model || draft.model),
                  filePaths: [sourceFilePath],
                  outputDirectory,
                  refreshStallTimeoutOnRunningPoll: true,
                  remoteResultTimeoutMsOverride: GROUPED_REMOTE_RESULT_TOTAL_TIMEOUT_MS,
                  remoteResultStallTimeoutMsOverride: GROUPED_REMOTE_RESULT_STALL_TIMEOUT_MS,
                  maxRetryCountOverride: 0,
                  resolveNextPollIntervalMs: ({ runningPollCount }) => {
                    return resolveGroupedPollIntervalMs({
                      attemptCount: runningPollCount,
                      baseIntervalMs: remoteResultPollIntervalMs
                    })
                  },
                  onProgress: async ({ progress, status }) => {
                    await progressReporter.reportSubtaskProgress(subtaskIndex, progress, status)
                  }
                })
                const savedImage = completedResult.results?.[0]
                if (!savedImage) {
                  throw new Error(`${assignment.name} 未返回可用图片`)
                }

                completedCount += 1
                const subtaskCompletedAtMs = getNowMs()
                const subtaskCompletedAt = new Date(subtaskCompletedAtMs).toISOString()
                const output = {
                  assignmentId: assignment.id,
                  output: {
                    ...createSeriesOutputFromSavedImage(savedImage, {
                      id: `${taskId}-series-design-${batchIndex + 1}-${selectedIndex + 1}`,
                      title: assignment.outputTitle,
                      model: assignment.model || draft.model,
                      sourceTag: 'generated',
                      promptFinal,
                      startedAt: subtaskStartedAt,
                      completedAt: subtaskCompletedAt,
                      elapsedMs: subtaskCompletedAtMs - subtaskStartedAtMs
                    }),
                    assignmentId: assignment.id,
                    status: '已完成'
                  }
                }
                generatedReplacementMap.set(assignment.id, output.output)
                pendingOutputMap.delete(assignment.id)
                groupedResults[groupedResults.length - 1] = buildCurrentGroup()
                await emitIntermediateGroupedResults()
                return output
              } catch (error) {
                if (!shouldAutoRetryGroupedItemError(error)) {
                  throw error
                }

                if (groupedAttempt < GROUPED_SUBTASK_AUTO_RETRY_COUNT) {
                  continue
                }

                failedCount += 1
                await progressReporter.reportSubtaskProgress(subtaskIndex, 100, 'failed')
                const subtaskCompletedAtMs = getNowMs()
                const subtaskCompletedAt = new Date(subtaskCompletedAtMs).toISOString()
                const output = {
                  assignmentId: assignment.id,
                  output: createSeriesEmptyOutput({
                    id: `${taskId}-series-design-${batchIndex + 1}-${selectedIndex + 1}-empty`,
                    title: assignment.outputTitle,
                    model: assignment.model || draft.model,
                    promptFinal,
                    assignmentId: assignment.id,
                    error: error.message,
                    startedAt: subtaskStartedAt,
                    completedAt: subtaskCompletedAt,
                    elapsedMs: subtaskCompletedAtMs - subtaskStartedAtMs
                  })
                }
                generatedReplacementMap.set(assignment.id, output.output)
                pendingOutputMap.delete(assignment.id)
                groupedResults[groupedResults.length - 1] = buildCurrentGroup()
                await emitIntermediateGroupedResults()
                return output
              }
            }
          }
        }),
        seriesGroupConcurrency
      )

      generatedItems.forEach((item) => {
        generatedReplacementMap.set(item.assignmentId, item.output)
      })

      groupedResults[groupedResults.length - 1] = buildCurrentGroup()
      await emitIntermediateGroupedResults()
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

  async function generateSeriesGenerateResults({ draft, taskId, outputDirectory, onProgress, onIntermediateResult }) {
    const seriesGroupConcurrency = SERIES_GROUP_CONCURRENCY
    const batchCount = Math.max(1, Number(draft.batchCount) || 1)
    const promptAssignments = normalizeSeriesGeneratePromptAssignments(draft.promptAssignments, draft.generateCount, batchCount)
    const outputDescriptors = buildSeriesGenerateOutputDescriptors(promptAssignments)
    const generateCount = outputDescriptors.length
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

    async function emitIntermediateGroupedResults() {
      if (typeof onIntermediateResult !== 'function') {
        return
      }

      await onIntermediateResult({
        textResults: [],
        comparisonResults: [],
        groupedResults: groupedResults.slice(),
        summary: {
          title: `套图生成 ${batchCount} 组 x ${generateCount} 张`,
          description: `${draft.model} / ${draft.sourceImage?.name || '参考图'}`
        }
      })
    }

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      let completedCount = 0
      let failedCount = 0
      const outputs = outputDescriptors.map((promptAssignment, outputIndex) => {
        const batchPrompt = resolveBatchPromptValue({
          differentialEnabled: promptAssignment.differentialEnabled,
          batchPrompts: promptAssignment.batchPrompts,
          fallbackPrompt: promptAssignment.composedPrompt,
          batchIndex,
          batchCount
        })
        const promptFinal = composeStructuredPrompt({
          dedicatedPrompt: batchPrompt,
          globalPrompt: draft.globalPrompt,
          negativePrompt: draft.negativePrompt
        })
        const outputStartedAt = new Date(getNowMs()).toISOString()

        return createSeriesPendingOutput({
          id: `${taskId}-series-generate-${batchIndex + 1}-${outputIndex + 1}-pending`,
          title: promptAssignment.outputTitle,
          model: draft.model,
          promptFinal,
          assignmentId: promptAssignment.id,
          startedAt: outputStartedAt
        })
      })
      groupedResults.push({
        id: `${taskId}-series-generate-group-${batchIndex + 1}`,
        groupIndex: batchIndex,
        groupType: 'batch',
        groupTitle: `第 ${batchIndex + 1} 组`,
        promptSummary: draft.globalPrompt || '',
        notes: '',
        status: 'running',
        completedCount,
        failedCount,
        outputs
      })
      await emitIntermediateGroupedResults()
      const resolvedOutputs = await runTasksWithConcurrency(
        outputDescriptors.map((promptAssignment, outputIndex) => {
          return async () => {
            const subtaskIndex = (batchIndex * generateCount) + outputIndex
            const subtaskStartedAtMs = getNowMs()
            const subtaskStartedAt = new Date(subtaskStartedAtMs).toISOString()
            const batchPrompt = resolveBatchPromptValue({
              differentialEnabled: promptAssignment.differentialEnabled,
              batchPrompts: promptAssignment.batchPrompts,
              fallbackPrompt: promptAssignment.composedPrompt,
              batchIndex,
              batchCount
            })
            const promptFinal = composeStructuredPrompt({
              dedicatedPrompt: batchPrompt,
              globalPrompt: draft.globalPrompt,
              negativePrompt: draft.negativePrompt
            })

            for (let groupedAttempt = 0; groupedAttempt <= GROUPED_SUBTASK_AUTO_RETRY_COUNT; groupedAttempt += 1) {
              try {
                const completedResult = await executeRemoteImageTask({
                  jobLabel: `series-generate-${batchIndex + 1}-${outputIndex + 1}`,
                  model: draft.model,
                  prompt: promptFinal,
                  aspectRatio: resolveAspectRatio(draft.size || '1:1'),
                  imageSize: resolveImageSize(draft.model),
                  filePaths: [sourceFilePath],
                  outputDirectory,
                  refreshStallTimeoutOnRunningPoll: true,
                  remoteResultTimeoutMsOverride: GROUPED_REMOTE_RESULT_TOTAL_TIMEOUT_MS,
                  remoteResultStallTimeoutMsOverride: GROUPED_REMOTE_RESULT_STALL_TIMEOUT_MS,
                  maxRetryCountOverride: 0,
                  resolveNextPollIntervalMs: ({ runningPollCount }) => {
                    return resolveGroupedPollIntervalMs({
                      attemptCount: runningPollCount,
                      baseIntervalMs: remoteResultPollIntervalMs
                    })
                  },
                  onProgress: async ({ progress, status }) => {
                    await progressReporter.reportSubtaskProgress(subtaskIndex, progress, status)
                  }
                })
                const savedImage = completedResult.results?.[0]
                if (!savedImage) {
                  throw new Error(`第 ${batchIndex + 1} 组结果 ${outputIndex + 1} 未返回可用图片`)
                }

                completedCount += 1
                const subtaskCompletedAtMs = getNowMs()
                const subtaskCompletedAt = new Date(subtaskCompletedAtMs).toISOString()
                const output = {
                  ...createSeriesOutputFromSavedImage(savedImage, {
                    id: `${taskId}-series-generate-${batchIndex + 1}-${outputIndex + 1}`,
                    title: promptAssignment.outputTitle,
                    model: draft.model,
                    sourceTag: 'generated',
                    promptFinal,
                    startedAt: subtaskStartedAt,
                    completedAt: subtaskCompletedAt,
                    elapsedMs: subtaskCompletedAtMs - subtaskStartedAtMs
                  }),
                  assignmentId: promptAssignment.id,
                  status: '已完成'
                }
                outputs[outputIndex] = output
                groupedResults[groupedResults.length - 1] = {
                  ...groupedResults[groupedResults.length - 1],
                  status: failedCount > 0 ? 'partial' : (completedCount >= generateCount ? 'succeeded' : 'running'),
                  completedCount,
                  failedCount,
                  outputs: outputs.slice()
                }
                await emitIntermediateGroupedResults()
                return output
              } catch (error) {
                if (!shouldAutoRetryGroupedItemError(error)) {
                  throw error
                }

                if (groupedAttempt < GROUPED_SUBTASK_AUTO_RETRY_COUNT) {
                  continue
                }

                failedCount += 1
                await progressReporter.reportSubtaskProgress(subtaskIndex, 100, 'failed')
                const subtaskCompletedAtMs = getNowMs()
                const subtaskCompletedAt = new Date(subtaskCompletedAtMs).toISOString()
                const output = createSeriesEmptyOutput({
                  id: `${taskId}-series-generate-${batchIndex + 1}-${outputIndex + 1}-empty`,
                  title: promptAssignment.outputTitle,
                  model: draft.model,
                  promptFinal,
                  assignmentId: promptAssignment.id,
                  error: error.message,
                  startedAt: subtaskStartedAt,
                  completedAt: subtaskCompletedAt,
                  elapsedMs: subtaskCompletedAtMs - subtaskStartedAtMs
                })
                outputs[outputIndex] = output
                groupedResults[groupedResults.length - 1] = {
                  ...groupedResults[groupedResults.length - 1],
                  status: completedCount > 0 ? 'partial' : 'failed',
                  completedCount,
                  failedCount,
                  outputs: outputs.slice()
                }
                await emitIntermediateGroupedResults()
                return output
              }
            }
          }
        }),
        seriesGroupConcurrency
      )

      groupedResults[groupedResults.length - 1] = {
        id: `${taskId}-series-generate-group-${batchIndex + 1}`,
        groupIndex: batchIndex,
        groupType: 'batch',
        groupTitle: `第 ${batchIndex + 1} 组`,
        promptSummary: draft.globalPrompt || '',
        notes: '',
        status: failedCount > 0 ? (completedCount > 0 ? 'partial' : 'failed') : 'succeeded',
        completedCount,
        failedCount,
        outputs: resolvedOutputs.length ? outputs : outputs
      }
      await emitIntermediateGroupedResults()
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

  async function generateImageResults({ menuKey, draft, taskId, outputDirectory, onProgress, onIntermediateResult }) {
    validateStudioImageTask({
      menuKey,
      draft
    })

    if (menuKey === 'single-image') {
      return generateSingleImageResults({
        draft,
        taskId,
        outputDirectory,
        onProgress,
        onIntermediateResult
      })
    }

    if (menuKey === 'single-design') {
      return generateSingleDesignResults({
        draft,
        taskId,
        outputDirectory,
        onProgress,
        onIntermediateResult
      })
    }

    if (menuKey === 'series-design') {
      return generateSeriesDesignResults({
        draft,
        taskId,
        outputDirectory,
        onProgress,
        onIntermediateResult
      })
    }

    if (menuKey === 'series-generate') {
      return generateSeriesGenerateResults({
        draft,
        taskId,
        outputDirectory,
        onProgress,
        onIntermediateResult
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
  SERIES_GENERATE_SOFT_TOTAL,
  SERIES_GROUP_CONCURRENCY,
  MAX_SERIES_GENERATE_GROUP_SIZE,
  normalizeSingleImageModels,
  createStudioImageGenerationService
}

