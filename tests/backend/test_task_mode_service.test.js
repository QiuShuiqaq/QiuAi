import { describe, expect, it, vi } from 'vitest'

describe('taskModeService', () => {
  it('builds categorized local tasks under DATA input/output directories', async () => {
    const ensureDirectory = vi.fn()
    const persistSourceFiles = vi.fn(async ({ sourcePaths, targetDirectory }) => {
      return sourcePaths.map((sourcePath) => `${targetDirectory}/${sourcePath.split('/').pop()}`)
    })
    const { createTaskModeService } = await import('../../main/src/services/taskModeService.js')
    const service = createTaskModeService({
      ensureDirectory,
      persistSourceFiles,
      createId: (() => {
        let counter = 0
        return () => `id-${++counter}`
      })()
    })

    const styleTask = await service.createStyleBatchTask({
      folderPath: 'C:/input',
      prompt: '统一极简白底服饰摄影',
      size: '1:1',
      sourcePaths: ['C:/input/a.png', 'C:/input/b.png']
    })

    expect(styleTask.mode).toBe('style-batch')
    expect(styleTask.items).toHaveLength(2)
    expect(styleTask.inputDirectory.replace(/\\/g, '/')).toContain('/DATA/input/series-design/')
    expect(styleTask.outputDirectory.replace(/\\/g, '/')).toContain('/DATA/output/series-design/')
    expect(styleTask.items[0].sourcePath.replace(/\\/g, '/')).toContain('/DATA/input/series-design/')

    const detailTask = await service.createDetailSetTask({
      sourcePath: 'C:/input/product.png',
      basePrompt: '高级电商详情页',
      size: '1:1'
    })

    expect(detailTask.mode).toBe('detail-set')
    expect(detailTask.inputDirectory.replace(/\\/g, '/')).toContain('/DATA/input/series-generate/')
    expect(detailTask.outputDirectory.replace(/\\/g, '/')).toContain('/DATA/output/series-generate/')
    expect(detailTask.items.map((item) => item.label)).toEqual([
      '白底主图',
      '场景图',
      '卖点图',
      '细节图'
    ])

    const singleTask = await service.createSingleTask({
      prompt: '一只可爱小狗',
      size: '1:1'
    })

    expect(singleTask.mode).toBe('single')
    expect(singleTask.items).toHaveLength(1)
    expect(singleTask.items[0].prompt).toBe('一只可爱小狗')
    expect(singleTask.inputDirectory.replace(/\\/g, '/')).toContain('/DATA/input/single-image/')
    expect(singleTask.outputDirectory.replace(/\\/g, '/')).toContain('/DATA/output/single-image/')
    expect(ensureDirectory).toHaveBeenCalled()
    expect(persistSourceFiles).toHaveBeenCalled()
  })
})
