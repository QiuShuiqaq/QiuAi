<script setup>
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({
  fixedPromptTemplates: {
    type: Array,
    required: true
  },
  customPromptTemplates: {
    type: Array,
    required: true
  },
  fixedNegativePromptTemplates: {
    type: Array,
    required: true
  },
  customNegativePromptTemplates: {
    type: Array,
    required: true
  },
  promptTagCategories: {
    type: Array,
    required: true
  }
})

const emit = defineEmits([
  'save-template',
  'remove-template',
  'save-negative-template',
  'remove-negative-template',
  'save-tag-category',
  'save-tag',
  'remove-tag',
  'remove-tag-category'
])
const fixedTemplateDrafts = ref([])
const tagCategoryDrafts = ref([])
const negativePromptDraft = reactive({
  id: '',
  name: '',
  category: '反向提示词',
  prompt: '',
  source: 'custom'
})

// 默认标签分类：画风风格 / 构图镜头 / 光影色调 / 材质质感 / 画质参数
// 默认标签：写实 / 二次元 / 电影感镜头 / 丁达尔光 / 金属磨砂 / 超高清 等

const customDraft = reactive({
  id: '',
  name: '',
  category: '自定义提示词',
  prompt: '',
  source: 'custom'
})

const tagCreatorState = reactive({
  categoryKey: '',
  value: ''
})

const categoryNameEditingState = reactive({
  categoryKey: '',
  value: ''
})

const bannedRiskHints = [
  '和原图一致',
  '保持原样',
  '复刻原图',
  '不改动布局',
  '完全一致',
  '不要变化'
]

const warningRiskHints = [
  '尽量不变',
  '保留原图风格',
  '轻微修改',
  '只改一点',
  '背景不动'
]

const defaultNegativeTemplateHints = ['电商通用', '电商模特', '电商静物']
const negativeTemplatePlaceholder = defaultNegativeTemplateHints.join(' / ')
const DEFAULT_TAG_CATEGORY_IDS = new Set([
  'tag-category-art-style',
  'tag-category-shot-composition',
  'tag-category-lighting-tone',
  'tag-category-material-texture',
  'tag-category-quality-params'
])

const tagCategoryBlocks = computed(() => {
  return tagCategoryDrafts.value.map((category, index) => ({
    ...category,
    categoryKey: category.id || `draft-category-${index}`
  }))
})

const allTemplateDrafts = computed(() => {
  const customTemplateMap = new Map((props.customPromptTemplates || []).map((template) => [template.id, template]))

  return fixedTemplateDrafts.value
    .concat((props.customPromptTemplates || []).map((template) => ({
      id: template.id,
      name: template.name || '',
      category: template.category || '自定义提示词',
      prompt: template.prompt || '',
      source: 'custom'
    })))
    .map((template) => {
      if (template.source === 'custom' && customTemplateMap.has(template.id)) {
        const customTemplate = customTemplateMap.get(template.id)
        return {
          id: customTemplate.id,
          name: customTemplate.name || '',
          category: customTemplate.category || '自定义提示词',
          prompt: customTemplate.prompt || '',
          source: 'custom'
        }
      }

      return template
    })
})

const sortedNegativePromptTemplates = computed(() => {
  return [
    ...(props.fixedNegativePromptTemplates || []).map((template) => ({
      ...template,
      source: 'system-fixed'
    })),
    ...(props.customNegativePromptTemplates || []).map((template) => ({
      ...template,
      source: 'custom'
    }))
  ]
})

watch(
  () => props.fixedPromptTemplates,
  (templates = []) => {
    fixedTemplateDrafts.value = templates.map((template) => ({
      id: template.id,
      name: template.name || '',
      category: template.category || '系统提示词',
      prompt: template.prompt || '',
      source: 'system-fixed'
    }))
  },
  {
    immediate: true,
    deep: true
  }
)

watch(
  () => props.promptTagCategories,
  (categories = []) => {
    tagCategoryDrafts.value = categories.map((category) => ({
      id: category.id,
      name: category.name || '',
      tags: Array.isArray(category.tags)
        ? category.tags.map((tag) => ({
            id: tag.id,
            name: tag.name || ''
          }))
        : []
    }))
  },
  {
    immediate: true,
    deep: true
  }
)

