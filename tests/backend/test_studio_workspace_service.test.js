import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

function createPreviewDataUrl(label) {
  return `data:image/png;base64,${Buffer.from(label, 'utf8').toString('base64')}`
}

function createEmptyOutputScanDependencies() {
  return {
    readdirSync: () => [],
    statSync: () => null
  }
}

describe('studioWorkspaceService', () => {
  it('enqueues studio tasks immediately and completes them in background', async () => {
    const memory = new Map()
    const store = {
      get(key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set(key, value) {
        memory.set(key, value)
      }
    }

    let resolveGeneration
    const generationPromise = new Promise((resolve) => {
      resolveGeneration = resolve
    })

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      ...createEmptyOutputScanDependencies(),
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined,
      generateCopywritingResults: vi.fn(async () => {
        await generationPromise
        return [
          {
            id: 'copy-result-1',
            title: '电商标题 1',
            format: 'txt',
            content: '轻薄风衣女春秋高级感通勤外套'
          }
        ]
      }),
      createId: () => 'studio-queued-1',
      createTaskNumber: () => 'QAI-20260426-0001',
      getNow: () => '2026-04-26T03:00:00.000Z'
    })

    await service.saveDraft({
      menuKey: 'copywriting',
      patch: {
        prompt: '请生成电商标题',
        model: 'gemini-3-pro',
        taskName: 'QueuedCopy',
        quantity: 1
      }
    })

    const createdTask = await service.createTask({
      menuKey: 'copywriting'
    })

    expect(createdTask.status).toBe('等待中')
    expect(createdTask.progress).toBe(0)
    expect(createdTask.taskNumber).toBe('QAI-20260426-0001')

    const queuedSnapshot = service.getSnapshot()
    expect(queuedSnapshot.tasks[0].status).toBe('进行中')
    expect(queuedSnapshot.tasks[0].progress).toBe(0)
    expect(queuedSnapshot.resultsByMenu.copywriting.textResults).toEqual([])
    expect(queuedSnapshot.exportItemsByMenu.copywriting).toEqual([])

    resolveGeneration()
    await service.waitForIdle()

    const completedSnapshot = service.getSnapshot()
    expect(completedSnapshot.tasks[0].status).toBe('已完成')
    expect(completedSnapshot.tasks[0].progress).toBe(100)
    expect(completedSnapshot.resultsByMenu.copywriting).toMatchObject({
      textResults: [
        {
          title: '电商标题 1',
          format: 'txt',
          content: '轻薄风衣女春秋高级感通勤外套'
        }
      ],
      summary: {
        elapsedLabel: '生成耗时 0.0 秒',
        statusLabel: '已完成',
        resultCountLabel: '结果数量 1'
      }
    })
    expect(completedSnapshot.exportItemsByMenu.copywriting[0].name).toBe('QueuedCopy0')
  })

  it('updates studio image task progress from remote progress callbacks instead of keeping a placeholder value', async () => {
    const memory = new Map()
    const store = {
      get(key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set(key, value) {
        memory.set(key, value)
      }
    }

    let resolveGeneration
    const generationPromise = new Promise((resolve) => {
      resolveGeneration = resolve
    })
    let resolveFirstProgress
    const firstProgressPromise = new Promise((resolve) => {
      resolveFirstProgress = resolve
    })
    let resolveSecondProgress
    const secondProgressPromise = new Promise((resolve) => {
      resolveSecondProgress = resolve
    })

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    const generateImageResults = vi.fn(async ({ onProgress, taskId }) => {
      await onProgress({
        progress: 18,
        status: 'running'
      })
      resolveFirstProgress()
      await generationPromise
      await onProgress({
        progress: 67,
        status: 'running'
      })
      resolveSecondProgress()

      return {
        textResults: [],
        comparisonResults: [
          {
            id: `${taskId}-single-1`,
            model: 'nano-banana-fast',
            title: 'nano-banana-fast 对比结果',
            preview: createPreviewDataUrl('single-progress-1'),
            sourceImageName: 'bag-main.jpg',
            status: '已完成'
          }
        ],
        groupedResults: [],
        summary: {
          title: '单图四模型对比',
          description: '真实进度测试'
        }
      }
    })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      ...createEmptyOutputScanDependencies(),
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined,
      generateImageResults,
      createId: () => 'studio-progress-1',
      createTaskNumber: () => 'QAI-20260427-0001',
      getNow: () => '2026-04-27T03:00:00.000Z'
    })

    await service.saveDraft({
      menuKey: 'single-image',
      patch: {
        prompt: '测试不同模型生图质量',
        taskName: 'ProgressA',
        sourceImage: {
          name: 'bag-main.jpg',
          path: 'C:/images/bag-main.jpg'
        }
      }
    })

    const createdTask = await service.createTask({
      menuKey: 'single-image'
    })

    expect(createdTask.status).toBe('等待中')
    expect(createdTask.progress).toBe(0)

    await firstProgressPromise
    const firstProgressSnapshot = service.getSnapshot()
    expect(firstProgressSnapshot.tasks[0].status).toBe('进行中')
    expect(firstProgressSnapshot.tasks[0].progress).toBe(18)

    resolveGeneration()
    await secondProgressPromise
    const secondProgressSnapshot = service.getSnapshot()
    expect(secondProgressSnapshot.tasks[0].progress).toBe(67)

    await service.waitForIdle()

    const completedSnapshot = service.getSnapshot()
    expect(completedSnapshot.tasks[0].status).toBe('已完成')
    expect(completedSnapshot.tasks[0].progress).toBe(100)
    expect(generateImageResults).toHaveBeenCalledWith(expect.objectContaining({
      menuKey: 'single-image',
      taskId: 'studio-progress-1',
      onProgress: expect.any(Function)
    }))
  })

  it('returns desktop studio snapshot with fixed menus and theme options', async () => {
    const memory = new Map()
    const store = {
      get(key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set(key, value) {
        memory.set(key, value)
      }
    }

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      ...createEmptyOutputScanDependencies(),
      ensureDirectory: async () => undefined,
      persistSourceFiles: async ({ sourcePaths, targetDirectory }) => sourcePaths.map((sourcePath) => {
        return `${targetDirectory}/${sourcePath.split('/').pop()}`
      }),
      writeFile: async () => undefined,
      createId: (() => {
        let counter = 0
        return () => `studio-${++counter}`
      })()
    })

    const snapshot = service.getSnapshot()

    expect(snapshot.themeMode).toBe('dark')
    expect(snapshot.themeOptions.map((item) => item.value)).toEqual(['dark', 'light', 'eye-care'])
    expect(snapshot.menuItems.map((item) => item.key)).toEqual([
      'workspace',
      'copywriting',
      'single-image',
      'single-design',
      'series-design',
      'series-generate',
      'model-pricing'
    ])
    expect(snapshot.copywritingModelOptions.map((item) => item.value)).toEqual([
      'gemini-3-pro',
      'gemini-3.1-pro'
    ])
    expect(snapshot.imageModelOptions.map((item) => item.value)).toEqual([
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
    expect(snapshot.modelPricingCatalog.some((item) => item.name === 'gpt-image-2')).toBe(true)
    expect(snapshot.formDrafts.copywriting.copyMode).toBe('prompt-only')
    expect(snapshot.formDrafts.copywriting.referenceImages).toEqual([])
    expect(snapshot.formDrafts.copywriting.copyType).toBeUndefined()
    expect(snapshot.formDrafts.copywriting.inputMode).toBeUndefined()
    expect(snapshot.formDrafts.copywriting.importFileName).toBeUndefined()
    expect(snapshot.formDrafts.copywriting.taskName).toBe('')
    expect(snapshot.formDrafts.copywriting.quantity).toBe(5)
    expect(snapshot.formDrafts['single-image'].compareModels).toHaveLength(4)
    expect(snapshot.formDrafts['single-design'].sourceImage).toBe(null)
    expect(snapshot.formDrafts['single-design'].model).toBe('gpt-image-2')
    expect(snapshot.formDrafts['series-design'].imageAssignments).toEqual([])
    expect(snapshot.formDrafts['series-design'].batchCount).toBe(1)
    expect(snapshot.formDrafts['series-generate'].globalPrompt).toBe('统一商品详情图整体风格')
    expect(snapshot.formDrafts['series-generate'].generateCount).toBe(4)
    expect(snapshot.formDrafts['series-generate'].promptAssignments).toHaveLength(4)
    expect(snapshot.formDrafts['series-generate'].batchCount).toBe(1)
    expect(snapshot.workspaceDashboard.copywritingStats.title).toBe('文案生成统计')
    expect(snapshot.workspaceDashboard.copywritingStats.items.some((item) => item.label === '模型调用次数')).toBe(true)
    expect(snapshot.workspaceDashboard.copywritingStats.items).toHaveLength(6)
    expect(snapshot.workspaceDashboard.copywritingStats.items.some((item) => item.label === '最近任务时间')).toBe(false)
    expect(snapshot.workspaceDashboard.seriesDesignStats.title).toBe('套图设计统计')
    expect(snapshot.workspaceDashboard.singleImageStats.title).toBe('单图测试统计')
    expect(snapshot.workspaceDashboard.seriesGenerateStats.title).toBe('套图生成统计')
    expect(snapshot.settingsSummary.apiKeys).toEqual(['', ''])
    expect(snapshot.settingsSummary.activeApiKeyIndex).toBe(0)
    expect(snapshot.hostInfo.systemName).toBeTruthy()
    expect(snapshot.hostInfo.runtimeName).toContain('Node')
  })

  it('persists module drafts and creates grouped studio tasks', async () => {
    const memory = new Map()
    const store = {
      get(key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set(key, value) {
        memory.set(key, value)
      }
    }

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    const generatedCopyOutputs = [
      {
        id: 'copy-result-1',
        title: '电商标题 1',
        format: 'txt',
        content: '轻薄风衣女春秋高级感通勤外套'
      },
      {
        id: 'copy-result-2',
        title: '电商标题 2',
        format: 'txt',
        content: '通勤西装外套修身显瘦百搭气质款'
      }
    ]
    const generateImageResults = vi.fn(async ({ menuKey, draft, taskId }) => {
      if (menuKey === 'single-image') {
        return {
          textResults: [],
          comparisonResults: [
            {
              id: `${taskId}-single-1`,
              model: 'nano-banana-fast',
              title: 'nano-banana-fast 对比结果',
              preview: createPreviewDataUrl('single-1'),
              promptSummary: draft.prompt,
              sourceImageName: draft.sourceImage?.name || '',
              status: '已完成'
            },
            {
              id: `${taskId}-single-2`,
              model: 'gpt-image-2',
              title: 'gpt-image-2 对比结果',
              preview: createPreviewDataUrl('single-2'),
              promptSummary: draft.prompt,
              sourceImageName: draft.sourceImage?.name || '',
              status: '已完成'
            },
            {
              id: `${taskId}-single-3`,
              model: 'nano-banana-2',
              title: 'nano-banana-2 对比结果',
              preview: createPreviewDataUrl('single-3'),
              promptSummary: draft.prompt,
              sourceImageName: draft.sourceImage?.name || '',
              status: '已完成'
            },
            {
              id: `${taskId}-single-4`,
              model: 'nano-banana-2-cl',
              title: 'nano-banana-2-cl 对比结果',
              preview: createPreviewDataUrl('single-4'),
              promptSummary: draft.prompt,
              sourceImageName: draft.sourceImage?.name || '',
              status: '已完成'
            }
          ],
          groupedResults: [],
          summary: {
            title: '单图四模型对比',
            description: '真实图片任务链'
          }
        }
      }

      if (menuKey === 'series-design') {
        return {
          textResults: [],
          comparisonResults: [],
          groupedResults: [
            {
              id: `${taskId}-series-design-group-1`,
              groupType: 'batch',
              groupTitle: '第 1 组',
            promptSummary: draft.globalPrompt,
            notes: '',
            outputs: [
                {
                  id: `${taskId}-series-design-group-1-1`,
                  title: 'look-1.jpg',
                  model: draft.model,
                  preview: createPreviewDataUrl('series-design-1-1')
                },
                {
                  id: `${taskId}-series-design-group-1-2`,
                  title: 'look-2.jpg',
                  model: draft.model,
                  preview: createPreviewDataUrl('series-design-1-2')
                }
              ]
            }
          ],
          summary: {
            title: '套图设计 1 组',
            description: '真实图片任务链'
          }
        }
      }

      return {
        textResults: [],
        comparisonResults: [],
        groupedResults: [
          {
            id: `${taskId}-series-generate-group-1`,
            groupType: 'batch',
            groupTitle: '第 1 组',
            promptSummary: draft.globalPrompt,
            notes: '',
            outputs: [
              {
                id: `${taskId}-series-generate-group-1-1`,
                title: '第 1 张',
                model: draft.model,
                preview: createPreviewDataUrl('series-generate-1-1')
              },
              {
                id: `${taskId}-series-generate-group-1-2`,
                title: '第 2 张',
                model: draft.model,
                preview: createPreviewDataUrl('series-generate-1-2')
              },
              {
                id: `${taskId}-series-generate-group-1-3`,
                title: '第 3 张',
                model: draft.model,
                preview: createPreviewDataUrl('series-generate-1-3')
              }
            ]
          },
          {
            id: `${taskId}-series-generate-group-2`,
            groupType: 'batch',
            groupTitle: '第 2 组',
            promptSummary: draft.globalPrompt,
            notes: '',
            outputs: [
              {
                id: `${taskId}-series-generate-group-2-1`,
                title: '第 1 张',
                model: draft.model,
                preview: createPreviewDataUrl('series-generate-2-1')
              },
              {
                id: `${taskId}-series-generate-group-2-2`,
                title: '第 2 张',
                model: draft.model,
                preview: createPreviewDataUrl('series-generate-2-2')
              },
              {
                id: `${taskId}-series-generate-group-2-3`,
                title: '第 3 张',
                model: draft.model,
                preview: createPreviewDataUrl('series-generate-2-3')
              }
            ]
          }
        ],
        summary: {
          title: '套图生成 2 组',
          description: '真实图片任务链'
        }
      }
    })
    const taskManagerRecords = []
    const taskManagerService = {
      listTasks: vi.fn(() => taskManagerRecords.slice()),
      saveTask: vi.fn((task) => {
        taskManagerRecords.unshift(task)
        for (let index = taskManagerRecords.length - 1; index > 0; index -= 1) {
          if (taskManagerRecords[index].id === task.id) {
            taskManagerRecords.splice(index, 1)
          }
        }
        return task
      })
    }
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      ...createEmptyOutputScanDependencies(),
      ensureDirectory: async () => undefined,
      persistSourceFiles: async ({ sourcePaths, targetDirectory }) => sourcePaths.map((sourcePath) => {
        return `${targetDirectory}/${sourcePath.split('/').pop()}`
      }),
      writeFile: async () => undefined,
      generateCopywritingResults: async () => generatedCopyOutputs,
      generateImageResults,
      taskManagerService,
      createId: (() => {
        let counter = 0
        return () => `studio-${++counter}`
      })(),
      createTaskNumber: (() => {
        let counter = 0
        return () => `QAI-20260425-${String(++counter).padStart(4, '0')}`
      })(),
      getNow: () => '2026-04-25T11:30:00.000Z'
    })

    const draft = await service.saveDraft({
      menuKey: 'copywriting',
      patch: {
        prompt: '春季女装外套',
        model: 'gemini-3-pro',
        taskName: 'CopyA',
        quantity: 2,
        copyMode: 'image-reference',
        referenceImages: [
          {
            name: 'coat-main.jpg',
            path: 'C:/images/coat-main.jpg'
          }
        ]
      }
    })

    expect(draft.prompt).toBe('春季女装外套')
    expect(draft.model).toBe('gemini-3-pro')
    expect(draft.taskName).toBe('CopyA')
    expect(draft.copyMode).toBe('image-reference')
    expect(draft.quantity).toBe(2)
    expect(draft.referenceImages[0].name).toBe('coat-main.jpg')

    const normalizedDraft = await service.saveDraft({
      menuKey: 'copywriting',
      patch: {
        model: 'gpt-image-2'
      }
    })

    expect(normalizedDraft.model).toBe('gemini-3-pro')

    const createdCopyTask = await service.createTask({
      menuKey: 'copywriting'
    })

    expect(createdCopyTask.category).toBe('文案设计')
    expect(createdCopyTask.title).toContain('文案生成')
    expect(createdCopyTask.status).toBe('等待中')
    expect(createdCopyTask.progress).toBe(0)
    expect(createdCopyTask.taskNumber).toBe('QAI-20260425-0001')
    expect(createdCopyTask.inputCount).toBe(1)
    expect(createdCopyTask.plannedOutputCount).toBe(2)
    expect(createdCopyTask.inputDirectory.replace(/\\/g, '/')).toContain('/DATA/input/copywriting/')
    expect(createdCopyTask.outputDirectory.replace(/\\/g, '/')).toContain('/DATA/output/copywriting/')

    await service.saveDraft({
      menuKey: 'single-image',
      patch: {
        prompt: '提升质感，适合电商主图测试',
        taskName: 'SingleA',
        quantity: 1,
        sourceImage: {
          name: 'bag-main.jpg',
          path: 'C:/images/bag-main.jpg'
        },
        compareModels: ['gpt-image-2', 'nano-banana-pro', 'nano-banana-fast', 'nano-banana-2']
      }
    })

    const createdSingleTask = await service.createTask({
      menuKey: 'single-image'
    })

    expect(createdSingleTask.title).toBe('单图四模型对比')
    expect(createdSingleTask.modelSummary).toContain('gpt-image-2')
    expect(createdSingleTask.inputCount).toBe(1)
    expect(createdSingleTask.plannedOutputCount).toBe(4)
    expect(createdSingleTask.taskNumber).toBe('QAI-20260425-0002')

    await service.saveDraft({
      menuKey: 'series-design',
      patch: {
        globalPrompt: '统一高端电商风格',
        taskName: 'SeriesA',
        imageAssignments: [
          {
            name: 'look-1.jpg',
            path: 'C:/images/look-1.jpg',
            selected: true,
            prompt: '主图强化材质光泽'
          },
          {
            name: 'look-2.jpg',
            path: 'C:/images/look-2.jpg',
            selected: true,
            prompt: '详情图增加空间感'
          }
        ]
      }
    })

    const createdSeriesDesignTask = await service.createTask({
      menuKey: 'series-design'
    })

    expect(createdSeriesDesignTask.title).toContain('套图定向生成')
    expect(createdSeriesDesignTask.inputCount).toBe(2)
    expect(createdSeriesDesignTask.plannedOutputCount).toBe(2)

    await service.saveDraft({
      menuKey: 'series-generate',
      patch: {
        globalPrompt: '统一高端商品详情页风格',
        taskName: 'SeriesB',
        generateCount: 3,
        batchCount: 2,
        promptAssignments: [
          { index: 1, prompt: '生成第一张场景主视觉图' },
          { index: 2, prompt: '生成第二张卖点细节图' },
          { index: 3, prompt: '生成第三张材质展示图' }
        ],
        sourceImage: {
          name: 'shoe-main.jpg',
          path: 'C:/images/shoe-main.jpg'
        }
      }
    })

    const createdSeriesGenerateTask = await service.createTask({
      menuKey: 'series-generate'
    })

    expect(createdSeriesGenerateTask.title).toContain('套图生成')
    expect(createdSeriesGenerateTask.batchCount).toBe(2)
    expect(createdSeriesGenerateTask.plannedOutputCount).toBe(6)
    await service.waitForIdle()
    expect(generateImageResults).toHaveBeenCalledTimes(3)
    expect(generateImageResults).toHaveBeenCalledWith(expect.objectContaining({
      menuKey: 'single-image',
      taskId: 'studio-2'
    }))

    const snapshot = service.getSnapshot()
    expect(snapshot.resultsByMenu.copywriting.textResults.length).toBe(2)
    expect(snapshot.resultsByMenu.copywriting.textResults[0].format).toBe('txt')
    expect(snapshot.exportItemsByMenu.copywriting).toHaveLength(1)
    expect(snapshot.formDrafts.copywriting.model).toBe('gemini-3-pro')
    expect(snapshot.formDrafts.copywriting.referenceImages.length).toBe(1)
    expect(snapshot.formDrafts.copywriting.referenceImages[0].storedPath.replace(/\\/g, '/')).toContain('/DATA/input/copywriting/')
    expect(snapshot.exportItemsByMenu.copywriting[0].type).toBe('FOLDER')
    expect(snapshot.exportItemsByMenu.copywriting[0].name).toBe('CopyA0')
    expect(snapshot.exportItemsByMenu.copywriting[0].directoryPath.replace(/\\/g, '/')).toContain('/DATA/output/copywriting/')
    expect(snapshot.resultsByMenu.copywriting.textResults[0].content).toBe('轻薄风衣女春秋高级感通勤外套')
    expect(snapshot.resultsByMenu.copywriting.summary).toMatchObject({
      elapsedLabel: '生成耗时 0.0 秒',
      resultCountLabel: '结果数量 2',
      modelLabel: '使用模型 gemini-3-pro'
    })
    expect(snapshot.resultsByMenu['single-image'].comparisonResults).toHaveLength(4)
    expect(snapshot.resultsByMenu['single-image'].comparisonResults[0].model).toBe('nano-banana-fast')
    expect(snapshot.resultsByMenu['single-image'].summary).toMatchObject({
      elapsedLabel: '生成耗时 0.0 秒',
      resultCountLabel: '结果数量 4',
      modelLabel: '使用模型 nano-banana-fast / gpt-image-2 / nano-banana-2 / nano-banana-2-cl'
    })
    expect(snapshot.exportItemsByMenu['single-image']).toHaveLength(1)
    expect(snapshot.exportItemsByMenu['single-image'][0].name).toBe('SingleA0')
    expect(snapshot.resultsByMenu['series-design'].groupedResults).toHaveLength(1)
    expect(snapshot.resultsByMenu['series-design'].groupedResults[0].outputs).toHaveLength(2)
    expect(snapshot.resultsByMenu['series-design'].groupedResults[0].groupTitle).toContain('第 1 组')
    expect(snapshot.resultsByMenu['series-design'].summary).toMatchObject({
      elapsedLabel: '生成耗时 0.0 秒',
      resultCountLabel: '结果数量 2'
    })
    expect(snapshot.exportItemsByMenu['series-design']).toHaveLength(1)
    expect(snapshot.exportItemsByMenu['series-design'][0].name).toBe('SeriesA0')
    expect(snapshot.resultsByMenu['series-generate'].groupedResults).toHaveLength(2)
    expect(snapshot.resultsByMenu['series-generate'].groupedResults[0].outputs).toHaveLength(3)
    expect(snapshot.resultsByMenu['series-generate'].summary).toMatchObject({
      elapsedLabel: '生成耗时 0.0 秒',
      resultCountLabel: '结果数量 6'
    })
    expect(snapshot.exportItemsByMenu['series-generate']).toHaveLength(2)
    expect(snapshot.exportItemsByMenu['series-generate'][0].name).toBe('SeriesB0')
    expect(snapshot.exportItemsByMenu['series-generate'][1].name).toBe('SeriesB1')
    expect(snapshot.tasks[0].taskNumber).toBe('QAI-20260425-0004')
    expect(snapshot.tasks[0].category).toBe('套图生成')
    expect(snapshot.tasks[0].plannedOutputCount).toBe(6)
    expect(snapshot.tasks.map((task) => task.category)).toEqual(expect.arrayContaining([
      '文案设计',
      '单图测试',
      '套图设计',
      '套图生成'
    ]))
    expect(snapshot.workspaceDashboard.copywritingStats.items.find((item) => item.label === '模型调用次数')?.value).toBe('1')
    expect(snapshot.workspaceDashboard.copywritingStats.items.find((item) => item.label === '已存储结果')?.value).toBe(String(snapshot.exportItemsByMenu.copywriting.length))
    expect(snapshot.workspaceDashboard.singleImageStats.items.find((item) => item.label === '模型调用次数')?.value).toBe('1')
    expect(snapshot.workspaceDashboard.seriesDesignStats.items.find((item) => item.label === '模型调用次数')?.value).toBe('1')
    expect(snapshot.workspaceDashboard.seriesGenerateStats.items.find((item) => item.label === '模型调用次数')?.value).toBe('1')
    expect(snapshot.workspaceDashboard.copywritingStats.items.some((item) => item.label === '最近任务时间')).toBe(false)
    expect(taskManagerService.saveTask).toHaveBeenCalledTimes(12)
  })

  it('fails copywriting tasks instead of saving placeholder output when model generation fails', async () => {
    const memory = new Map()
    const store = {
      get(key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set(key, value) {
        memory.set(key, value)
      }
    }

    const runtimeLogger = {
      log: vi.fn().mockResolvedValue(undefined)
    }

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      ...createEmptyOutputScanDependencies(),
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined,
      generateCopywritingResults: async () => {
        throw new Error('文案模型调用失败：429 rate limit')
      },
      runtimeLogger,
      createId: () => 'studio-copy-failed',
      getNow: () => '2026-04-25T11:30:00.000Z'
    })

    await service.saveDraft({
      menuKey: 'copywriting',
      patch: {
        prompt: '请生成电商标题',
        model: 'gemini-3-pro',
        quantity: 1
      }
    })

    await expect(service.createTask({
      menuKey: 'copywriting'
    })).resolves.toMatchObject({
      status: '等待中',
      progress: 0
    })

    await service.waitForIdle()

    const snapshot = service.getSnapshot()
    expect(snapshot.resultsByMenu.copywriting.textResults).toEqual([])
    expect(snapshot.exportItemsByMenu.copywriting).toEqual([])
    expect(snapshot.tasks[0].status).toBe('失败')
    expect(snapshot.tasks[0].progress).toBe(100)
    expect(snapshot.tasks[0].plannedOutputCount).toBe(0)
    expect(runtimeLogger.log).toHaveBeenCalled()
  })

  it('exports selected studio results into a zip archive', async () => {
    const memory = new Map()
    const store = {
      get(key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set(key, value) {
        memory.set(key, value)
      }
    }

    const copiedFiles = []
    const removedDirectories = []
    const exportedArchives = []

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      ...createEmptyOutputScanDependencies(),
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined,
      generateCopywritingResults: async () => [
        {
          id: 'copy-export-1',
          title: '电商标题 1',
          format: 'txt',
          content: '轻薄风衣女春秋高级感通勤外套'
        },
        {
          id: 'copy-export-2',
          title: '电商标题 2',
          format: 'txt',
          content: '通勤西装外套修身显瘦百搭气质款'
        }
      ],
      mkdtemp: async () => 'C:/temp/qiuai-studio-export-1',
      copyDirectory: async (sourcePath, targetPath) => {
        copiedFiles.push({ sourcePath, targetPath })
      },
      removeDirectory: async (targetPath) => {
        removedDirectories.push(targetPath)
      },
      exportTaskDirectory: async ({ sourceDirectory, targetZipPath }) => {
        exportedArchives.push({ sourceDirectory, targetZipPath })
        return { targetZipPath }
      },
      createId: () => 'studio-export-1',
      getNow: () => '2026-04-26T02:00:00.000Z'
    })

    await service.saveDraft({
      menuKey: 'copywriting',
      patch: {
        model: 'gemini-3-pro',
        taskName: 'CopyZip',
        prompt: '请生成电商标题',
        quantity: 2
      }
    })

    await service.createTask({
      menuKey: 'copywriting'
    })
    await service.waitForIdle()

    const snapshot = service.getSnapshot()
    const selectedIds = snapshot.exportItemsByMenu.copywriting.map((item) => item.id)
    const result = await service.exportSelectedResults({
      menuKey: 'copywriting',
      selectedExportIds: selectedIds,
      targetZipPath: 'C:/downloads/copywriting-results.zip'
    })

    expect(result.menuKey).toBe('copywriting')
    expect(result.exportedCount).toBe(1)
    expect(result.targetZipPath).toBe('C:/downloads/copywriting-results.zip')
    expect(copiedFiles).toHaveLength(1)
    expect(copiedFiles[0].targetPath.replace(/\\/g, '/')).toContain('CopyZip0')
    expect(exportedArchives[0]).toEqual({
      sourceDirectory: 'C:/temp/qiuai-studio-export-1',
      targetZipPath: 'C:/downloads/copywriting-results.zip'
    })
    expect(removedDirectories).toEqual(['C:/temp/qiuai-studio-export-1'])
  })

  it('deletes a stored export folder and removes it from the studio snapshot', async () => {
    const memory = new Map()
    const store = {
      get(key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set(key, value) {
        memory.set(key, value)
      }
    }

    const removedDirectories = []
    const runtimeLogger = {
      log: vi.fn(async () => undefined)
    }

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      ...createEmptyOutputScanDependencies(),
      runtimeLogger,
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined,
      generateCopywritingResults: async () => [
        {
          id: 'copy-export-1',
          title: '电商标题 1',
          format: 'txt',
          content: '轻薄风衣女春秋高级感通勤外套'
        }
      ],
      removeDirectory: async (targetPath) => {
        removedDirectories.push(targetPath)
      },
      createId: () => 'studio-delete-1',
      getNow: () => '2026-04-26T02:30:00.000Z'
    })

    await service.saveDraft({
      menuKey: 'copywriting',
      patch: {
        model: 'gemini-3-pro',
        taskName: 'DeleteFolder',
        prompt: '请生成电商标题',
        quantity: 1
      }
    })

    await service.createTask({
      menuKey: 'copywriting'
    })
    await service.waitForIdle()

    const beforeDeleteSnapshot = service.getSnapshot()
    const exportItem = beforeDeleteSnapshot.exportItemsByMenu.copywriting[0]

    const deleted = await service.deleteExportItem({
      menuKey: 'copywriting',
      exportItemId: exportItem.id
    })

    const afterDeleteSnapshot = service.getSnapshot()

    expect(deleted).toEqual({
      menuKey: 'copywriting',
      exportItemId: exportItem.id,
      deleted: true
    })
    expect(removedDirectories).toEqual([exportItem.directoryPath])
    expect(afterDeleteSnapshot.exportItemsByMenu.copywriting).toEqual([])
    expect(runtimeLogger.log).toHaveBeenCalled()
  })

  it('loads historical export folders from local output storage for snapshot export and delete actions', async () => {
    const memory = new Map()
    const store = {
      get(key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set(key, value) {
        memory.set(key, value)
      }
    }

    const outputRootDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-output-root-'))
    const copywritingGroupDirectory = path.join(outputRootDirectory, 'copywriting', 'task-copy-1', 'HistoryCopy0')
    const singleImageGroupDirectory = path.join(outputRootDirectory, 'single-image', 'task-image-1', 'HistorySingle0')
    const copiedDirectories = []
    const removedDirectories = []
    const exportedArchives = []

    try {
      await fs.mkdir(copywritingGroupDirectory, { recursive: true })
      await fs.mkdir(singleImageGroupDirectory, { recursive: true })
      await fs.writeFile(path.join(copywritingGroupDirectory, '00-title.txt'), '历史文案结果', 'utf8')
      await fs.writeFile(path.join(singleImageGroupDirectory, '00-image.png'), 'image-binary', 'utf8')

      const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
      const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

      const settingsService = createSettingsStoreService({ store })
      const service = createStudioWorkspaceService({
        store,
        settingsService,
        outputRootDirectory,
        mkdtemp: async () => 'C:/temp/qiuai-history-export',
        copyDirectory: async (sourcePath, targetPath) => {
          copiedDirectories.push({ sourcePath, targetPath })
        },
        removeDirectory: async (targetPath) => {
          removedDirectories.push(targetPath)
          if (targetPath === copywritingGroupDirectory || targetPath === singleImageGroupDirectory) {
            await fs.rm(targetPath, { recursive: true, force: true })
          }
        },
        exportTaskDirectory: async ({ sourceDirectory, targetZipPath }) => {
          exportedArchives.push({ sourceDirectory, targetZipPath })
          return { targetZipPath }
        }
      })

      const initialSnapshot = service.getSnapshot()

      expect(initialSnapshot.exportItemsByMenu.copywriting).toHaveLength(1)
      expect(initialSnapshot.exportItemsByMenu.copywriting[0].name).toBe('HistoryCopy0')
      expect(initialSnapshot.exportItemsByMenu.copywriting[0].directoryPath).toBe(copywritingGroupDirectory)
      expect(initialSnapshot.exportItemsByMenu['single-image']).toHaveLength(1)
      expect(initialSnapshot.exportItemsByMenu['single-image'][0].name).toBe('HistorySingle0')

      const exportResult = await service.exportSelectedResults({
        menuKey: 'copywriting',
        selectedExportIds: [initialSnapshot.exportItemsByMenu.copywriting[0].id],
        targetZipPath: 'C:/downloads/history-copywriting.zip'
      })

      expect(exportResult).toEqual({
        menuKey: 'copywriting',
        exportedCount: 1,
        targetZipPath: 'C:/downloads/history-copywriting.zip'
      })
      expect(copiedDirectories).toEqual([
        expect.objectContaining({
          sourcePath: copywritingGroupDirectory
        })
      ])
      expect(exportedArchives).toEqual([
        {
          sourceDirectory: 'C:/temp/qiuai-history-export',
          targetZipPath: 'C:/downloads/history-copywriting.zip'
        }
      ])

      const deleted = await service.deleteExportItem({
        menuKey: 'copywriting',
        exportItemId: initialSnapshot.exportItemsByMenu.copywriting[0].id
      })

      expect(deleted).toEqual({
        menuKey: 'copywriting',
        exportItemId: initialSnapshot.exportItemsByMenu.copywriting[0].id,
        deleted: true
      })
      expect(removedDirectories).toContain(copywritingGroupDirectory)

      const afterDeleteSnapshot = service.getSnapshot()
      expect(afterDeleteSnapshot.exportItemsByMenu.copywriting).toEqual([])
      expect(afterDeleteSnapshot.exportItemsByMenu['single-image']).toHaveLength(1)
    } finally {
      await fs.rm(outputRootDirectory, { recursive: true, force: true })
    }
  })
})
