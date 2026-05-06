const crypto = require('node:crypto')

const TAG_KEY = 'promptTagCategories'

const defaultCategories = [
  {
    id: 'tag-category-art-style',
    name: '画风风格',
    tags: [
      {
        id: 'tag-art-style-realistic',
        name: '写实'
      },
      {
        id: 'tag-art-style-anime',
        name: '二次元'
      },
      {
        id: 'tag-art-style-ink',
        name: '国风水墨'
      },
      {
        id: 'tag-art-style-oil',
        name: '油画'
      },
      {
        id: 'tag-art-style-watercolor',
        name: '水彩'
      },
      {
        id: 'tag-art-style-pixel',
        name: '像素风'
      },
      {
        id: 'tag-art-style-clay',
        name: '黏土风'
      },
      {
        id: 'tag-art-style-miyazaki',
        name: '宫崎骏风'
      },
      {
        id: 'tag-art-style-illustration',
        name: '插画风'
      },
      {
        id: 'tag-art-style-3d',
        name: '3D 渲染'
      }
    ]
  },
  {
    id: 'tag-category-shot-composition',
    name: '构图镜头',
    tags: [
      {
        id: 'tag-shot-close-up',
        name: '特写'
      },
      {
        id: 'tag-shot-half-body',
        name: '半身'
      },
      {
        id: 'tag-shot-wide',
        name: '全景'
      },
      {
        id: 'tag-shot-top-down',
        name: '俯拍'
      },
      {
        id: 'tag-shot-low-angle',
        name: '仰拍'
      },
      {
        id: 'tag-shot-eye-level',
        name: '平视'
      },
      {
        id: 'tag-shot-negative-space',
        name: '留白构图'
      },
      {
        id: 'tag-shot-cinematic',
        name: '电影感镜头'
      },
      {
        id: 'tag-shot-centered',
        name: '居中构图'
      }
    ]
  },
  {
    id: 'tag-category-lighting-tone',
    name: '光影色调',
    tags: [
      {
        id: 'tag-light-backlit',
        name: '逆光'
      },
      {
        id: 'tag-light-soft',
        name: '柔光'
      },
      {
        id: 'tag-light-god-rays',
        name: '丁达尔光'
      },
      {
        id: 'tag-light-neon',
        name: '霓虹光'
      },
      {
        id: 'tag-light-candle',
        name: '烛光'
      },
      {
        id: 'tag-tone-warm',
        name: '暖色调'
      },
      {
        id: 'tag-tone-cool',
        name: '冷色调'
      },
      {
        id: 'tag-tone-morandi',
        name: '莫兰迪'
      },
      {
        id: 'tag-tone-high-saturation',
        name: '高饱和'
      },
      {
        id: 'tag-tone-low-gray',
        name: '低灰调'
      }
    ]
  },
  {
    id: 'tag-category-material-texture',
    name: '材质质感',
    tags: [
      {
        id: 'tag-material-silk',
        name: '丝绸'
      },
      {
        id: 'tag-material-metal-matte',
        name: '金属磨砂'
      },
      {
        id: 'tag-material-glass',
        name: '玻璃通透'
      },
      {
        id: 'tag-material-fur',
        name: '皮毛绒毛'
      },
      {
        id: 'tag-material-wood',
        name: '木质纹理'
      },
      {
        id: 'tag-material-pearl-gradient',
        name: '珠光渐变'
      }
    ]
  },
  {
    id: 'tag-category-quality-params',
    name: '画质参数',
    tags: [
      {
        id: 'tag-quality-8k',
        name: '8K'
      },
      {
        id: 'tag-quality-ultra-hd',
        name: '超高清'
      },
      {
        id: 'tag-quality-extreme-detail',
        name: '极致细节'
      },
      {
        id: 'tag-quality-hair-detail',
        name: '发丝级细节'
      },
      {
        id: 'tag-quality-master',
        name: '大师画质'
      },
      {
        id: 'tag-quality-no-grain',
        name: '无颗粒感'
      }
    ]
  }
]
const defaultCategoryIdSet = new Set(defaultCategories.map((category) => category.id))

function normalizeTag(tag = {}) {
  return {
    id: String(tag.id || ''),
    name: String(tag.name || '').trim()
  }
}

