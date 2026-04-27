const crypto = require('node:crypto')

const TEMPLATE_KEY = 'promptTemplates'

const defaultTemplates = [
  {
    id: 'prompt-style-unified',
    name: '电商风格统一',
    category: '风格统一',
    prompt: '统一电商画面风格，保持产品主体清晰，构图干净，适合商品展示'
  },
  {
    id: 'prompt-main-image',
    name: '白底主图',
    category: '主图',
    prompt: '白底主图，突出主体，电商产品摄影，光线干净，阴影自然'
  },
  {
    id: 'prompt-scene-image',
    name: '生活场景图',
    category: '场景图',
    prompt: '生活方式场景图，突出产品使用氛围，画面高级统一，适合电商详情页'
  },
  {
    id: 'prompt-selling-image',
    name: '卖点构图图',
    category: '卖点图',
    prompt: '突出产品核心卖点，构图清晰，信息聚焦，适合电商详情展示'
  },
  {
    id: 'prompt-detail-image',
    name: '细节特写图',
    category: '细节图',
    prompt: '细节特写图，强调材质与工艺，表现清晰，适合电商详情页'
  }
]

function normalizeTemplates (templates) {
  return Array.isArray(templates) && templates.length ? templates : defaultTemplates
}

function createPromptTemplateStoreService ({ store, createId = () => crypto.randomUUID() }) {
  function listTemplates () {
    return normalizeTemplates(store.get(TEMPLATE_KEY, defaultTemplates)).slice()
  }

  async function saveTemplate (payload = {}) {
    const template = {
      id: payload.id || createId(),
      name: payload.name || '',
      category: payload.category || '',
      prompt: payload.prompt || ''
    }
    const nextTemplates = [
      ...listTemplates().filter((item) => item.id !== template.id),
      template
    ]
    store.set(TEMPLATE_KEY, nextTemplates)
    return template
  }

  async function removeTemplate (id) {
    const nextTemplates = listTemplates().filter((item) => item.id !== id)
    store.set(TEMPLATE_KEY, nextTemplates)
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
