import {
  DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
  DEFAULT_EMPTY_PROMPT_TEMPLATE_NAME,
  DEFAULT_EMPTY_NEGATIVE_TEMPLATE_ID,
  DEFAULT_EMPTY_NEGATIVE_TEMPLATE_NAME
} from '../../../shared/promptTemplateDefaults.mjs'

export function normalizeBatchPrompts(batchPrompts = [], batchCount = 1) {
  const normalizedCount = Math.max(1, Number(batchCount) || 1)
  const sourcePrompts = Array.isArray(batchPrompts) ? batchPrompts : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    return String(sourcePrompts[index] || '')
  })
}

export function createSeriesGeneratePromptAssignments(count, existingAssignments = [], batchCount = 1) {
  const normalizedCount = Math.max(1, Math.min(500, Number(count) || 1))
  const normalizedBatchCount = Math.max(1, Number(batchCount) || 1)
  const sourceAssignments = Array.isArray(existingAssignments) ? existingAssignments : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    const currentAssignment = sourceAssignments[index] || {}

    return {
      id: currentAssignment.id || `series-generate-${index + 1}`,
      index: index + 1,
      prompt: currentAssignment.prompt || '',
      templateId: currentAssignment.templateId || DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
      imageType: currentAssignment.imageType || '',
      differentialEnabled: currentAssignment.differentialEnabled === true,
      batchPrompts: normalizeBatchPrompts(currentAssignment.batchPrompts, normalizedBatchCount)
    }
  })
}

export function normalizeSeriesGenerateAssignments(assignments = [], count = 1, batchCount = 1) {
  return createSeriesGeneratePromptAssignments(count, assignments, batchCount)
}

export function createDraftForm(menuKey, { resolveDefaultModelForMenu }) {
  if (menuKey === 'single-image') {
    return {
      prompt: '保持主体不变，测试不同模型效果',
      model: resolveDefaultModelForMenu(menuKey),
      taskName: '',
      sourceImage: null,
      compareModels: ['nano-banana-fast', 'gpt-image-2', 'nano-banana-2', 'nano-banana-2-cl'],
      quantity: 1,
      size: '1:1',
      notes: ''
    }
  }

  if (menuKey === 'single-design') {
    return {
      prompt: '生成一张适合电商展示的高质量商品图',
      model: resolveDefaultModelForMenu(menuKey),
      taskName: '',
      sourceImage: null,
      quantity: 1,
      size: '1:1',
      notes: ''
    }
  }

  if (menuKey === 'series-design') {
    return {
      globalPrompt: '围绕XXX统一商品视觉风格，保持XXX主体一致，画面干净专业',
      defaultAssignmentRatio: '1:1',
      defaultAssignmentModel: resolveDefaultModelForMenu(menuKey),
      model: resolveDefaultModelForMenu(menuKey),
      taskName: '',
      imageAssignments: [],
      batchCount: 1,
      size: '1:1'
    }
  }

  if (menuKey === 'series-generate') {
    return {
      globalPrompt: '围绕XXX统一商品详情图风格，突出XXX主体与卖点，适合电商展示',
      model: resolveDefaultModelForMenu(menuKey),
      taskName: '',
      sourceImage: null,
      generateCount: 1,
      promptAssignments: createSeriesGeneratePromptAssignments(1),
      batchCount: 1,
      size: '1:1'
    }
  }

  return {
    prompt: '',
    model: resolveDefaultModelForMenu('single-image')
  }
}

export function createDefaultFormDrafts(menuItems, { resolveDefaultModelForMenu }) {
  return Object.fromEntries(menuItems.map((item) => [
    item.key,
    createDraftForm(item.key, { resolveDefaultModelForMenu })
  ]))
}

export function createEmptyResultsByMenu(menuItems) {
  return Object.fromEntries(menuItems.map((item) => [
    item.key,
    {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    }
  ]))
}

export function createEmptyExportItemsByMenu(menuItems) {
  return Object.fromEntries(menuItems.map((item) => [item.key, []]))
}

export function createEmptyExportSelectionsByMenu(menuItems) {
  return Object.fromEntries(menuItems.map((item) => [item.key, []]))
}

function createEmptyStatsCard(title) {
  return {
    title,
    items: [
      { label: '模型调用次数', value: '0' },
      { label: '任务总数', value: '0' },
      { label: '已完成任务', value: '0' },
      { label: '失败任务', value: '0' },
      { label: '当前结果数', value: '0' },
      { label: '已存储结果', value: '0' }
    ]
  }
}