function buildFixedDraft(template = {}) {
  return {
    ...template,
    source: template.source === 'custom' ? 'custom' : 'system-fixed'
  }
}

function applyPositiveTemplate(template = {}) {
  customDraft.id = template.id || ''
  customDraft.name = template.name || ''
  customDraft.category = template.category || '正向提示词'
  customDraft.prompt = template.prompt || ''
  customDraft.source = template.source === 'system-fixed' ? 'system-fixed' : 'custom'
}

function resetCustomDraft() {
  applyPositiveTemplate({
    category: '自定义提示词',
    source: 'custom'
  })
}

function saveFixedTemplate(template) {
  emit('save-template', buildFixedDraft(template))
}

function savePositiveTemplate() {
  if (customDraft.source === 'system-fixed') {
    saveFixedTemplate(customDraft)
    return
  }

  emit('save-template', {
    id: customDraft.id || undefined,
    name: customDraft.name,
    category: customDraft.category,
    prompt: customDraft.prompt,
    source: 'custom'
  })
  resetCustomDraft()
}

function removeCustomTemplate(templateId) {
  emit('remove-template', templateId)
  if (customDraft.id === templateId) {
    resetCustomDraft()
  }
}

function applyNegativeTemplate(template = {}) {
  negativePromptDraft.id = template.id || ''
  negativePromptDraft.name = template.name || ''
  negativePromptDraft.category = template.category || '反向提示词'
  negativePromptDraft.prompt = template.prompt || ''
  negativePromptDraft.source = template.source === 'system-fixed' ? 'system-fixed' : 'custom'
}

function resetNegativePromptDraft() {
  applyNegativeTemplate({})
}

function saveNegativePromptTemplate() {
  emit('save-negative-template', {
    id: negativePromptDraft.id || undefined,
    name: negativePromptDraft.name,
    category: negativePromptDraft.category,
    prompt: negativePromptDraft.prompt,
    source: negativePromptDraft.source === 'system-fixed' ? 'system-fixed' : 'custom'
  })

  if (negativePromptDraft.source !== 'system-fixed') {
    resetNegativePromptDraft()
  }
}

function removeNegativePromptTemplate(templateId) {
  emit('remove-negative-template', templateId)
  if (negativePromptDraft.id === templateId) {
    resetNegativePromptDraft()
  }
}

function createTagCategory() {
  const draftCategory = {
    id: '',
    name: '',
    tags: []
  }
  tagCategoryDrafts.value = [...tagCategoryDrafts.value, draftCategory]
  categoryNameEditingState.categoryKey = `draft-category-${tagCategoryDrafts.value.length - 1}`
  categoryNameEditingState.value = ''
}

function startRenameCategory(category) {
  categoryNameEditingState.categoryKey = category.categoryKey
  categoryNameEditingState.value = category.name || ''
}

function cancelRenameCategory() {
  if (!categoryNameEditingState.categoryKey) {
    return
  }

  const draftIndex = Number.parseInt(String(categoryNameEditingState.categoryKey).replace('draft-category-', ''), 10)
  if (Number.isInteger(draftIndex)) {
    const draftCategory = tagCategoryDrafts.value[draftIndex]
    if (draftCategory && !draftCategory.id && !draftCategory.name && (draftCategory.tags || []).length === 0) {
      tagCategoryDrafts.value = tagCategoryDrafts.value.filter((_item, index) => index !== draftIndex)
    }
  }

  categoryNameEditingState.categoryKey = ''
  categoryNameEditingState.value = ''
}

function saveTagCategory(category) {
  emit('save-tag-category', {
    id: category.id || undefined,
    name: categoryNameEditingState.categoryKey === category.categoryKey
      ? categoryNameEditingState.value
      : category.name
  })
  cancelRenameCategory()
}

function removeTagCategory(category) {
  emit('remove-tag-category', {
    id: category.id
  })
}

function isDefaultTagCategory(categoryId = '') {
  return DEFAULT_TAG_CATEGORY_IDS.has(String(categoryId || ''))
}

function startCreateTag(category) {
  tagCreatorState.categoryKey = category.categoryKey
  tagCreatorState.value = ''
}

function cancelCreateTag() {
  tagCreatorState.categoryKey = ''
  tagCreatorState.value = ''
}

function saveTag(category) {
  emit('save-tag', {
    categoryId: category.id,
    name: tagCreatorState.value
  })
  cancelCreateTag()
}