function normalizeCategory(category = {}) {
  return {
    id: String(category.id || ''),
    name: String(category.name || '').trim(),
    tags: Array.isArray(category.tags)
      ? category.tags.map((tag) => normalizeTag(tag)).filter((tag) => tag.id)
      : []
  }
}

function mergeDefaultCategories(categories = []) {
  const incomingCategories = Array.isArray(categories) ? categories.map((category) => normalizeCategory(category)) : []
  const incomingCategoryMap = new Map(incomingCategories.filter((category) => category.id).map((category) => [category.id, category]))
  const customCategories = incomingCategories.filter((category) => category.id && !defaultCategories.find((item) => item.id === category.id))

  return [
    ...defaultCategories.map((defaultCategory) => {
      const matchedCategory = incomingCategoryMap.get(defaultCategory.id)
      return normalizeCategory({
        ...defaultCategory,
        ...(matchedCategory || {}),
        tags: matchedCategory?.tags || defaultCategory.tags
      })
    }),
    ...customCategories
  ]
}

function normalizeCategories(categories = []) {
  return mergeDefaultCategories(categories).filter((category) => category.id)
}

function createPromptTagStoreService({ store, createId = () => crypto.randomUUID() }) {
  function listCategories() {
    const storedCategories = store.get(TAG_KEY, defaultCategories)
    const normalizedCategories = normalizeCategories(storedCategories).slice()
    store.set(TAG_KEY, normalizedCategories)
    return normalizedCategories
  }

  async function saveCategory(payload = {}) {
    const currentCategories = listCategories()
    const existingCategory = currentCategories.find((item) => item.id === payload.id)
    const nextCategory = normalizeCategory({
      id: existingCategory?.id || payload.id || createId(),
      name: payload.name || existingCategory?.name || '',
      tags: existingCategory?.tags || []
    })

    if (!nextCategory.name) {
      throw new Error('标签分类名称不能为空')
    }

    const nextCategories = [
      ...currentCategories.filter((item) => item.id !== nextCategory.id),
      nextCategory
    ]
    store.set(TAG_KEY, normalizeCategories(nextCategories))
    return nextCategory
  }

  async function saveTag(payload = {}) {
    const currentCategories = listCategories()
    const categoryId = String(payload.categoryId || '')
    const matchedCategory = currentCategories.find((item) => item.id === categoryId)

    if (!matchedCategory) {
      throw new Error('标签分类不存在')
    }

    const existingTag = matchedCategory.tags.find((item) => item.id === payload.id)
    const nextTag = normalizeTag({
      id: existingTag?.id || payload.id || createId(),
      name: payload.name || existingTag?.name || ''
    })

    if (!nextTag.name) {
      throw new Error('标签名称不能为空')
    }

    const nextCategories = currentCategories.map((category) => {
      if (category.id !== categoryId) {
        return category
      }

      return normalizeCategory({
        ...category,
        tags: [
          ...category.tags.filter((item) => item.id !== nextTag.id),
          nextTag
        ]
      })
    })

    store.set(TAG_KEY, normalizeCategories(nextCategories))
    return nextTag
  }

  async function removeTag(payload = {}) {
    const categoryId = String(payload.categoryId || '')
    const tagId = String(payload.tagId || '')
    const nextCategories = listCategories().map((category) => {
      if (category.id !== categoryId) {
        return category
      }

      return normalizeCategory({
        ...category,
        tags: category.tags.filter((item) => item.id !== tagId)
      })
    })

    store.set(TAG_KEY, normalizeCategories(nextCategories))
    return {
      ok: true
    }
  }

  async function removeCategory(categoryId = '') {
    const normalizedCategoryId = String(categoryId || '')
    const currentCategories = listCategories()
    const targetCategory = currentCategories.find((item) => item.id === normalizedCategoryId)

    if (!targetCategory) {
      return {
        ok: true
      }
    }

    if (defaultCategoryIdSet.has(normalizedCategoryId)) {
      throw new Error('默认标签分类不可删除')
    }

    if ((targetCategory.tags || []).length > 0) {
      throw new Error('请先删除分类内的标签')
    }

    store.set(TAG_KEY, normalizeCategories(currentCategories.filter((item) => item.id !== normalizedCategoryId)))
    return {
      ok: true
    }
  }

  return {
    listCategories,
    saveCategory,
    saveTag,
    removeTag,
    removeCategory
  }
}

module.exports = {
  createPromptTagStoreService,
  defaultCategories
}