function createEmptyCreditOverview() {
  return {
    title: '积分仪表盘',
    items: [
      { label: '剩余积分', value: '0' },
      { label: '冻结积分', value: '0' },
      { label: '已用积分', value: '0' },
      { label: '累计充值积分', value: '0' },
      { label: '最近调整', value: '--' },
      { label: '按 gpt-image-2 约可生成', value: '0' }
    ]
  }
}

function createEmptyCreditMessages() {
  return {
    title: '积分消息记录',
    items: []
  }
}

export function createEmptyWorkspaceDashboard() {
  return {
    seriesDesignStats: createEmptyStatsCard('套图设计统计'),
    singleImageStats: createEmptyStatsCard('单图测试统计'),
    singleDesignStats: createEmptyStatsCard('单图设计统计'),
    seriesGenerateStats: createEmptyStatsCard('套图生成统计'),
    creditOverview: createEmptyCreditOverview(),
    creditMessages: createEmptyCreditMessages()
  }
}

export function createEmptyHostInfo() {
  return {
    systemName: '--',
    platformName: '--',
    architecture: '--',
    cpuModel: '--',
    userName: '--',
    runtimeName: '--'
  }
}

export function createDefaultActivationState() {
  return {
    status: 'not_found',
    customerName: '',
    deviceCode: '',
    activatedAt: '',
    message: ''
  }
}

export function ensureEmptyPromptTemplate(templates = []) {
  const sourceTemplates = Array.isArray(templates) ? templates : []
  const hasDefaultTemplate = sourceTemplates.some((template) => template?.id === DEFAULT_EMPTY_PROMPT_TEMPLATE_ID)
  if (hasDefaultTemplate) {
    return sourceTemplates
  }

  return [
    {
      id: DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
      name: DEFAULT_EMPTY_PROMPT_TEMPLATE_NAME,
      category: '系统提示词',
      prompt: '',
      source: 'system-fixed'
    },
    ...sourceTemplates
  ]
}

export function ensureEmptyNegativePromptTemplate(templates = []) {
  const sourceTemplates = Array.isArray(templates) ? templates : []
  const hasDefaultTemplate = sourceTemplates.some((template) => template?.id === DEFAULT_EMPTY_NEGATIVE_TEMPLATE_ID)
  if (hasDefaultTemplate) {
    return sourceTemplates
  }

  return [
    {
      id: DEFAULT_EMPTY_NEGATIVE_TEMPLATE_ID,
      name: DEFAULT_EMPTY_NEGATIVE_TEMPLATE_NAME,
      category: '反向提示词',
      prompt: '',
      source: 'system-fixed'
    },
    ...sourceTemplates
  ]
}

export function normalizeStoredDraft(menuKey, storedDraft = {}, { resolveDefaultModelForMenu }) {
  const normalizedDraft = {
    ...createDraftForm(menuKey, { resolveDefaultModelForMenu }),
    ...storedDraft
  }

  if (menuKey === 'series-design' || menuKey === 'series-generate') {
    normalizedDraft.globalPrompt = String(normalizedDraft.globalPrompt || '')
    normalizedDraft.negativeTemplateId = String(normalizedDraft.negativeTemplateId || DEFAULT_EMPTY_NEGATIVE_TEMPLATE_ID)
    normalizedDraft.negativePrompt = String(normalizedDraft.negativePrompt || '')
  }

  if (menuKey === 'series-generate') {
    const generateCount = Math.max(1, Math.min(500, Number(normalizedDraft.generateCount) || 1))
    normalizedDraft.generateCount = generateCount
    normalizedDraft.promptAssignments = createSeriesGeneratePromptAssignments(
      generateCount,
      normalizedDraft.promptAssignments,
      Math.max(1, Number(normalizedDraft.batchCount) || 1)
    )
  }

  return normalizedDraft
}

export function normalizeSeriesDesignAssignments(assignments = [], batchCount = 1) {
  const normalizedBatchCount = Math.max(1, Number(batchCount) || 1)
  return (Array.isArray(assignments) ? assignments : []).map((assignment) => {
    return {
      ...assignment,
      templateId: assignment.templateId || DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
      imageType: assignment.imageType || '',
      differentialEnabled: assignment.differentialEnabled === true,
      batchPrompts: normalizeBatchPrompts(assignment.batchPrompts, normalizedBatchCount)
    }
  })
}
