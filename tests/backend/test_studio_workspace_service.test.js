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

function createMemoryStore() {
  const memory = new Map()

  return {
    get(key, fallbackValue) {
      return memory.has(key) ? memory.get(key) : fallbackValue
    },
    set(key, value) {
      memory.set(key, value)
    }
  }
}

describe('studioWorkspaceService', () => {
  it('enqueues image tasks immediately and updates progress from remote callbacks', async () => {
    const store = createMemoryStore()
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

  it('returns snapshot without copywriting menu and with four dashboard stats cards', async () => {
    const store = createMemoryStore()

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
      writeFile: async () => undefined
    })

    const snapshot = service.getSnapshot()

    expect(snapshot.themeMode).toBe('dark')
    expect(snapshot.themeOptions.map((item) => item.value)).toEqual(['dark'])
    expect(snapshot.menuItems.map((item) => item.key)).toEqual([
      'workspace',
      'single-image',
      'single-design',
      'series-design',
      'series-generate',
      'model-pricing'
    ])
    expect(snapshot).not.toHaveProperty('copywritingModelOptions')
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
    expect(snapshot.formDrafts).not.toHaveProperty('copywriting')
    expect(snapshot.formDrafts['single-image'].compareModels).toHaveLength(4)
    expect(snapshot.formDrafts['single-design'].sourceImage).toBe(null)
    expect(snapshot.formDrafts['single-design'].model).toBe('gpt-image-2')
    expect(snapshot.formDrafts['series-design'].imageAssignments).toEqual([])
    expect(snapshot.formDrafts['series-generate'].promptAssignments).toHaveLength(20)
    expect(snapshot.workspaceDashboard).not.toHaveProperty('copywritingStats')
    expect(snapshot.workspaceDashboard.singleImageStats.title).toBe('单图测试统计')
    expect(snapshot.workspaceDashboard.singleDesignStats.title).toBe('单图设计统计')
    expect(snapshot.workspaceDashboard.seriesDesignStats.title).toBe('套图设计统计')
    expect(snapshot.workspaceDashboard.seriesGenerateStats.title).toBe('套图生成统计')
    expect(snapshot.workspaceDashboard.singleImageStats.items).toHaveLength(6)
    expect(snapshot.settingsSummary.apiKeys).toEqual(['', ''])
    expect(snapshot.settingsSummary.activeApiKeyIndex).toBe(0)
    expect(snapshot.hostInfo.systemName).toBeTruthy()
    expect(snapshot.hostInfo.runtimeName).toContain('Node')
  })

  it('clears runtime drafts and cached results while preserving task history', async () => {
    const store = createMemoryStore()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService, STUDIO_WORKSPACE_KEY } = await import('../../main/src/services/studioWorkspaceService.js')

    store.set(STUDIO_WORKSPACE_KEY, {
      formDrafts: {
        'single-design': {
          prompt: '自定义商品主图',
          model: 'nano-banana-fast',
          taskName: 'NeedReset',
          sourceImage: {
            name: 'product.png',
            path: 'C:/input/product.png'
          },
          quantity: 1,
          size: '16:9',
          notes: '保留高光'
        }
      },
      resultsByMenu: {
        'single-design': {
          textResults: [],
          comparisonResults: [
            {
              id: 'cached-result-1',
              model: 'nano-banana-fast',
              title: '旧缓存结果',
              preview: createPreviewDataUrl('old-cache')
            }
          ],
          groupedResults: [],
          summary: null
        }
      },
      exportItemsByMenu: {
        'single-design': [
          {
            id: 'cached-export-1',
            name: 'OldFolder'
          }
        ]
      },
      tasks: [
        {
          id: 'legacy-task-store-1',
          menuKey: 'single-design',
          status: '已完成',
          progress: 100,
          createdAt: '2026-04-29 10:00:00'
        }
      ]
    })

    const settingsService = createSettingsStoreService({ store })
    const taskManagerService = {
      listTasks: () => [
        {
          id: 'history-task-1',
          menuKey: 'single-design',
          status: '已完成',
          progress: 100,
          createdAt: '2026-04-29 10:00:00'
        }
      ]
    }
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      taskManagerService,
      ...createEmptyOutputScanDependencies(),
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined
    })

    const cleared = await service.clearRuntimeState()
    const snapshot = service.getSnapshot()

    expect(cleared.cleared).toBe(true)
    expect(snapshot.formDrafts['single-design'].taskName).toBe('')
    expect(snapshot.formDrafts['single-design'].sourceImage).toBe(null)
    expect(snapshot.formDrafts['single-design'].size).toBe('1:1')
    expect(snapshot.resultsByMenu['single-design'].comparisonResults).toEqual([])
    expect(snapshot.exportItemsByMenu['single-design']).toEqual([])
    expect(snapshot.tasks).toHaveLength(1)
    expect(snapshot.tasks[0].id).toBe('history-task-1')
  })

  it('rejects one-key cleanup while active studio tasks are still running', async () => {
    const store = createMemoryStore()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    const taskManagerService = {
      listTasks: () => [
        {
          id: 'running-task-1',
          menuKey: 'series-generate',
          status: '进行中',
          progress: 45,
          createdAt: '2026-04-29 12:00:00'
        }
      ]
    }
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      taskManagerService,
      ...createEmptyOutputScanDependencies(),
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined
    })

    await expect(service.clearRuntimeState()).rejects.toThrow('当前存在进行中的任务，暂不能一键清理')
  })

  it('persists image drafts, creates grouped tasks, and stores export folders by module', async () => {
    const store = createMemoryStore()
    const taskManagerRecords = []

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
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
              sourceImageName: draft.sourceImage?.name || '',
              status: '已完成'
            },
            {
              id: `${taskId}-single-2`,
              model: 'gpt-image-2',
              title: 'gpt-image-2 对比结果',
              preview: createPreviewDataUrl('single-2'),
              sourceImageName: draft.sourceImage?.name || '',
              status: '已完成'
            },
            {
              id: `${taskId}-single-3`,
              model: 'nano-banana-2',
              title: 'nano-banana-2 对比结果',
              preview: createPreviewDataUrl('single-3'),
              sourceImageName: draft.sourceImage?.name || '',
              status: '已完成'
            },
            {
              id: `${taskId}-single-4`,
              model: 'nano-banana-2-cl',
              title: 'nano-banana-2-cl 对比结果',
              preview: createPreviewDataUrl('single-4'),
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

      if (menuKey === 'single-design') {
        return {
          textResults: [],
          comparisonResults: [
            {
              id: `${taskId}-single-design-1`,
              model: draft.model,
              title: '单图设计结果',
              preview: createPreviewDataUrl('single-design-1'),
              status: '已完成'
            }
          ],
          groupedResults: [],
          summary: {
            title: '单图设计',
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

    await service.saveDraft({
      menuKey: 'single-image',
      patch: {
        prompt: '提升质感，适合电商主图测试',
        taskName: 'SingleA',
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
    expect(createdSingleTask.taskNumber).toBe('QAI-20260425-0001')

    await service.saveDraft({
      menuKey: 'single-design',
      patch: {
        prompt: '单张主图高端重制',
        taskName: 'SingleDesignA',
        model: 'nano-banana-fast',
        sourceImage: {
          name: 'watch-main.jpg',
          path: 'C:/images/watch-main.jpg'
        }
      }
    })

    const createdSingleDesignTask = await service.createTask({
      menuKey: 'single-design'
    })

    expect(createdSingleDesignTask.title).toContain('单图设计')
    expect(createdSingleDesignTask.inputCount).toBe(1)
    expect(createdSingleDesignTask.plannedOutputCount).toBe(1)

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

    const snapshot = service.getSnapshot()
    expect(snapshot.resultsByMenu).not.toHaveProperty('copywriting')
    expect(snapshot.exportItemsByMenu).not.toHaveProperty('copywriting')
    expect(snapshot.resultsByMenu['single-image'].comparisonResults).toHaveLength(4)
    expect(snapshot.resultsByMenu['single-design'].comparisonResults).toHaveLength(1)
    expect(snapshot.resultsByMenu['series-design'].groupedResults).toHaveLength(1)
    expect(snapshot.resultsByMenu['series-design'].groupedResults[0].outputs).toHaveLength(2)
    expect(snapshot.resultsByMenu['series-generate'].groupedResults).toHaveLength(2)
    expect(snapshot.resultsByMenu['series-generate'].groupedResults[0].outputs).toHaveLength(3)
    expect(snapshot.exportItemsByMenu['single-image']).toHaveLength(1)
    expect(snapshot.exportItemsByMenu['single-image'][0].name).toBe('SingleA0')
    expect(snapshot.exportItemsByMenu['single-design']).toHaveLength(1)
    expect(snapshot.exportItemsByMenu['single-design'][0].name).toBe('SingleDesignA0')
    expect(snapshot.exportItemsByMenu['series-design']).toHaveLength(1)
    expect(snapshot.exportItemsByMenu['series-design'][0].name).toBe('SeriesA0')
    expect(snapshot.exportItemsByMenu['series-generate']).toHaveLength(2)
    expect(snapshot.exportItemsByMenu['series-generate'][0].name).toBe('SeriesB0')
    expect(snapshot.exportItemsByMenu['series-generate'][1].name).toBe('SeriesB1')
    expect(snapshot.tasks[0].taskNumber).toBe('QAI-20260425-0004')
    expect(snapshot.tasks.map((task) => task.category)).toEqual(expect.arrayContaining([
      '单图测试',
      '单图设计',
      '套图设计',
      '套图生成'
    ]))
    expect(snapshot.workspaceDashboard.singleImageStats.items.find((item) => item.label === '模型调用次数')?.value).toBe('1')
    expect(snapshot.workspaceDashboard.singleDesignStats.items.find((item) => item.label === '模型调用次数')?.value).toBe('1')
    expect(snapshot.workspaceDashboard.seriesDesignStats.items.find((item) => item.label === '模型调用次数')?.value).toBe('1')
    expect(snapshot.workspaceDashboard.seriesGenerateStats.items.find((item) => item.label === '模型调用次数')?.value).toBe('1')
    expect(taskManagerService.saveTask).toHaveBeenCalled()
  })

  it('exports selected studio result folders into a zip archive', async () => {
    const store = createMemoryStore()
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
      generateImageResults: async ({ taskId }) => ({
        textResults: [],
        comparisonResults: [
          {
            id: `${taskId}-single-1`,
            model: 'gpt-image-2',
            title: '单图设计结果',
            preview: createPreviewDataUrl('single-export')
          }
        ],
        groupedResults: [],
        summary: {
          title: '单图设计',
          description: '导出测试'
        }
      }),
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
      menuKey: 'single-design',
      patch: {
        model: 'gpt-image-2',
        taskName: 'SingleZip',
        prompt: '生成一张高质量电商主图'
      }
    })

    await service.createTask({
      menuKey: 'single-design'
    })
    await service.waitForIdle()

    const snapshot = service.getSnapshot()
    const selectedIds = snapshot.exportItemsByMenu['single-design'].map((item) => item.id)
    const result = await service.exportSelectedResults({
      menuKey: 'single-design',
      selectedExportIds: selectedIds,
      targetZipPath: 'C:/downloads/single-design-results.zip'
    })

    expect(result).toEqual({
      menuKey: 'single-design',
      exportedCount: 1,
      targetZipPath: 'C:/downloads/single-design-results.zip'
    })
    expect(copiedFiles).toHaveLength(1)
    expect(copiedFiles[0].targetPath.replace(/\\/g, '/')).toContain('SingleZip0')
    expect(exportedArchives[0]).toEqual({
      sourceDirectory: 'C:/temp/qiuai-studio-export-1',
      targetZipPath: 'C:/downloads/single-design-results.zip'
    })
    expect(removedDirectories).toEqual(['C:/temp/qiuai-studio-export-1'])
  })

  it('deletes a stored export folder and removes it from snapshot', async () => {
    const store = createMemoryStore()
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
      generateImageResults: async ({ taskId }) => ({
        textResults: [],
        comparisonResults: [
          {
            id: `${taskId}-single-1`,
            model: 'gpt-image-2',
            title: '单图设计结果',
            preview: createPreviewDataUrl('single-delete')
          }
        ],
        groupedResults: [],
        summary: {
          title: '单图设计',
          description: '删除测试'
        }
      }),
      removeDirectory: async (targetPath) => {
        removedDirectories.push(targetPath)
      },
      createId: () => 'studio-delete-1',
      getNow: () => '2026-04-26T02:30:00.000Z'
    })

    await service.saveDraft({
      menuKey: 'single-design',
      patch: {
        model: 'gpt-image-2',
        taskName: 'DeleteFolder',
        prompt: '请生成一张详情图'
      }
    })

    await service.createTask({
      menuKey: 'single-design'
    })
    await service.waitForIdle()

    const beforeDeleteSnapshot = service.getSnapshot()
    const exportItem = beforeDeleteSnapshot.exportItemsByMenu['single-design'][0]

    const deleted = await service.deleteExportItem({
      menuKey: 'single-design',
      exportItemId: exportItem.id
    })

    const afterDeleteSnapshot = service.getSnapshot()

    expect(deleted).toEqual({
      menuKey: 'single-design',
      exportItemId: exportItem.id,
      deleted: true
    })
    expect(removedDirectories).toEqual([exportItem.directoryPath])
    expect(afterDeleteSnapshot.exportItemsByMenu['single-design']).toEqual([])
    expect(runtimeLogger.log).toHaveBeenCalled()
  })

  it('loads historical export folders from local output storage for image modules', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-output-root-'))
    const singleImageGroupDirectory = path.join(outputRootDirectory, 'single-image', 'task-image-1', 'HistorySingle0')
    const seriesDesignGroupDirectory = path.join(outputRootDirectory, 'series-design', 'task-series-1', 'HistorySeries0')
    const copiedDirectories = []
    const removedDirectories = []
    const exportedArchives = []

    try {
      await fs.mkdir(singleImageGroupDirectory, { recursive: true })
      await fs.mkdir(seriesDesignGroupDirectory, { recursive: true })
      await fs.writeFile(path.join(singleImageGroupDirectory, '00-image.png'), 'image-binary', 'utf8')
      await fs.writeFile(path.join(seriesDesignGroupDirectory, '00-image.png'), 'image-binary', 'utf8')

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
          if (targetPath === singleImageGroupDirectory || targetPath === seriesDesignGroupDirectory) {
            await fs.rm(targetPath, { recursive: true, force: true })
          }
        },
        exportTaskDirectory: async ({ sourceDirectory, targetZipPath }) => {
          exportedArchives.push({ sourceDirectory, targetZipPath })
          return { targetZipPath }
        }
      })

      const initialSnapshot = service.getSnapshot()

      expect(initialSnapshot.exportItemsByMenu['single-image']).toHaveLength(1)
      expect(initialSnapshot.exportItemsByMenu['single-image'][0].name).toBe('HistorySingle0')
      expect(initialSnapshot.exportItemsByMenu['single-image'][0].directoryPath).toBe(singleImageGroupDirectory)
      expect(initialSnapshot.exportItemsByMenu['series-design']).toHaveLength(1)
      expect(initialSnapshot.exportItemsByMenu['series-design'][0].name).toBe('HistorySeries0')

      const exportResult = await service.exportSelectedResults({
        menuKey: 'single-image',
        selectedExportIds: [initialSnapshot.exportItemsByMenu['single-image'][0].id],
        targetZipPath: 'C:/downloads/history-single-image.zip'
      })

      expect(exportResult).toEqual({
        menuKey: 'single-image',
        exportedCount: 1,
        targetZipPath: 'C:/downloads/history-single-image.zip'
      })
      expect(copiedDirectories).toEqual([
        expect.objectContaining({
          sourcePath: singleImageGroupDirectory
        })
      ])
      expect(exportedArchives).toEqual([
        {
          sourceDirectory: 'C:/temp/qiuai-history-export',
          targetZipPath: 'C:/downloads/history-single-image.zip'
        }
      ])

      const deleted = await service.deleteExportItem({
        menuKey: 'single-image',
        exportItemId: initialSnapshot.exportItemsByMenu['single-image'][0].id
      })

      expect(deleted).toEqual({
        menuKey: 'single-image',
        exportItemId: initialSnapshot.exportItemsByMenu['single-image'][0].id,
        deleted: true
      })
      expect(removedDirectories).toContain(singleImageGroupDirectory)

      const afterDeleteSnapshot = service.getSnapshot()
      expect(afterDeleteSnapshot.exportItemsByMenu['single-image']).toEqual([])
      expect(afterDeleteSnapshot.exportItemsByMenu['series-design']).toHaveLength(1)
    } finally {
      await fs.rm(outputRootDirectory, { recursive: true, force: true })
    }
  })

  it('stores lightweight result state without persisting data url previews', async () => {
    const store = createMemoryStore()

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
      generateImageResults: async ({ taskId }) => ({
        textResults: [],
        comparisonResults: [
          {
            id: `${taskId}-single-1`,
            model: 'gpt-image-2',
            title: '单图设计结果',
            preview: createPreviewDataUrl('lightweight-preview')
          }
        ],
        groupedResults: [],
        summary: {
          title: '单图设计',
          description: '轻量状态测试'
        }
      }),
      createId: () => 'studio-lightweight-1',
      getNow: () => '2026-04-29T02:30:00.000Z'
    })

    await service.saveDraft({
      menuKey: 'single-design',
      patch: {
        model: 'gpt-image-2',
        taskName: 'LightweightA',
        prompt: '请生成一张高质量商品主图'
      }
    })

    await service.createTask({
      menuKey: 'single-design'
    })
    await service.waitForIdle()

    const persistedState = store.get('studioWorkspace', {})
    const persistedResult = persistedState.resultsByMenu?.['single-design']?.comparisonResults?.[0]
    const snapshotResult = service.getSnapshot().resultsByMenu['single-design'].comparisonResults[0]

    expect(persistedResult.savedPath).toContain('LightweightA0')
    expect(persistedResult.preview || '').toBe('')
    expect(JSON.stringify(persistedState)).not.toContain('data:image/png;base64')
    expect(snapshotResult.preview).toMatch(/^file:/)
  })

  it('caches export directory scans between adjacent snapshot reads', async () => {
    const store = createMemoryStore()
    const readdirSync = vi.fn(() => [])
    const statSync = vi.fn(() => null)

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      readdirSync,
      statSync,
      getNowMs: () => 1000
    })

    service.getSnapshot()
    service.getSnapshot()

    expect(readdirSync).toHaveBeenCalledTimes(4)
  })

  it('stores grouped task progress metadata for series tasks', async () => {
    const store = createMemoryStore()

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
      generateImageResults: async () => ({
        textResults: [],
        comparisonResults: [],
        groupedResults: [
          {
            id: 'group-1',
            groupIndex: 0,
            groupTitle: 'BAG-A0',
            status: 'succeeded',
            completedCount: 20,
            failedCount: 0,
            outputs: Array.from({ length: 20 }, (_unused, index) => ({
              id: `output-${index + 1}`,
              title: `主图${index}`,
              model: 'gpt-image-2',
              preview: createPreviewDataUrl(`group-${index + 1}`)
            }))
          }
        ],
        summary: {
          title: '套图生成 1 组 x 20 张'
        }
      }),
      createId: () => 'studio-group-meta-1',
      getNow: () => '2026-04-28T06:00:00.000Z'
    })

    await service.saveDraft({
      menuKey: 'series-generate',
      patch: {
        taskName: 'BAG-A',
        model: 'gpt-image-2',
        generateCount: 20,
        batchCount: 1,
        globalPrompt: '统一风格',
        sourceImage: {
          name: 'source.png',
          path: 'C:/input/source.png'
        },
        promptAssignments: Array.from({ length: 20 }, (_unused, index) => ({
          id: `slot-${index + 1}`,
          index: index + 1,
          prompt: `prompt-${index + 1}`,
          imageType: '商品主图'
        }))
      }
    })

    const createdTask = await service.createTask({
      menuKey: 'series-generate'
    })
    await service.waitForIdle()

    const task = service.getSnapshot().tasks.find((item) => item.id === createdTask.id)
    expect(task).toBeTruthy()
    // Intentional lock-test failure until grouped progress metadata is implemented in task snapshots.
    expect(task.groupImageCount).toBe(20)
    expect(task.totalSubtaskCount).toBe(20)
    expect(task.completedSubtaskCount).toBe(20)
    expect(task.failedSubtaskCount).toBe(0)
    expect(task.currentGroupIndex).toBe(0)
    expect(task.currentGroupCompletedCount).toBe(20)
    expect(task.currentGroupTotalCount).toBe(20)
  })
})
