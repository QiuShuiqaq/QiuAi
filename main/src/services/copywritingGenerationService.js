const { createHttpClientService } = require('./httpClientService')
const { createChatCompletion } = require('./chatCompletionService')
const { toDataUrl, getMimeTypeFromPath } = require('./localInputAssetService')

const COPYWRITING_TIMEOUT_MS = 120000

function getReferenceImagePaths(draft = {}) {
  return Array.isArray(draft.referenceImages)
    ? draft.referenceImages
      .map((item) => item.storedPath || item.path || '')
      .filter(Boolean)
    : []
}

function buildSystemPrompt() {
  return '你是资深中文电商文案助手。仅返回最终可直接使用的内容，不要解释，不要加标题，不要加引号，不要输出多余前缀。'
}

function resolveQuantity(draft = {}) {
  return Math.max(1, Number(draft.quantity) || 1)
}

function buildUserPrompt(draft = {}) {
  const quantity = resolveQuantity(draft)

  return [
    `总体要求：${draft.prompt || '请结合输入生成内容'}`,
    `请一次性输出 ${quantity} 条可直接使用的中文文案结果。`,
    '输出要求：每条结果单独换行，不要编号，不要解释，不要分点，不要 Markdown。'
  ].join('\n')
}

function normalizeResultLines(rawContent = '') {
  return String(rawContent || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .map((item) => item.replace(/^(?:\d+[.、)]\s*|[-*]\s*)/, '').trim())
    .filter(Boolean)
}

async function createReferenceImageContentParts(draft = {}, {
  toDataUrlDependency = toDataUrl,
  getMimeTypeFromPathDependency = getMimeTypeFromPath
} = {}) {
  const imagePaths = getReferenceImagePaths(draft)
  const contentParts = []

  for (const imagePath of imagePaths) {
    const dataUrl = await toDataUrlDependency({
      filePath: imagePath,
      mimeType: getMimeTypeFromPathDependency(imagePath)
    })
    contentParts.push({
      type: 'image_url',
      image_url: {
        url: dataUrl
      }
    })
  }

  return contentParts
}

function resolveApiKey(settings = {}) {
  if (typeof settings.apiKey === 'string' && settings.apiKey.trim()) {
    return settings.apiKey.trim()
  }

  const activeIndex = Number.isInteger(settings.activeApiKeyIndex) ? settings.activeApiKeyIndex : 0
  const apiKey = Array.isArray(settings.apiKeys) ? settings.apiKeys[activeIndex] : ''
  return typeof apiKey === 'string' ? apiKey.trim() : ''
}

function createCopywritingGenerationService({
  settingsService,
  messageRecorder,
  createHttpClientServiceDependency = createHttpClientService,
  createChatCompletionDependency = createChatCompletion,
  toDataUrlDependency = toDataUrl,
  getMimeTypeFromPathDependency = getMimeTypeFromPath
}) {
  async function generateCopywritingResults({ draft, taskId }) {
    const settings = settingsService.getSettings()
    const apiKey = resolveApiKey(settings)

    if (!apiKey) {
      throw new Error('请先保存可用的 API-Key。')
    }

    const httpClient = createHttpClientServiceDependency({
      apiBaseUrl: settings.apiBaseUrl,
      apiKey,
      messageRecorder,
      timeoutMs: COPYWRITING_TIMEOUT_MS
    })
    const referenceImageParts = draft.copyMode === 'image-reference'
      ? await createReferenceImageContentParts(draft, {
          toDataUrlDependency,
          getMimeTypeFromPathDependency
        })
      : []

    const userPrompt = buildUserPrompt(draft)
    const messages = [
      {
        role: 'system',
        content: buildSystemPrompt()
      }
    ]

    if (referenceImageParts.length) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: userPrompt
          },
          ...referenceImageParts
        ]
      })
    } else {
      messages.push({
        role: 'user',
        content: userPrompt
      })
    }

    const completion = await createChatCompletionDependency({
      model: draft.model,
      messages
    }, {
      httpClient
    })

    const resultLines = normalizeResultLines(completion.content).slice(0, resolveQuantity(draft))

    if (!resultLines.length) {
      throw new Error('文案模型未返回可用结果。')
    }

    return resultLines.map((content, index) => {
      const order = index + 1
      return {
        id: `${taskId}-copywriting-${order}`,
        title: `文案 ${order}`,
        format: 'txt',
        content
      }
    })
  }

  return {
    generateCopywritingResults
  }
}

module.exports = {
  createCopywritingGenerationService
}
