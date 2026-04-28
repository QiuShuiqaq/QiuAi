import { describe, expect, it, vi } from 'vitest'

function createService(overrides = {}) {
  const { createStudioImageGenerationService } = require('../../main/src/services/studioImageGenerationService.js')

  return createStudioImageGenerationService({
    settingsService: {
      getSettings: () => ({
        apiBaseUrl: 'https://example.test',
        apiKeys: ['test-key'],
        activeApiKeyIndex: 0
      })
    },
    messageRecorder: null,
    runtimeLogger: null,
    createHttpClientServiceDependency: () => ({
      post: vi.fn()
    }),
    createDrawTaskDependency: vi.fn(async ({ prompt }) => ({
      id: `remote-${prompt}`
    })),
    getCompletedDrawResultDependency: vi.fn(async ({ id }) => ({
      id,
      status: 'succeeded',
      progress: 100,
      results: [
        {
          previewUrl: `data:image/png;base64,${Buffer.from(id, 'utf8').toString('base64')}`,
          savedPath: `C:/output/${id}.png`
        }
      ]
    })),
    toDataUrlDependency: vi.fn(async ({ filePath }) => `data:image/png;base64,${Buffer.from(filePath, 'utf8').toString('base64')}`),
    getMimeTypeFromPathDependency: vi.fn(() => 'image/png'),
    wait: vi.fn(async () => undefined),
    promptTemplateService: {
      listTemplates: () => []
    },
    ...overrides
  })
}

