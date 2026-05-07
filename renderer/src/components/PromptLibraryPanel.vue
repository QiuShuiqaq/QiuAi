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
  }
})

const emit = defineEmits([
  'save-template',
  'remove-template',
  'save-negative-template',
  'remove-negative-template'
])
const fixedTemplateDrafts = ref([])
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
const promptFormatGuide = [
  {
    scene: '头像、Q 版人物、表情包',
    length: '60～150',
    tip: '主体 + 风格 + 简单背景，简洁干净'
  },
  {
    scene: '单人插画、古风 / 二次元人设',
    length: '150～300',
    tip: '外貌 + 服饰 + 姿态 + 氛围 + 画风'
  },
  {
    scene: '产品图、静物、美食',
    length: '150～300',
    tip: '产品细节 + 材质 + 光线 + 简约场景'
  },
  {
    scene: '风景、氛围感壁纸',
    length: '200～400',
    tip: '环境 + 时间天气 + 光影 + 色调风格'
  },
  {
    scene: '多人剧情、赛博朋克 / 奇幻大场景',
    length: '400～800',
    tip: '人物 + 动作 + 环境 + 镜头 + 整体氛围，语句连贯'
  }
]

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
</script>

<template>
  <div class="panel-shell">
    <header class="section-header">
      <div>
        <h2>提示词库</h2>
        <p class="section-copy">管理系统提示词、反向提示词与风险提示。</p>
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

        <article class="prompt-library-column prompt-library-column--format">
          <div class="prompt-library-column__header prompt-library-column__header--stacked">
            <div>
              <h3>提示词格式</h3>
              <p class="prompt-library-column__eyebrow">按常见场景快速判断字数与写法重点</p>
            </div>
          </div>

          <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--full">
            <div class="prompt-format-list">
              <article v-for="item in promptFormatGuide" :key="item.scene" class="prompt-format-card">
                <strong>{{ item.scene }}</strong>
                <span>推荐字符数</span>
                <p>{{ item.length }}</p>
                <span>写法要点</span>
                <p>{{ item.tip }}</p>
              </article>
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
