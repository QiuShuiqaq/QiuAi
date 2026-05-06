import { describe, expect, it } from 'vitest'

function createMemoryStore(initialState = {}) {
  const state = { ...initialState }
  return {
    get(key, fallbackValue) {
      return key in state ? state[key] : fallbackValue
    },
    set(key, value) {
      state[key] = value
    }
  }
}

describe('promptTagStoreService', () => {
  it('provides default tag categories and supports save/remove flows', async () => {
    const { createPromptTagStoreService } = await import('../../main/src/services/promptTagStoreService.js')
    const service = createPromptTagStoreService({
      store: createMemoryStore(),
      createId: (() => {
        let index = 0
        return () => `tag-id-${++index}`
      })()
    })

    const initialCategories = service.listCategories()
    expect(initialCategories.length).toBeGreaterThan(0)
    expect(initialCategories.some((item) => item.name === '画风风格')).toBe(true)
    expect(initialCategories.some((item) => item.name === '构图镜头')).toBe(true)
    expect(initialCategories.some((item) => item.name === '光影色调')).toBe(true)
    expect(initialCategories.some((item) => item.name === '材质质感')).toBe(true)
    expect(initialCategories.some((item) => item.name === '画质参数')).toBe(true)
    expect(initialCategories.flatMap((item) => item.tags || []).some((tag) => tag.name === '写实')).toBe(true)
    expect(initialCategories.flatMap((item) => item.tags || []).some((tag) => tag.name === '电影感镜头')).toBe(true)
    expect(initialCategories.flatMap((item) => item.tags || []).some((tag) => tag.name === '丁达尔光')).toBe(true)
    expect(initialCategories.flatMap((item) => item.tags || []).some((tag) => tag.name === '金属磨砂')).toBe(true)
    expect(initialCategories.flatMap((item) => item.tags || []).some((tag) => tag.name === '超高清')).toBe(true)

    const savedCategory = await service.saveCategory({ name: '自定义分类' })
    expect(savedCategory.name).toBe('自定义分类')

    const savedTag = await service.saveTag({
      categoryId: savedCategory.id,
      name: '电商风格'
    })
    expect(savedTag).toEqual({
      id: savedTag.id,
      name: '电商风格'
    })

    const categoriesAfterSave = service.listCategories()
    const matchedCategory = categoriesAfterSave.find((item) => item.id === savedCategory.id)
    expect(matchedCategory.tags).toHaveLength(1)
    expect(matchedCategory.tags[0]).toEqual({
      id: savedTag.id,
      name: '电商风格'
    })

    await service.removeTag({
      categoryId: savedCategory.id,
      tagId: savedTag.id
    })
    expect(service.listCategories().find((item) => item.id === savedCategory.id)?.tags || []).toHaveLength(0)
  })

  it('does not allow removing default tag categories even when they are empty', async () => {
    const { createPromptTagStoreService, defaultCategories } = await import('../../main/src/services/promptTagStoreService.js')
    const service = createPromptTagStoreService({
      store: createMemoryStore()
    })

    await expect(service.removeCategory(defaultCategories[0].id)).rejects.toThrow('默认标签分类不可删除')
    expect(service.listCategories().some((item) => item.id === defaultCategories[0].id)).toBe(true)
  })
})
