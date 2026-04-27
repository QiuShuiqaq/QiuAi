const crypto = require('node:crypto')

const TEMPLATE_KEY = 'promptTemplates'

const defaultTemplates = [
  {
    id: 'product-main',
    name: '商品主图',
    category: '按钮提示词',
    prompt: '按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。',
    source: 'system-fixed'
  },
  {
    id: 'product-detail',
    name: '详情图',
    category: '按钮提示词',
    prompt: '按详情图生成：输出产品详细说明图，强调卖点信息、使用说明、功能结构或场景说明；禁止仅做主视觉海报。',
    source: 'system-fixed'
  },
  {
    id: 'product-closeup',
    name: '细节图',
    category: '按钮提示词',
    prompt: '按细节图生成：输出产品局部放大图，重点展示材质、做工、纹理或关键细节；禁止生成整套场景主视觉。',
    source: 'system-fixed'
  },
  {
    id: 'product-size',
    name: '尺寸图',
    category: '按钮提示词',
    prompt: '按尺寸图生成：输出带尺寸标注的说明图，清晰表达长宽高或关键规格；禁止省略尺寸信息。',
    source: 'system-fixed'
  },
  {
    id: 'product-whitebg',
    name: '白底图',
    category: '按钮提示词',
    prompt: '按白底图生成：输出纯白背景电商图，主体完整清晰、边缘干净；禁止加入场景背景和复杂装饰。',
    source: 'system-fixed'
  },
  {
    id: 'product-color',
    name: '颜色图',
    category: '按钮提示词',
    prompt: '按颜色图生成：输出产品颜色变化效果图，保持产品结构一致，仅突出颜色差异；禁止改变主体款式。',
    source: 'system-fixed'
  }
]

function normalizeTemplateItem(template = {}) {
  return {
    id: String(template.id || ''),
    name: String(template.name || ''),
    category: String(template.category || ''),
    prompt: String(template.prompt || ''),
    source: template.source === 'system-fixed' ? 'system-fixed' : 'custom'
  }
}

function mergeTemplates(templates = []) {
  const normalizedIncoming = Array.isArray(templates) ? templates.map(normalizeTemplateItem) : []
  const customTemplates = normalizedIncoming.filter((item) => item.source === 'custom' && item.id)
  const fixedTemplateMap = new Map(
    normalizedIncoming
      .filter((item) => item.source === 'system-fixed' && item.id)
      .map((item) => [item.id, item])
  )

  return [
    ...defaultTemplates.map((template) => ({
      ...template,
      ...(fixedTemplateMap.get(template.id) || {}),
      source: 'system-fixed'
    })),
    ...customTemplates
  ]
}

function normalizeTemplates(templates) {
  return mergeTemplates(Array.isArray(templates) ? templates : defaultTemplates)
}

function createPromptTemplateStoreService({ store, createId = () => crypto.randomUUID() }) {
  function listTemplates() {
    return normalizeTemplates(store.get(TEMPLATE_KEY, defaultTemplates)).slice()
  }

  async function saveTemplate(payload = {}) {
    const existingTemplate = listTemplates().find((item) => item.id === payload.id)
    const isFixedTemplate = existingTemplate?.source === 'system-fixed'
    const template = {
      id: isFixedTemplate ? existingTemplate.id : (payload.id || createId()),
      name: String(payload.name || existingTemplate?.name || ''),
      category: String(payload.category || existingTemplate?.category || ''),
      prompt: String(payload.prompt || ''),
      source: isFixedTemplate ? 'system-fixed' : 'custom'
    }
    const nextTemplates = [
      ...listTemplates().filter((item) => item.id !== template.id),
      template
    ]
    store.set(TEMPLATE_KEY, normalizeTemplates(nextTemplates))
    return template
  }

  async function removeTemplate(id) {
    const currentTemplates = listTemplates()
    const targetTemplate = currentTemplates.find((item) => item.id === id)
    if (targetTemplate?.source === 'system-fixed') {
      return
    }

    const nextTemplates = currentTemplates.filter((item) => item.id !== id)
    store.set(TEMPLATE_KEY, normalizeTemplates(nextTemplates))
  }

  return {
    listTemplates,
    saveTemplate,
    removeTemplate
  }
}

module.exports = {
  createPromptTemplateStoreService,
  defaultTemplates
}
