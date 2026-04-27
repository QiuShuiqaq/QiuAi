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

  it('builds series-generate batches from global prompt plus fixed per-image prompt assignments', async () => {
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
        generateCount: 2,
        batchCount: 2,
        promptAssignments: [
          { index: 1, prompt: '主图延展成场景图，突出产品整体外观' },
          { index: 2, prompt: '生成卖点细节图，重点展示材质和纹理' }
        ],
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(4)
    expect(createDrawTaskDependency.mock.calls.map((call) => call[0].prompt)).toEqual([
      '统一高级电商详情页风格\n主图延展成场景图，突出产品整体外观',
      '统一高级电商详情页风格\n生成卖点细节图，重点展示材质和纹理',
      '统一高级电商详情页风格\n主图延展成场景图，突出产品整体外观',
      '统一高级电商详情页风格\n生成卖点细节图，重点展示材质和纹理'
    ])
    expect(result.groupedResults).toHaveLength(2)
    expect(result.groupedResults[0].outputs).toHaveLength(2)
    expect(result.groupedResults[0].outputs[0].title).toBe('第 1 张')
    expect(result.groupedResults[0].outputs[1].title).toBe('第 2 张')
    expect(result.summary.title).toBe('套图生成 2 组 x 2 张')
  })
})