function removeTag(categoryId, tagId) {
  emit('remove-tag', {
    categoryId,
    tagId
  })
}
</script>

<template>
  <div class="panel-shell">
    <header class="section-header">
      <div>
        <h2>提示词库</h2>
        <p class="section-copy">管理系统提示词、自定义提示词、标签库和风险提示。</p>
      </div>
    </header>

    <div class="panel-content panel-content--prompt-library">
      <section class="prompt-library-grid prompt-library-grid--triple prompt-library-grid--fixed-height">
        <article class="prompt-library-column prompt-library-column--positive">
          <div class="prompt-library-column__header prompt-library-column__header--stacked">
            <div>
              <h3>正向提示词</h3>
              <p class="prompt-library-column__eyebrow">系统模板与自定义模板统一编辑</p>
            </div>
          </div>

          <div class="prompt-library-column__body prompt-library-column__body--stacked scrollbar-hidden prompt-library-column__body--full">
            <div class="prompt-template-editor">
              <div class="prompt-template-editor__header">
                <span>编辑正向模板</span>
                <button class="secondary-action secondary-action--compact" type="button" @click="resetCustomDraft">新建正向模板</button>
              </div>
              <label class="form-field">
                <span>模板名称</span>
                <input v-model="customDraft.name" type="text" placeholder="输入模板名称" />
              </label>
              <label class="form-field">
                <span>正向提示词</span>
                <textarea v-model="customDraft.prompt" rows="6" placeholder="输入正向提示词"></textarea>
              </label>
              <div class="prompt-template-editor__actions">
                <button class="primary-action" type="button" @click="savePositiveTemplate">保存正向模板</button>
                <button
                  class="secondary-action"
                  type="button"
                  :disabled="!customDraft.id || customDraft.source === 'system-fixed'"
                  @click="removeCustomTemplate(customDraft.id)"
                >
                  删除正向模板
                </button>
              </div>
            </div>

            <div class="prompt-library-list">
              <button
                v-for="template in allTemplateDrafts"
                :key="template.id"
                class="prompt-template-row prompt-template-row--button"
                type="button"
                @click="applyPositiveTemplate(template)"
              >
                <strong>{{ template.name }}</strong>
                <span>{{ template.source === 'system-fixed' ? '系统模板' : '自定义模板' }}</span>
              </button>
            </div>
          </div>
        </article>

        <article class="prompt-library-column prompt-library-column--negative">
          <div class="prompt-library-column__header prompt-library-column__header--stacked">
            <div>
              <h3>负向提示词</h3>
              <p class="prompt-library-column__eyebrow">反向提示词库</p>
            </div>
          </div>

          <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--stacked prompt-library-column__body--full">
            <div class="prompt-template-editor">
              <div class="prompt-template-editor__header">
                <span>编辑反向模板</span>
                <button class="secondary-action secondary-action--compact" type="button" @click="resetNegativePromptDraft">新建反向模板</button>
              </div>
              <label class="form-field">
                <span>模板名称</span>
                <input v-model="negativePromptDraft.name" type="text" :placeholder="negativeTemplatePlaceholder" />
              </label>
              <label class="form-field">
                <span>反向提示词</span>
                <textarea v-model="negativePromptDraft.prompt" rows="6"></textarea>
              </label>
              <div class="prompt-template-editor__actions">
                <button class="primary-action" type="button" @click="saveNegativePromptTemplate">保存反向提示词模板</button>
                <button class="secondary-action" type="button" :disabled="!negativePromptDraft.id || negativePromptDraft.source === 'system-fixed'" @click="removeNegativePromptTemplate(negativePromptDraft.id)">删除反向提示词模板</button>
              </div>
            </div>

            <div class="prompt-library-list">
              <button
                v-for="template in sortedNegativePromptTemplates"
                :key="template.id"
                class="prompt-template-row prompt-template-row--button"
                type="button"
                @click="applyNegativeTemplate(template)"
              >
                <strong>{{ template.name }}</strong>
                <span>{{ template.category || '反向提示词' }}</span>
              </button>
            </div>
          </div>
        </article>

        <article class="prompt-library-column prompt-library-column--tags">
          <div class="prompt-library-column__header prompt-library-column__header--stacked">
            <div>
              <h3>分类标签</h3>
              <p class="prompt-library-column__eyebrow">标签库</p>
            </div>
            <button class="secondary-action secondary-action--compact" type="button" @click="createTagCategory">增加分类</button>
          </div>

          <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--full">
            <div class="prompt-tag-category-grid">
              <section
                v-for="category in tagCategoryBlocks"
                :key="category.categoryKey"
                class="prompt-tag-category-card"
              >
                <div class="prompt-tag-category-card__header">
                  <div v-if="categoryNameEditingState.categoryKey === category.categoryKey" class="prompt-tag-category-card__title-edit">
                    <input
                      v-model="categoryNameEditingState.value"
                      type="text"
                      placeholder="输入分类名称"
                    />
                    <button class="secondary-action secondary-action--compact" type="button" @click="saveTagCategory(category)">保存分类</button>
                    <button class="secondary-action secondary-action--compact" type="button" @click="cancelRenameCategory">取消</button>
                  </div>
                  <template v-else>
                    <strong>{{ category.name || '未命名分类' }}</strong>
                    <div class="prompt-tag-category-card__actions">
                      <button class="secondary-action secondary-action--compact" type="button" @click="startRenameCategory(category)">编辑分类</button>
                      <button
                        v-if="!isDefaultTagCategory(category.id)"
                        class="secondary-action secondary-action--compact"
                        type="button"
                        :disabled="!category.id"
                        :title="isDefaultTagCategory(category.id) ? '默认标签分类不可删除' : ''"
                        @click="removeTagCategory(category)"
                      >
                        删除分类
                      </button>
                    </div>
                  </template>
                </div>

                <div class="prompt-tag-chip-list">
                  <article
                    v-for="tag in category.tags"
                    :key="tag.id || `${category.categoryKey}-${tag.name}`"
                    class="prompt-tag-chip"
                    title="半透明绿色"
                  >
                    <span>{{ tag.name }}</span>
                    <button class="prompt-tag-chip__remove" type="button" aria-label="删除标签" @click="removeTag(category.id, tag.id)">×</button>
                  </article>

                  <div
                    v-if="tagCreatorState.categoryKey === category.categoryKey"
                    class="prompt-tag-chip prompt-tag-chip--creator"
                  >
                    <input
                      v-model="tagCreatorState.value"
                      type="text"
                      placeholder="输入标签"
                    />
                    <button class="secondary-action secondary-action--compact" type="button" :disabled="!category.id" @click="saveTag(category)">保存</button>
                    <button class="secondary-action secondary-action--compact" type="button" @click="cancelCreateTag">取消</button>
                  </div>

                  <button
                    v-else
                    class="prompt-tag-chip prompt-tag-chip--new"
                    type="button"
                    :disabled="!category.id"
                    @click="startCreateTag(category)"
                  >
                    新建标签
                  </button>
                </div>
              </section>
            </div>
          </div>
        </article>

        <aside class="prompt-library-risk-sidebar prompt-library-stack prompt-library-stack--risk prompt-library-column--risk">
          <article class="prompt-library-column prompt-library-stack__panel prompt-library-risk-panel">
            <div class="prompt-library-column__header prompt-library-column__header--stacked">
              <div>
                <h3>违禁提示词</h3>
                <p class="prompt-library-column__eyebrow">禁用词提示</p>
              </div>
            </div>

            <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--full">
              <p class="prompt-risk-copy">以下词建议直接避免使用</p>
              <div class="prompt-risk-list">
                <article v-for="riskWord in bannedRiskHints" :key="riskWord" class="prompt-risk-card prompt-risk-card--danger">
                  <strong>{{ riskWord }}</strong>
                </article>
              </div>
            </div>
          </article>

          <article class="prompt-library-column prompt-library-stack__panel prompt-library-risk-panel">
            <div class="prompt-library-column__header prompt-library-column__header--stacked">
              <div>
                <h3>警告提示词</h3>
                <p class="prompt-library-column__eyebrow">警告词提示</p>
              </div>
            </div>

            <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--full">
              <p class="prompt-risk-copy">以下词建议改写后再使用</p>
              <div class="prompt-risk-list">
                <article v-for="riskWord in warningRiskHints" :key="riskWord" class="prompt-risk-card prompt-risk-card--warning">
                  <strong>{{ riskWord }}</strong>
                </article>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </div>
  </div>
</template>
