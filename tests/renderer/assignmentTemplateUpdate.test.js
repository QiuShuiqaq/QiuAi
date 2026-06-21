import { describe, expect, it } from 'vitest'

describe('assignment template update', () => {
  it('applies template fields in one atomic update for series-design assignments', async () => {
    const { applyTemplateSelectionToAssignment } = await import('../../renderer/src/utils/assignmentTemplateUpdate.js')

    const assignments = [
      {
        id: 'image-1',
        selected: true,
        prompt: '',
        imageType: '',
        templateId: ''
      }
    ]

    const nextAssignments = applyTemplateSelectionToAssignment({
      assignments,
      index: 0,
      template: {
        id: 'product-main',
        name: '商品主图',
        prompt: '突出主体卖点'
      }
    })

    expect(nextAssignments).toEqual([
      {
        id: 'image-1',
        selected: true,
        prompt: '突出主体卖点',
        imageType: '商品主图',
        templateId: 'product-main'
      }
    ])
  })

  it('clears template fields in one atomic update when template is missing', async () => {
    const { applyTemplateSelectionToAssignment } = await import('../../renderer/src/utils/assignmentTemplateUpdate.js')

    const assignments = [
      {
        id: 'image-1',
        selected: true,
        prompt: '旧提示词',
        imageType: '商品主图',
        templateId: 'product-main'
      }
    ]

    const nextAssignments = applyTemplateSelectionToAssignment({
      assignments,
      index: 0,
      template: null
    })

    expect(nextAssignments).toEqual([
      {
        id: 'image-1',
        selected: true,
        prompt: '旧提示词',
        imageType: '',
        templateId: ''
      }
    ])
  })

  it('fills every batch prompt with the selected template prompt when differential mode is enabled', async () => {
    const { applyTemplateSelectionToAssignment } = await import('../../renderer/src/utils/assignmentTemplateUpdate.js')

    const assignments = [
      {
        id: 'image-1',
        selected: true,
        prompt: '',
        imageType: '',
        templateId: '',
        differentialEnabled: true,
        batchPrompts: ['', '', '']
      }
    ]

    const nextAssignments = applyTemplateSelectionToAssignment({
      assignments,
      index: 0,
      template: {
        id: 'product-main',
        name: '商品主图',
        prompt: '突出主体卖点'
      }
    })

    expect(nextAssignments).toEqual([
      {
        id: 'image-1',
        selected: true,
        prompt: '突出主体卖点',
        imageType: '商品主图',
        templateId: 'product-main',
        differentialEnabled: true,
        batchPrompts: ['突出主体卖点', '突出主体卖点', '突出主体卖点']
      }
    ])
  })

  it('keeps a manually edited prompt when selecting another template', async () => {
    const { applyTemplateSelectionToAssignment } = await import('../../renderer/src/utils/assignmentTemplateUpdate.js')

    const assignments = [
      {
        id: 'image-1',
        selected: true,
        prompt: '用户手动改过的提示词',
        imageType: '商品主图',
        templateId: 'product-main'
      }
    ]

    const nextAssignments = applyTemplateSelectionToAssignment({
      assignments,
      index: 0,
      currentTemplate: {
        id: 'product-main',
        name: '商品主图',
        prompt: '突出主体卖点'
      },
      template: {
        id: 'product-detail',
        name: '详情图',
        prompt: '增强细节展示'
      }
    })

    expect(nextAssignments).toEqual([
      {
        id: 'image-1',
        selected: true,
        prompt: '用户手动改过的提示词',
        imageType: '详情图',
        templateId: 'product-detail'
      }
    ])
  })

  it('updates prompt when the current prompt still equals the previous template prompt', async () => {
    const { applyTemplateSelectionToAssignment } = await import('../../renderer/src/utils/assignmentTemplateUpdate.js')

    const assignments = [
      {
        id: 'image-1',
        selected: true,
        prompt: '突出主体卖点',
        imageType: '商品主图',
        templateId: 'product-main'
      }
    ]

    const nextAssignments = applyTemplateSelectionToAssignment({
      assignments,
      index: 0,
      currentTemplate: {
        id: 'product-main',
        name: '商品主图',
        prompt: '突出主体卖点'
      },
      template: {
        id: 'product-detail',
        name: '详情图',
        prompt: '增强细节展示'
      }
    })

    expect(nextAssignments).toEqual([
      {
        id: 'image-1',
        selected: true,
        prompt: '增强细节展示',
        imageType: '详情图',
        templateId: 'product-detail'
      }
    ])
  })

  it('keeps manually edited differential batch prompts while updating template-derived ones', async () => {
    const { applyTemplateSelectionToAssignment } = await import('../../renderer/src/utils/assignmentTemplateUpdate.js')

    const assignments = [
      {
        id: 'image-1',
        selected: true,
        prompt: '突出主体卖点',
        imageType: '商品主图',
        templateId: 'product-main',
        differentialEnabled: true,
        batchPrompts: ['突出主体卖点', '用户手改第二组', '突出主体卖点']
      }
    ]

    const nextAssignments = applyTemplateSelectionToAssignment({
      assignments,
      index: 0,
      currentTemplate: {
        id: 'product-main',
        name: '商品主图',
        prompt: '突出主体卖点'
      },
      template: {
        id: 'product-detail',
        name: '详情图',
        prompt: '增强细节展示'
      }
    })

    expect(nextAssignments).toEqual([
      {
        id: 'image-1',
        selected: true,
        prompt: '增强细节展示',
        imageType: '详情图',
        templateId: 'product-detail',
        differentialEnabled: true,
        batchPrompts: ['增强细节展示', '用户手改第二组', '增强细节展示']
      }
    ])
  })

  it('applies template fields in one atomic update for series-generate prompt assignments', async () => {
    const { applyTemplateSelectionToPromptAssignment } = await import('../../renderer/src/utils/assignmentTemplateUpdate.js')

    const assignments = [
      {
        id: 'series-generate-1',
        index: 1,
        prompt: '',
        imageType: '',
        templateId: ''
      }
    ]

    const nextAssignments = applyTemplateSelectionToPromptAssignment({
      assignments,
      index: 0,
      template: {
        id: 'product-main',
        name: '商品主图',
        prompt: '突出主体卖点'
      }
    })

    expect(nextAssignments).toEqual([
      {
        id: 'series-generate-1',
        index: 1,
        prompt: '突出主体卖点',
        imageType: '商品主图',
        templateId: 'product-main'
      }
    ])
  })

  it('keeps manually edited series-generate prompt when selecting another template', async () => {
    const { applyTemplateSelectionToPromptAssignment } = await import('../../renderer/src/utils/assignmentTemplateUpdate.js')

    const assignments = [
      {
        id: 'series-generate-1',
        index: 1,
        prompt: '用户自定义第一张提示词',
        imageType: '商品主图',
        templateId: 'product-main'
      }
    ]

    const nextAssignments = applyTemplateSelectionToPromptAssignment({
      assignments,
      index: 0,
      currentTemplate: {
        id: 'product-main',
        name: '商品主图',
        prompt: '突出主体卖点'
      },
      template: {
        id: 'product-detail',
        name: '详情图',
        prompt: '增强细节展示'
      }
    })

    expect(nextAssignments).toEqual([
      {
        id: 'series-generate-1',
        index: 1,
        prompt: '用户自定义第一张提示词',
        imageType: '详情图',
        templateId: 'product-detail'
      }
    ])
  })

  it('keeps template id but clears prompt and imageType when the empty system template is selected', async () => {
    const { applyTemplateSelectionToAssignment } = await import('../../renderer/src/utils/assignmentTemplateUpdate.js')

    const assignments = [
      {
        id: 'image-1',
        selected: true,
        prompt: '旧提示词',
        imageType: '商品主图',
        templateId: 'product-main',
        differentialEnabled: true,
        batchPrompts: ['旧1', '旧2']
      }
    ]

    const nextAssignments = applyTemplateSelectionToAssignment({
      assignments,
      index: 0,
      currentTemplate: {
        id: 'product-main',
        name: '商品主图',
        prompt: '突出主体卖点'
      },
      template: {
        id: 'system-empty-image-type',
        name: '无类型图片',
        prompt: ''
      }
    })

    expect(nextAssignments).toEqual([
      {
        id: 'image-1',
        selected: true,
        prompt: '旧提示词',
        imageType: '',
        templateId: 'system-empty-image-type',
        differentialEnabled: true,
        batchPrompts: ['旧1', '旧2']
      }
    ])
  })
})
