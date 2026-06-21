const EMPTY_IMAGE_TYPE_TEMPLATE_ID = 'system-empty-image-type'

function normalizePromptText(value = '') {
  return String(value || '')
}

function resolveImageTypeFromTemplate(template = null) {
  if (!template) {
    return ''
  }

  if (template.id === EMPTY_IMAGE_TYPE_TEMPLATE_ID) {
    return ''
  }

  return template.name || ''
}

export function resolveTemplatePromptValue({
  currentPrompt = '',
  previousTemplatePrompt = '',
  nextTemplatePrompt = ''
} = {}) {
  const normalizedCurrentPrompt = normalizePromptText(currentPrompt)
  const normalizedPreviousTemplatePrompt = normalizePromptText(previousTemplatePrompt)
  const normalizedNextTemplatePrompt = normalizePromptText(nextTemplatePrompt)

  if (!normalizedCurrentPrompt.trim()) {
    return normalizedNextTemplatePrompt
  }

  if (normalizedCurrentPrompt === normalizedPreviousTemplatePrompt) {
    return normalizedNextTemplatePrompt
  }

  return normalizedCurrentPrompt
}

function resolveNextBatchPrompts(item = {}, previousTemplatePrompt = '', nextTemplatePrompt = '') {
  if (item.differentialEnabled === true && Array.isArray(item.batchPrompts)) {
    return item.batchPrompts.map((batchPrompt) => {
      return resolveTemplatePromptValue({
        currentPrompt: batchPrompt,
        previousTemplatePrompt,
        nextTemplatePrompt
      })
    })
  }

  return item.batchPrompts
}

export function applyTemplateSelectionToAssignment({
  assignments = [],
  index = -1,
  template = null,
  currentTemplate = null
} = {}) {
  return (Array.isArray(assignments) ? assignments : []).map((item, currentIndex) => {
    if (currentIndex !== index) {
      return item
    }

    const previousTemplatePrompt = currentTemplate?.prompt || ''
    const nextTemplatePrompt = template?.prompt || ''

    if (!template) {
      return {
        ...item,
        templateId: '',
        imageType: '',
        prompt: resolveTemplatePromptValue({
          currentPrompt: item.prompt,
          previousTemplatePrompt,
          nextTemplatePrompt: ''
        }),
        batchPrompts: resolveNextBatchPrompts(item, previousTemplatePrompt, '')
      }
    }

    return {
      ...item,
      templateId: template.id || '',
      imageType: resolveImageTypeFromTemplate(template),
      prompt: resolveTemplatePromptValue({
        currentPrompt: item.prompt,
        previousTemplatePrompt,
        nextTemplatePrompt
      }),
      batchPrompts: resolveNextBatchPrompts(item, previousTemplatePrompt, nextTemplatePrompt)
    }
  })
}

export function applyTemplateSelectionToPromptAssignment({
  assignments = [],
  index = -1,
  template = null,
  currentTemplate = null
} = {}) {
  return (Array.isArray(assignments) ? assignments : []).map((item, currentIndex) => {
    if (currentIndex !== index) {
      return item
    }

    const previousTemplatePrompt = currentTemplate?.prompt || ''
    const nextTemplatePrompt = template?.prompt || ''

    if (!template) {
      return {
        ...item,
        templateId: '',
        imageType: '',
        prompt: resolveTemplatePromptValue({
          currentPrompt: item.prompt,
          previousTemplatePrompt,
          nextTemplatePrompt: ''
        }),
        batchPrompts: resolveNextBatchPrompts(item, previousTemplatePrompt, '')
      }
    }

    return {
      ...item,
      templateId: template.id || '',
      imageType: resolveImageTypeFromTemplate(template),
      prompt: resolveTemplatePromptValue({
        currentPrompt: item.prompt,
        previousTemplatePrompt,
        nextTemplatePrompt
      }),
      batchPrompts: resolveNextBatchPrompts(item, previousTemplatePrompt, nextTemplatePrompt)
    }
  })
}