describe('studioImageGenerationService', () => {
  it('supports single-design text-to-image without requiring a source image', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt, urls, model }) => ({
      id: `remote-single-design-text-${createDrawTaskDependency.mock.calls.length}`,
      prompt,
      urls,
      model
    }))
    const service = createService({
      createDrawTaskDependency
    })

    const result = await service.generateImageResults({
      menuKey: 'single-design',
      taskId: 'task-single-design-text',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        prompt: '生成一张高级电商主图，突出产品材质与高级感',
        notes: '纯净背景，棚拍光影',
        sourceImage: null,
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(1)
    expect(createDrawTaskDependency).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-image-2',
      prompt: '生成一张高级电商主图，突出产品材质与高级感\n纯净背景，棚拍光影',
      urls: []
    }), expect.any(Object))
    expect(result.comparisonResults).toHaveLength(1)
    expect(result.comparisonResults[0].model).toBe('gpt-image-2')
    expect(result.summary.title).toBe('单图设计效果')
  })

  it('supports single-design image-to-image with one selected model', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt, urls, model }) => ({
      id: `remote-single-design-image-${createDrawTaskDependency.mock.calls.length}`,
      prompt,
      urls,
      model
    }))
    const toDataUrlDependency = vi.fn(async ({ filePath }) => `data:image/png;base64,${Buffer.from(`asset:${filePath}`, 'utf8').toString('base64')}`)
    const service = createService({
      createDrawTaskDependency,
      toDataUrlDependency
    })

    const result = await service.generateImageResults({
      menuKey: 'single-design',
      taskId: 'task-single-design-image',
      outputDirectory: 'C:/output',
      draft: {
        model: 'nano-banana-fast',
        prompt: '参考原图生成更强卖点表达的商品图',
        notes: '强化光泽和层次感',
        sourceImage: {
          name: 'bag-main.jpg',
          path: 'C:/input/bag-main.jpg'
        },
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(1)
    expect(createDrawTaskDependency.mock.calls[0][0].model).toBe('nano-banana-fast')
    expect(createDrawTaskDependency.mock.calls[0][0].prompt).toBe('参考原图生成更强卖点表达的商品图\n强化光泽和层次感')
    expect(createDrawTaskDependency.mock.calls[0][0].urls).toHaveLength(1)
    expect(result.comparisonResults).toHaveLength(1)
    expect(result.comparisonResults[0].title).toBe('nano-banana-fast 设计结果')
  })

  it('rejects series-design drafts that do not provide a full set of image types for selected images', async () => {
    const service = createService()

    await expect(service.generateImageResults({
      menuKey: 'series-design',
      taskId: 'task-series-design-missing-type',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        globalPrompt: '统一高级电商视觉风格',
        batchCount: 1,
        size: '1:1',
        imageAssignments: [
          {
            id: 'image-1',
            name: 'look-1.png',
            path: 'C:/input/look-1.png',
            selected: true,
            prompt: '突出产品主视觉效果',
            imageType: '商品主图'
          },
          {
            id: 'image-2',
            name: 'look-2.png',
            path: 'C:/input/look-2.png',
            selected: true,
            prompt: '加入尺寸标注信息',
            imageType: ''
          }
        ]
      }
    })).rejects.toThrow('套图设计需要为每一张选中图片选择图片类型')
  })

  it('builds series-design batches from typed prompt assignments and keeps full-group outputs ordered', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    const result = await service.generateImageResults({
      menuKey: 'series-design',
      taskId: 'task-series-design-valid',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        globalPrompt: '统一高级电商视觉风格',
        batchCount: 2,
        size: '1:1',
        imageAssignments: [
          {
            id: 'image-1',
            name: 'look-1.png',
            path: 'C:/input/look-1.png',
            selected: true,
            prompt: '突出产品主视觉效果',
            imageType: '商品主图'
          },
          {
            id: 'image-2',
            name: 'look-2.png',
            path: 'C:/input/look-2.png',
            selected: false,
            prompt: '',
            imageType: ''
          },
          {
            id: 'image-3',
            name: 'look-3.png',
            path: 'C:/input/look-3.png',
            selected: true,
            prompt: '重点展示局部材质与纹理',
            imageType: '细节图'
          }
        ]
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(4)
    expect(createDrawTaskDependency.mock.calls.map((call) => call[0].prompt)).toEqual([
      '统一高级电商视觉风格\n按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。\n突出产品主视觉效果',
      '统一高级电商视觉风格\n按细节图生成：输出产品局部放大图，重点展示材质、做工、纹理或关键细节；禁止生成整套场景主视觉。\n重点展示局部材质与纹理',
      '统一高级电商视觉风格\n按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。\n突出产品主视觉效果',
      '统一高级电商视觉风格\n按细节图生成：输出产品局部放大图，重点展示材质、做工、纹理或关键细节；禁止生成整套场景主视觉。\n重点展示局部材质与纹理'
    ])
    expect(result.groupedResults).toHaveLength(2)
    expect(result.groupedResults[0].outputs).toHaveLength(3)
    expect(result.groupedResults[0].outputs[0].title).toBe('主图0')
    expect(result.groupedResults[0].outputs[1].title).toBe('look-2.png')
    expect(result.groupedResults[0].outputs[2].title).toBe('细节图0')
    expect(result.summary.title).toBe('套图设计 2 组')
  })

  it('rejects series-generate drafts that do not provide a full set of prompt assignments', async () => {
    const service = createService()

    await expect(service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-invalid',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: '统一高级电商详情页风格',
        generateCount: 3,
        batchCount: 1,
        promptAssignments: [
          { index: 1, prompt: '场景图，突出产品整体外观' },
          { index: 2, prompt: '' }
        ],
        size: '1:1'
      }
    })).rejects.toThrow('套图生成需要为每一张图片填写单独提示词')
  })

  it('rejects series-generate drafts that do not provide a full set of image types', async () => {
    const service = createService()

    await expect(service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-missing-type',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: '统一高级电商详情页风格',
        generateCount: 2,
        batchCount: 1,
        promptAssignments: [
          { index: 1, prompt: '突出产品整体外观', imageType: '商品主图' },
          { index: 2, prompt: '强调尺寸标注信息', imageType: '' }
        ],
        size: '1:1'
      }
    })).rejects.toThrow('套图生成需要为每一张图片选择图片类型')
  })

  it('builds series-generate batches from typed prompt assignments and names outputs by type with counters', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    const result = await service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-valid',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: '统一高级电商详情页风格',
        generateCount: 3,
        batchCount: 2,
        promptAssignments: [
          { index: 1, prompt: '突出产品整体外观和电商氛围', imageType: '商品主图' },
          { index: 2, prompt: '重点展示材质和纹理', imageType: '细节图' },
          { index: 3, prompt: '提供另一个主视觉构图', imageType: '商品主图' }
        ],
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(6)
    expect(createDrawTaskDependency.mock.calls.map((call) => call[0].prompt)).toEqual([
      '统一高级电商详情页风格\n按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。\n突出产品整体外观和电商氛围',
      '统一高级电商详情页风格\n按细节图生成：输出产品局部放大图，重点展示材质、做工、纹理或关键细节；禁止生成整套场景主视觉。\n重点展示材质和纹理',
      '统一高级电商详情页风格\n按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。\n提供另一个主视觉构图',
      '统一高级电商详情页风格\n按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。\n突出产品整体外观和电商氛围',
      '统一高级电商详情页风格\n按细节图生成：输出产品局部放大图，重点展示材质、做工、纹理或关键细节；禁止生成整套场景主视觉。\n重点展示材质和纹理',
      '统一高级电商详情页风格\n按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。\n提供另一个主视觉构图'
    ])
    expect(result.groupedResults).toHaveLength(2)
    expect(result.groupedResults[0].outputs).toHaveLength(3)
    expect(result.groupedResults[0].outputs[0].title).toBe('主图0')
    expect(result.groupedResults[0].outputs[1].title).toBe('细节图0')
    expect(result.groupedResults[0].outputs[2].title).toBe('主图1')
    expect(result.summary.title).toBe('套图生成 2 组 x 3 张')
  })

  it('runs series-generate groups serially with at most 5 concurrent jobs per group', async () => {
    const generateCount = 8
    const batchCount = 2
    const firstGroupSize = generateCount
    const firstSecondGroupStartIndex = firstGroupSize + 1
    function createDeferred() {
      let resolve
      const promise = new Promise((resolver) => {
        resolve = resolver
      })

      return {
        promise,
        resolve
      }
    }
    async function waitForStartedJobsAtLeast(targetCount, {
      maxTicks = 1000
    } = {}) {
      for (let tick = 0; tick < maxTicks; tick += 1) {
        if (startedJobIds.length >= targetCount) {
          return
        }
        await new Promise((resolve) => setImmediate(resolve))
      }

      throw new Error(`Timed out waiting for started jobs: expected at least ${targetCount}, got ${startedJobIds.length}`)
    }

    let startedCount = 0
    let completedCount = 0
    let activeCount = 0
    let maxConcurrent = 0
    const startedJobIds = []
    const finishedJobIds = []
    const completionGates = new Map()
    let secondGroupStartedAtCompletionCount = -1
    let activeBeforeSecondGroupStart = -1
    let finishedBeforeSecondGroupStart = []

    const createDrawTaskDependency = vi.fn(async () => {
      startedCount += 1
      const remoteId = `remote-${startedCount}`
      startedJobIds.push(remoteId)
      completionGates.set(remoteId, createDeferred())
      if (startedCount === firstSecondGroupStartIndex) {
        secondGroupStartedAtCompletionCount = completedCount
        activeBeforeSecondGroupStart = activeCount
        finishedBeforeSecondGroupStart = finishedJobIds.slice()
      }
      activeCount += 1
      maxConcurrent = Math.max(maxConcurrent, activeCount)

      return {
        id: remoteId
      }
    })
    const getCompletedDrawResultDependency = vi.fn(async ({ id }) => {
      await completionGates.get(id)?.promise
      activeCount -= 1
      completedCount += 1
      finishedJobIds.push(id)

      return {
        id,
        status: 'succeeded',
        progress: 100,
        results: [
          {
            previewUrl: `data:image/png;base64,${Buffer.from(id, 'utf8').toString('base64')}`,
            savedPath: `C:/output/${id}.png`
          }
        ]
      }
    })
    const service = createService({
      createDrawTaskDependency,
      getCompletedDrawResultDependency
    })

    const resultPromise = service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-group-order',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: '统一高级电商详情页风格',
        generateCount,
        batchCount,
        promptAssignments: Array.from({ length: generateCount }, (_unused, index) => ({
          index: index + 1,
          prompt: `提示词-${index + 1}`,
          imageType: '商品主图'
        })),
        size: '1:1'
      }
    })
    const totalJobs = generateCount * batchCount
    for (let index = 0; index < totalJobs; index += 1) {
      await waitForStartedJobsAtLeast(index + 1)
      completionGates.get(startedJobIds[index])?.resolve()
      await Promise.resolve()
    }
    const result = await resultPromise

    expect(result.groupedResults).toHaveLength(batchCount)
    expect(result.groupedResults.map((group) => group.groupTitle)).toEqual(['第 1 组', '第 2 组'])
    expect(secondGroupStartedAtCompletionCount).toBe(firstGroupSize)
    expect(activeBeforeSecondGroupStart).toBe(0)
    expect(finishedBeforeSecondGroupStart).toEqual(startedJobIds.slice(0, firstGroupSize))
    expect(maxConcurrent).toBeGreaterThan(1)
    expect(maxConcurrent).toBeLessThanOrEqual(5)
  })

  it('uses edited fixed prompt templates from the prompt library when composing image-type prompts', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency,
      promptTemplateService: {
        listTemplates: () => [
          {
            id: 'product-main',
            name: '商品主图',
            category: '按钮提示词',
            prompt: '这里是用户改过的主图按钮提示词',
            source: 'system-fixed'
          }
        ]
      }
    })

    await service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-custom-fixed-template',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: '统一风格',
        generateCount: 1,
        batchCount: 1,
        promptAssignments: [
          { index: 1, prompt: '补充主体卖点', imageType: '商品主图' }
        ],
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency.mock.calls[0][0].prompt).toBe('统一风格\n这里是用户改过的主图按钮提示词\n补充主体卖点')
  })
})
