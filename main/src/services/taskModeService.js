const crypto = require('node:crypto')
const path = require('node:path')
const {
  ensureDirectory,
  getTaskDataDirectories
} = require('./dataPathsService')
const { persistSourceFiles } = require('./inputAssetStorageService')

const detailSetPresets = [
  { label: '白底主图', suffix: '白底主图，突出主体，电商产品摄影' },
  { label: '场景图', suffix: '生活方式场景图，统一风格，适合电商详情页' },
  { label: '卖点图', suffix: '卖点构图图，突出核心卖点，适合商品详情介绍' },
  { label: '细节图', suffix: '细节特写图，突出材质、工艺与品质感' }
]

function createTaskModeService ({
  createId = () => crypto.randomUUID(),
  ensureDirectory: ensureDirectoryDependency = ensureDirectory,
  persistSourceFiles: persistSourceFilesDependency = persistSourceFiles
} = {}) {
  async function createBaseTask ({
    mode,
    name,
    size,
    prompt,
    templateId = '',
    sourcePaths = [],
    items = []
  }) {
    const id = createId()
    const {
      featureKey,
      inputDirectory,
      outputDirectory
    } = getTaskDataDirectories({
      featureKey: mode,
      taskId: id
    })

    await ensureDirectoryDependency(inputDirectory)
    await ensureDirectoryDependency(outputDirectory)

    const persistedSourcePaths = await persistSourceFilesDependency({
      sourcePaths,
      targetDirectory: inputDirectory
    })

    const persistedSourcePathMap = new Map(sourcePaths.map((sourcePath, index) => [sourcePath, persistedSourcePaths[index] || '']))

    return {
      id,
      mode,
      featureKey,
      name,
      createdAt: new Date().toISOString(),
      status: 'draft',
      progress: 0,
      size,
      prompt,
      templateId,
      sourcePaths: persistedSourcePaths,
      inputDirectory,
      outputDirectory,
      items: items.map((item, index) => ({
        ...item,
        sourcePath: persistedSourcePathMap.get(item.sourcePath) || persistedSourcePaths[index] || item.sourcePath || ''
      }))
    }
  }

  async function createStyleBatchTask ({ folderPath, prompt, size, templateId = '', sourcePaths = [] }) {
    return createBaseTask({
      mode: 'style-batch',
      name: path.basename(folderPath || 'style-batch'),
      size,
      prompt,
      templateId,
      sourcePaths,
      items: sourcePaths.map((sourcePath) => ({
        id: createId(),
        label: path.basename(sourcePath),
        sourcePath,
        prompt,
        remoteTaskId: '',
        status: 'pending',
        progress: 0,
        failureReason: '',
        error: '',
        results: []
      }))
    })
  }

  async function createDetailSetTask ({ sourcePath, basePrompt, size, templateId = '' }) {
    return createBaseTask({
      mode: 'detail-set',
      name: path.basename(sourcePath || 'detail-set'),
      size,
      prompt: basePrompt,
      templateId,
      sourcePaths: sourcePath ? [sourcePath] : [],
      items: detailSetPresets.map((preset) => ({
        id: createId(),
        label: preset.label,
        sourcePath,
        prompt: [basePrompt, preset.suffix].filter(Boolean).join('，'),
        remoteTaskId: '',
        status: 'pending',
        progress: 0,
        failureReason: '',
        error: '',
        results: []
      }))
    })
  }

  async function createSingleTask ({ prompt, size, templateId = '' }) {
    return createBaseTask({
      mode: 'single',
      name: '单图生成',
      size,
      prompt,
      templateId,
      sourcePaths: [],
      items: [
        {
          id: createId(),
          label: '文生图',
          sourcePath: '',
          prompt,
          remoteTaskId: '',
          status: 'pending',
          progress: 0,
          failureReason: '',
          error: '',
          results: []
        }
      ]
    })
  }

  return {
    detailSetPresets,
    createSingleTask,
    createStyleBatchTask,
    createDetailSetTask
  }
}

module.exports = {
  detailSetPresets,
  createTaskModeService
}
