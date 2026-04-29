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
  }
})

const emit = defineEmits(['save-template', 'remove-template'])
const fixedTemplateDrafts = ref([])
const expandedFixedTemplateIds = ref([])
const expandedStoredTemplateIds = ref([])

// 固定按钮模板：商品主图 / 详情图 / 细节图 / 尺寸图 / 白底图 / 颜色图

const customDraft = reactive({
  id: '',
  name: '',
  category: '自定义提示词',
  prompt: '',
  source: 'custom'
})

const sortedStoredTemplates = computed(() => {
  return [
    ...fixedTemplateDrafts.value.map((template) => ({
      ...template,
      sourceLabel: '按钮提示词'
    })),
    ...props.customPromptTemplates.map((template) => ({
      ...template,
      sourceLabel: '自定义提示词'
    }))
  ].sort((left, right) => {
    return String(left.name || '').localeCompare(String(right.name || ''), 'zh-Hans-CN')
  })
})

watch(
  () => props.fixedPromptTemplates,
  (templates = []) => {
    fixedTemplateDrafts.value = templates.map((template) => ({
      id: template.id,
      name: template.name || '',
      category: template.category || '按钮提示词',
      prompt: template.prompt || '',
      source: 'system-fixed'
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
    source: 'system-fixed'
  }
}

function applyCustomTemplate(template = {}) {
  customDraft.id = template.id || ''
  customDraft.name = template.name || ''
  customDraft.category = template.category || '自定义提示词'
  customDraft.prompt = template.prompt || ''
  customDraft.source = 'custom'
}

function resetCustomDraft() {
  applyCustomTemplate({})
}

function saveFixedTemplate(template) {
  emit('save-template', buildFixedDraft(template))
}

function saveCustomTemplate() {
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

function toggleTemplateExpansion(templateId) {
  if (!templateId) {
    return
  }

  expandedFixedTemplateIds.value = expandedFixedTemplateIds.value.includes(templateId)
    ? expandedFixedTemplateIds.value.filter((item) => item !== templateId)
    : [...expandedFixedTemplateIds.value, templateId]
}

function toggleStoredTemplateExpansion(templateId) {
  if (!templateId) {
    return
  }

  expandedStoredTemplateIds.value = expandedStoredTemplateIds.value.includes(templateId)
    ? expandedStoredTemplateIds.value.filter((item) => item !== templateId)
    : [...expandedStoredTemplateIds.value, templateId]
}

function isTemplateExpanded(templateId) {
  return expandedFixedTemplateIds.value.includes(templateId)
}

function isStoredTemplateExpanded(templateId) {
  return expandedStoredTemplateIds.value.includes(templateId)
}
</script>

<template>
  <div class="panel-shell">
    <header class="section-header">
      <div>
        <h2>提示词库</h2>
        <p class="section-copy">管理按钮提示词和自定义提示词模板，所有修改都保存在本地。</p>
      </div>
    </header>

    <div class="panel-content panel-content--prompt-library">
      <section class="prompt-library-grid">
        <article class="prompt-library-column">
          <div class="prompt-library-column__header">
            <h3>按钮提示词</h3>
          </div>

          <div class="prompt-library-column__body scrollbar-hidden">
            <div class="prompt-library-list">
              <section
                v-for="template in fixedTemplateDrafts"
                :key="template.id"
                class="prompt-template-disclosure"
              >
                <button
                  class="prompt-template-disclosure__summary"
                  type="button"
                  @click="toggleTemplateExpansion(template.id)"
                >
                  <strong>{{ template.name || '未命名按钮' }}</strong>
                  <span>{{ isTemplateExpanded(template.id) ? '收起' : '展开' }}</span>
                </button>

                <div v-if="isTemplateExpanded(template.id)" class="prompt-template-disclosure__content">
                  <div class="prompt-template-row__preview">
                    <span>按钮预览</span>
                    <button class="secondary-action prompt-template-preview-button" type="button">
                      {{ template.name || '未命名按钮' }}
                    </button>
                  </div>
                  <label class="form-field">
                    <span>按钮名称</span>
                    <input v-model="template.name" type="text" placeholder="输入按钮名称" />
                  </label>
                  <label class="form-field prompt-template-row__prompt">
                    <span>提示词</span>
                    <textarea v-model="template.prompt" rows="4" placeholder="输入按钮对应的固定提示词"></textarea>
                  </label>
                  <button class="primary-action" type="button" @click="saveFixedTemplate(template)">保存按钮提示词</button>
                </div>
              </section>
            </div>
          </div>
        </article>

        <article class="prompt-library-column">
          <div class="prompt-library-column__header">
            <h3>自定义提示词</h3>
            <button class="secondary-action" type="button" @click="resetCustomDraft">新建自定义模板</button>
          </div>

          <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--stacked">
            <div class="prompt-template-editor">
              <label class="form-field">
                <span>模板名称</span>
                <input v-model="customDraft.name" type="text" />
              </label>
              <label class="form-field">
                <span>分类</span>
                <input v-model="customDraft.category" type="text" />
              </label>
              <label class="form-field">
                <span>提示词</span>
                <textarea v-model="customDraft.prompt" rows="6"></textarea>
              </label>
              <div class="prompt-template-editor__actions">
                <button class="primary-action" type="button" @click="saveCustomTemplate">保存模板</button>
                <button class="secondary-action" type="button" :disabled="!customDraft.id" @click="removeCustomTemplate(customDraft.id)">删除模板</button>
              </div>
            </div>

            <div class="prompt-library-list">
              <button
                v-for="template in customPromptTemplates"
                :key="template.id"
                class="prompt-template-row prompt-template-row--button"
                type="button"
                @click="applyCustomTemplate(template)"
              >
                <strong>{{ template.name }}</strong>
                <span>{{ template.category }}</span>
              </button>
            </div>
          </div>
        </article>

        <article class="prompt-library-column prompt-library-column--sidebar">
          <div class="prompt-library-column__header">
            <div>
              <h3>提示词存储</h3>
              <span class="section-copy">按模板名称排序</span>
            </div>
          </div>

          <div class="prompt-library-column__body scrollbar-hidden">
            <div class="prompt-library-list">
              <section
                v-for="template in sortedStoredTemplates"
                :key="`stored-${template.id}`"
                class="prompt-storage-card"
              >
                <button
                  class="prompt-storage-card__summary"
                  type="button"
                  @click="toggleStoredTemplateExpansion(template.id)"
                >
                  <strong>{{ template.name || '未命名模板' }}</strong>
                  <span>{{ isStoredTemplateExpanded(template.id) ? '收起' : '展开' }}</span>
                </button>

                <div v-if="isStoredTemplateExpanded(template.id)" class="prompt-storage-card__content">
                  <div class="prompt-storage-card__header">
                    <span>{{ template.sourceLabel }}</span>
                    <small>{{ template.category || '未分类' }}</small>
                  </div>
                  <p>{{ template.prompt || '暂无提示词内容' }}</p>
                </div>
              </section>
            </div>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>
