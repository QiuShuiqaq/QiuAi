import { describe, expect, it } from 'vitest'

describe('promptTemplateStoreService', () => {
  it('lists default templates and supports save and delete', async () => {
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
    expect(defaults.some((item) => item.category === '风格统一')).toBe(true)

    const saved = await service.saveTemplate({
      name: '统一场景图',
      category: '风格统一',
      prompt: '统一暖色电商场景'
    })

    expect(saved).toEqual({
      id: 'template-new',
      name: '统一场景图',
      category: '风格统一',
      prompt: '统一暖色电商场景'
    })
    expect(service.listTemplates().some((item) => item.id === 'template-new')).toBe(true)

    await service.removeTemplate('template-new')
    expect(service.listTemplates().some((item) => item.id === 'template-new')).toBe(false)
  })
})
