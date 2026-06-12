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
    expect(result.comparisonResults[0].promptFinal).toBe('参考原图生成更强卖点表达的商品图\n强化光泽和层次感')
  })

  it('maps single-design preset size labels to supported remote aspect ratios', async () => {
    const createDrawTaskDependency = vi.fn(async ({ aspectRatio }) => ({
      id: `remote-single-design-preset-${createDrawTaskDependency.mock.calls.length}`,
      aspectRatio
    }))
    const service = createService({
      createDrawTaskDependency
    })

    await service.generateImageResults({
      menuKey: 'single-design',
      taskId: 'task-single-design-a4',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        prompt: '生成一张适合详情页打印稿的商品图',
        notes: '',
        sourceImage: null,
        size: 'a4-portrait'
      }
    })

    await service.generateImageResults({
      menuKey: 'single-design',
      taskId: 'task-single-design-8k',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        prompt: '生成一张适合大屏展示的商品图',
        notes: '',
        sourceImage: null,
        size: '8k-landscape'
      }
    })

    expect(createDrawTaskDependency.mock.calls[0][0].aspectRatio).toBe('3:4')
    expect(createDrawTaskDependency.mock.calls[1][0].aspectRatio).toBe('16:9')
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
            imageType: '商品主图',
            size: '4:3',
            model: 'nano-banana-fast',
            tagNames: ['高清', '白底']
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

  it('accepts the empty system template for series-design when templateId is set and imageType is empty', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    const result = await service.generateImageResults({
      menuKey: 'series-design',
      taskId: 'task-series-design-empty-template',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        globalPrompt: '统一高级电商视觉风格',
        negativePrompt: '',
        batchCount: 1,
        size: '1:1',
        imageAssignments: [
          {
            id: 'image-1',
            name: 'look-1.png',
            path: 'C:/input/look-1.png',
            selected: true,
            prompt: '保留空模板，不追加专属提示词',
            templateId: 'system-empty-image-type',
            imageType: '',
            size: '1:1',
            model: 'gpt-image-2',
            tagNames: []
          }
        ]
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(1)
    expect(createDrawTaskDependency.mock.calls[0][0].prompt).toBe('保留空模板，不追加专属提示词\n统一高级电商视觉风格')
    expect(result.groupedResults).toHaveLength(1)
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
        negativePrompt: '水印，logo，文字，低清像素',
        batchCount: 2,
        size: '1:1',
        imageAssignments: [
          {
            id: 'image-1',
            name: 'look-1.png',
            path: 'C:/input/look-1.png',
            selected: true,
            prompt: '突出产品主视觉效果',
            imageType: '商品主图',
            size: '4:3',
            model: 'nano-banana-fast',
            tagNames: ['高清', '白底']
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
            imageType: '细节图',
            size: 'a4-portrait',
            model: 'gpt-image-2',
            tagNames: ['细节特写']
          }
        ]
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(4)
    expect(createDrawTaskDependency.mock.calls[0][0].model).toBe('nano-banana-fast')
    expect(createDrawTaskDependency.mock.calls[0][0].aspectRatio).toBe('4:3')
    expect(createDrawTaskDependency.mock.calls[1][0].model).toBe('gpt-image-2')
    expect(createDrawTaskDependency.mock.calls[1][0].aspectRatio).toBe('3:4')
    expect(createDrawTaskDependency.mock.calls.map((call) => call[0].prompt)).toEqual([
      '高清\n白底\n突出产品主视觉效果\n统一高级电商视觉风格\n严格避免以下问题：水印，logo，文字，低清像素',
      '细节特写\n重点展示局部材质与纹理\n统一高级电商视觉风格\n严格避免以下问题：水印，logo，文字，低清像素',
      '高清\n白底\n突出产品主视觉效果\n统一高级电商视觉风格\n严格避免以下问题：水印，logo，文字，低清像素',
      '细节特写\n重点展示局部材质与纹理\n统一高级电商视觉风格\n严格避免以下问题：水印，logo，文字，低清像素'
    ])
    expect(result.groupedResults).toHaveLength(2)
    expect(result.groupedResults[0].outputs).toHaveLength(3)
    expect(result.groupedResults[0].outputs[0].title).toBe('主图0')
    expect(result.groupedResults[0].outputs[0].promptFinal).toBe(
      '高清\n白底\n突出产品主视觉效果\n统一高级电商视觉风格\n严格避免以下问题：水印，logo，文字，低清像素'
    )
    expect(result.groupedResults[0].outputs[1].title).toBe('look-2.png')
    expect(result.groupedResults[0].outputs[2].title).toBe('细节图0')
    expect(result.summary.title).toBe('套图设计 2 组')
  })

  it('uses batch-specific prompts for series-design when differential mode is enabled', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    await service.generateImageResults({
      menuKey: 'series-design',
      taskId: 'task-series-design-differential',
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
            prompt: '默认专属提示词',
            imageType: '商品主图',
            differentialEnabled: true,
            batchPrompts: ['第一组专属提示词', '第二组专属提示词']
          }
        ]
      }
    })

    expect(createDrawTaskDependency.mock.calls.map((call) => call[0].prompt)).toEqual([
      '第一组专属提示词\n统一高级电商视觉风格',
      '第二组专属提示词\n统一高级电商视觉风格'
    ])
  })

  it('does not append image-type template instructions again when series-design assignment prompt already contains the selected template content', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    await service.generateImageResults({
      menuKey: 'series-design',
      taskId: 'task-series-design-no-template-duplication',
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
            prompt: '按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。\n高清\n白底\n突出产品主视觉效果',
            imageType: '商品主图'
          }
        ]
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(1)
    expect(createDrawTaskDependency.mock.calls[0][0].prompt).toBe(
      '按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。\n高清\n白底\n突出产品主视觉效果\n统一高级电商视觉风格'
    )
  })

  it('keeps series-design batches running when one selected image fails twice and leaves an empty output slot', async () => {
    const remotePromptMap = new Map()
    const retryCountByPrompt = new Map()
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => {
      const id = `remote-${createDrawTaskDependency.mock.calls.length}`
      remotePromptMap.set(id, prompt)
      return { id }
    })
    const getCompletedDrawResultDependency = vi.fn(async ({ id }) => {
      const prompt = remotePromptMap.get(id) || ''
      if (prompt.includes('重点展示局部材质与纹理')) {
        const nextRetryCount = (retryCountByPrompt.get(prompt) || 0) + 1
        retryCountByPrompt.set(prompt, nextRetryCount)
        if (nextRetryCount <= 2) {
          return {
            id,
            status: 'failed',
            progress: 100,
            failure_reason: 'output_moderation',
            error: '输出内容触发审核限制'
          }
        }
      }

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

    const result = await service.generateImageResults({
      menuKey: 'series-design',
      taskId: 'task-series-design-partial',
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
            imageType: '商品主图',
            size: '4:3',
            model: 'nano-banana-fast',
            tagNames: ['高清', '白底']
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
            imageType: '细节图',
            size: 'a4-portrait',
            model: 'gpt-image-2',
            tagNames: ['细节特写']
          }
        ]
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(5)
    expect(result.groupedResults).toHaveLength(2)
    expect(result.groupedResults[0]).toMatchObject({
      status: 'partial',
      completedCount: 1,
      failedCount: 1
    })
    expect(result.groupedResults[0].outputs[0]).toMatchObject({
      title: '主图0',
      sourceTag: 'generated',
      model: 'nano-banana-fast'
    })
    expect(result.groupedResults[0].outputs[1]).toMatchObject({
      title: 'look-2.png',
      sourceTag: 'original',
      model: 'original'
    })
    expect(result.groupedResults[0].outputs[2]).toMatchObject({
      title: '细节图0',
      sourceTag: 'empty',
      model: 'gpt-image-2',
      status: '失败',
      savedPath: '',
      preview: '',
      assignmentId: 'image-3',
      error: '图片任务失败：输出内容触发审核限制'
    })
    expect(result.groupedResults[1]).toMatchObject({
      status: 'succeeded',
      completedCount: 2,
      failedCount: 0
    })
  })

  it('supports large series-design task weights by relying on queue execution instead of a hard rejection threshold', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    const imageAssignments = Array.from({ length: 8 }, (_unused, index) => ({
      id: `image-${index + 1}`,
      name: `look-${index + 1}.png`,
      path: `C:/input/look-${index + 1}.png`,
      selected: true,
      prompt: `提示词-${index + 1}`,
      imageType: index % 2 === 0 ? '商品主图' : '细节图'
    }))

    const result = await service.generateImageResults({
      menuKey: 'series-design',
      taskId: 'task-series-design-three-batches',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        globalPrompt: '统一高级电商视觉风格',
        batchCount: 100,
        size: '1:1',
        imageAssignments
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(800)
    expect(result.groupedResults).toHaveLength(100)
    expect(result.groupedResults.every((group) => group.outputs.length === 8)).toBe(true)
    expect(result.summary.title).toBe('套图设计 100 组')
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
        negativePrompt: '水印，logo，文字，低清像素',
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
      '突出产品整体外观和电商氛围\n统一高级电商详情页风格\n严格避免以下问题：水印，logo，文字，低清像素',
      '重点展示材质和纹理\n统一高级电商详情页风格\n严格避免以下问题：水印，logo，文字，低清像素',
      '提供另一个主视觉构图\n统一高级电商详情页风格\n严格避免以下问题：水印，logo，文字，低清像素',
      '突出产品整体外观和电商氛围\n统一高级电商详情页风格\n严格避免以下问题：水印，logo，文字，低清像素',
      '重点展示材质和纹理\n统一高级电商详情页风格\n严格避免以下问题：水印，logo，文字，低清像素',
      '提供另一个主视觉构图\n统一高级电商详情页风格\n严格避免以下问题：水印，logo，文字，低清像素'
    ])
    expect(result.groupedResults).toHaveLength(2)
    expect(result.groupedResults[0].outputs).toHaveLength(3)
    expect(result.groupedResults[0].outputs[0].title).toBe('主图0')
    expect(result.groupedResults[0].outputs[0].promptFinal).toBe(
      '突出产品整体外观和电商氛围\n统一高级电商详情页风格\n严格避免以下问题：水印，logo，文字，低清像素'
    )
    expect(result.groupedResults[0].outputs[1].title).toBe('细节图0')
    expect(result.groupedResults[0].outputs[2].title).toBe('主图1')
    expect(result.summary.title).toBe('套图生成 2 组 x 3 张')
  })

  it('keeps series-generate batches running when one generated image fails twice and leaves an empty output slot', async () => {
    const remotePromptMap = new Map()
    const retryCountByPrompt = new Map()
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => {
      const id = `remote-${createDrawTaskDependency.mock.calls.length}`
      remotePromptMap.set(id, prompt)
      return { id }
    })
    const getCompletedDrawResultDependency = vi.fn(async ({ id }) => {
      const prompt = remotePromptMap.get(id) || ''
      if (prompt.includes('moderated output')) {
        const nextRetryCount = (retryCountByPrompt.get(prompt) || 0) + 1
        retryCountByPrompt.set(prompt, nextRetryCount)
        if (nextRetryCount <= 2) {
          return {
            id,
            status: 'failed',
            progress: 100,
            failure_reason: 'output_moderation',
            error: '图片任务失败：输出内容触发审核限制'
          }
        }
      }

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

    const result = await service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-partial',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: 'series generate global style',
        generateCount: 3,
        batchCount: 1,
        promptAssignments: [
          { index: 1, prompt: 'primary output', templateId: 'system-empty-image-type', imageType: '' },
          { index: 2, prompt: 'moderated output', templateId: 'system-empty-image-type', imageType: '' },
          { index: 3, prompt: 'final output', templateId: 'system-empty-image-type', imageType: '' }
        ],
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(4)
    expect(result.groupedResults).toHaveLength(1)
    expect(result.groupedResults[0]).toMatchObject({
      status: 'partial',
      completedCount: 2,
      failedCount: 1
    })
    expect(result.groupedResults[0].outputs[0]).toMatchObject({
      sourceTag: 'generated',
      model: 'gpt-image-2',
      savedPath: 'C:/output/remote-1.png'
    })
    expect(result.groupedResults[0].outputs[1]).toMatchObject({
      sourceTag: 'empty',
      model: 'gpt-image-2',
      status: '失败',
      savedPath: '',
      preview: '',
      assignmentId: 'series-generate-2',
      error: '图片任务失败：输出内容触发审核限制'
    })
    expect(result.groupedResults[0].outputs[2]).toMatchObject({
      sourceTag: 'generated',
      model: 'gpt-image-2'
    })
    expect(result.groupedResults[0].outputs[2].savedPath).toMatch(/^C:\/output\/remote-\d+\.png$/)
  })

  it('uses batch-specific prompts for series-generate when differential mode is enabled', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    await service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-differential',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: '统一高级电商详情页风格',
        generateCount: 1,
        batchCount: 2,
        promptAssignments: [
          {
            index: 1,
            prompt: '默认提示词',
            imageType: '商品主图',
            differentialEnabled: true,
            batchPrompts: ['第一组提示词', '第二组提示词']
          }
        ],
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency.mock.calls.map((call) => call[0].prompt)).toEqual([
      '第一组提示词\n统一高级电商详情页风格',
      '第二组提示词\n统一高级电商详情页风格'
    ])
  })

  it('does not append image-type template instructions again when series-generate prompt already contains the selected template content', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    await service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-no-template-duplication',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: '统一高级电商详情页风格',
        generateCount: 1,
        batchCount: 1,
        promptAssignments: [
          {
            index: 1,
            imageType: '商品主图',
            prompt: '按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。\n突出产品整体外观和电商氛围'
          }
        ],
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(1)
    expect(createDrawTaskDependency.mock.calls[0][0].prompt).toBe(
      '按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。\n突出产品整体外观和电商氛围\n统一高级电商详情页风格'
    )
  })

  it('supports series-generate group sizes above 20 and preserves all outputs', async () => {
    const generateCount = 25
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    const result = await service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-over-20',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: '统一高级电商详情页风格',
        generateCount,
        batchCount: 1,
        promptAssignments: Array.from({ length: generateCount }, (_unused, index) => ({
          index: index + 1,
          prompt: `提示词-${index + 1}`,
          imageType: index % 2 === 0 ? '商品主图' : '详情图'
        })),
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency).toHaveBeenCalledTimes(generateCount)
    expect(result.groupedResults).toHaveLength(1)
    expect(result.groupedResults[0].outputs).toHaveLength(generateCount)
  })

  it('runs series-generate groups serially with exactly 2 concurrent jobs per group when enough tasks exist', async () => {
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
    let activeBeforeFirstCompletion = -1

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
      if (activeBeforeFirstCompletion === -1) {
        activeBeforeFirstCompletion = activeCount
      }
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
    await waitForStartedJobsAtLeast(2)
    expect(startedJobIds).toHaveLength(2)
    expect(activeCount).toBe(2)
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
    expect(activeBeforeFirstCompletion).toBe(2)
    expect(maxConcurrent).toBe(2)
  })

  it('does not append prompt template service content during generation when assignment prompt is already the source of truth', async () => {
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

    expect(createDrawTaskDependency.mock.calls[0][0].prompt).toBe('补充主体卖点\n统一风格')
  })

  it('does not append negative prompt section when series-generate negativePrompt is empty', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    await service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-without-negative',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: '统一风格',
        negativePrompt: '',
        generateCount: 1,
        batchCount: 1,
        promptAssignments: [
          { index: 1, prompt: '突出主体卖点', imageType: '商品主图' }
        ],
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency.mock.calls[0][0].prompt).toBe(
      '突出主体卖点\n统一风格'
    )
  })

  it('falls back to the original single prompt when differential mode is disabled even if batch prompts exist', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    await service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-differential-disabled',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: '统一风格',
        generateCount: 1,
        batchCount: 2,
        promptAssignments: [
          {
            index: 1,
            prompt: '默认提示词',
            imageType: '商品主图',
            differentialEnabled: false,
            batchPrompts: ['第一组提示词', '第二组提示词']
          }
        ],
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency.mock.calls.map((call) => call[0].prompt)).toEqual([
      '默认提示词\n统一风格',
      '默认提示词\n统一风格'
    ])
  })

  it('does not stall grouped series-generate subtasks too early when remote status keeps running without progress changes', async () => {
    const wait = vi.fn(async () => undefined)
    const createDrawTaskDependency = vi.fn(async () => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`
    }))
    const pollCountById = new Map()
    const getCompletedDrawResultDependency = vi.fn(async ({ id }) => {
      const nextCount = (pollCountById.get(id) || 0) + 1
      pollCountById.set(id, nextCount)

      if (nextCount < 4) {
        return {
          id,
          status: 'running',
          progress: 0,
          results: []
        }
      }

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
    let nowMs = 0
    const service = createService({
      wait,
      createDrawTaskDependency,
      getCompletedDrawResultDependency,
      getNowMs: () => {
        nowMs += 60_000
        return nowMs
      },
      remoteResultTimeoutMs: 30 * 60 * 1000,
      remoteResultStallTimeoutMs: 5 * 60 * 1000
    })

    const result = await service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-running-without-progress',
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
          { id: 'series-generate-1', index: 1, prompt: '默认提示词', imageType: '商品主图' }
        ],
        size: '1:1'
      }
    })

    expect(result.groupedResults).toHaveLength(1)
    expect(result.groupedResults[0]).toMatchObject({
      status: 'succeeded',
      completedCount: 1,
      failedCount: 0
    })
    expect(wait).toHaveBeenCalled()
  })

  it('fails with a stall-timeout message when remote draw result keeps running without progress for too long', async () => {
    const wait = vi.fn(async () => undefined)
    const getCompletedDrawResultDependency = vi.fn(async ({ id }) => ({
      id,
      status: 'running',
      progress: 97,
      results: []
    }))
    let nowMs = 0
    const service = createService({
      wait,
      getCompletedDrawResultDependency,
      getNowMs: () => {
        nowMs += 60_000
        return nowMs
      },
      remoteResultTimeoutMs: 60 * 60 * 1000,
      remoteResultStallTimeoutMs: 5 * 60 * 1000
    })

    await expect(service.generateImageResults({
      menuKey: 'single-design',
      taskId: 'task-single-design-stuck-running',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        prompt: '生成一张高质量商品主图',
        notes: '',
        sourceImage: null,
        size: '1:1'
      }
    })).rejects.toThrow('图片任务长时间无进展，请稍后重试')

    expect(getCompletedDrawResultDependency).toHaveBeenCalled()
    expect(wait).toHaveBeenCalled()
  })

  it('fails with a total-timeout message when remote draw result still runs but keeps making small progress until overall timeout', async () => {
    const wait = vi.fn(async () => undefined)
    let progressValue = 0
    const getCompletedDrawResultDependency = vi.fn(async ({ id }) => {
      progressValue += 1
      return {
        id,
        status: 'running',
        progress: progressValue,
        results: []
      }
    })
    let nowMs = 0
    const service = createService({
      wait,
      getCompletedDrawResultDependency,
      getNowMs: () => {
        nowMs += 60_000
        return nowMs
      },
      remoteResultTimeoutMs: 30 * 60 * 1000,
      remoteResultStallTimeoutMs: 60 * 60 * 1000
    })

    await expect(service.generateImageResults({
      menuKey: 'single-design',
      taskId: 'task-single-design-total-timeout',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        prompt: '生成一张高质量商品主图',
        notes: '',
        sourceImage: null,
        size: '1:1'
      }
    })).rejects.toThrow('图片任务执行超时，请拆分任务或稍后重试')

    expect(getCompletedDrawResultDependency).toHaveBeenCalled()
    expect(wait).toHaveBeenCalled()
  })
})
