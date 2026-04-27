import { describe, expect, it } from 'vitest'

describe('promptTemplateStoreService', () => {
  it('lists fixed button templates and supports custom template save/delete only', async () => {
    const memory = new Map()
    const store = {
      get (key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set (key, value) {
        memory.set(key, value)
      }
    }

    const { createPromptTemplateStoreService } = await import('../../main/src/services/promptTemplateStoreService.js')
    const service = createPromptTemplateStoreService({
      store,
      createId: () => 'template-new'
    })

    const defaults = service.listTemplates()
    expect(defaults.length).toBeGreaterThan(0)
    expect(defaults.some((item) => item.id === 'product-main')).toBe(true)
    expect(defaults.some((item) => item.source === 'system-fixed')).toBe(true)
    expect(defaults.some((item) => item.name === '商品主图')).toBe(true)
    expect(defaults.some((item) => item.name === '详情图')).toBe(true)
    expect(defaults.some((item) => item.name === '细节图')).toBe(true)
    expect(defaults.some((item) => item.name === '尺寸图')).toBe(true)
    expect(defaults.some((item) => item.name === '白底图')).toBe(true)
    expect(defaults.some((item) => item.name === '颜色图')).toBe(true)

    const saved = await service.saveTemplate({
      name: '暖光场景补充',
      category: '自定义提示词',
      prompt: '统一暖光氛围，适合高端商品展示'
    })

    expect(saved).toEqual({
      id: 'template-new',
      name: '暖光场景补充',
      category: '自定义提示词',
      prompt: '统一暖光氛围，适合高端商品展示',
      source: 'custom'
    })
    expect(service.listTemplates().some((item) => item.id === 'template-new')).toBe(true)

    const updatedFixed = await service.saveTemplate({
      id: 'product-main',
      name: '商品主图',
      category: '按钮提示词',
      prompt: '新的商品主图固定提示词'
    })

    expect(updatedFixed).toEqual({
      id: 'product-main',
      name: '商品主图',
      category: '按钮提示词',
      prompt: '新的商品主图固定提示词',
      source: 'system-fixed'
    })
    expect(service.listTemplates().find((item) => item.id === 'product-main')?.prompt).toBe('新的商品主图固定提示词')

    await service.removeTemplate('template-new')
    expect(service.listTemplates().some((item) => item.id === 'template-new')).toBe(false)

    await service.removeTemplate('product-main')
    expect(service.listTemplates().some((item) => item.id === 'product-main')).toBe(true)
  })
})
