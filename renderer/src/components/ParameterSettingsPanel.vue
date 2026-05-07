<script setup>
import { computed } from 'vue'
import { applyTemplateSelectionToAssignment } from '../utils/assignmentTemplateUpdate.js'

const props = defineProps({
  activeMenu: {
    type: String,
    required: true
  },
  menuLabel: {
    type: String,
    required: true
  },
  draftForm: {
    type: Object,
    required: true
  },
  modelOptions: {
    type: Array,
    required: true
  },
  batchOptions: {
    type: Array,
    required: true
  },
  ratioOptions: {
    type: Array,
    required: true
  },
  uploadDirectoryDrafts: {
    type: Object,
    default: () => ({})
  },
  promptTemplates: {
    type: Array,
    default: () => []
  },
  fixedNegativePromptTemplates: {
    type: Array,
    default: () => []
  },
  customNegativePromptTemplates: {
    type: Array,
    default: () => []
  },
  submitButtonState: {
    type: String,
    default: 'idle'
  },
  longRunningHint: {
    type: String,
    default: ''
  },
  taskScaleSummary: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'update-field',
  'update-upload-directory-draft',
  'save-upload-directory',
  'submit-task',
  'select-single-image',
  'select-single-design-image',
  'select-series-design-images',
  'select-series-generate-image'
])

const seriesAssignments = computed(() => {
  return Array.isArray(props.draftForm.imageAssignments) ? props.draftForm.imageAssignments : []
})

const compareModels = computed(() => {
  return Array.isArray(props.draftForm.compareModels) ? props.draftForm.compareModels : []
})

const seriesGeneratePromptAssignments = computed(() => {
  return Array.isArray(props.draftForm.promptAssignments) ? props.draftForm.promptAssignments : []
})

const promptTemplateOptions = computed(() => {
  return Array.isArray(props.promptTemplates) ? props.promptTemplates : []
})

const negativePromptTemplateOptions = computed(() => {
  return [
    ...(Array.isArray(props.fixedNegativePromptTemplates) ? props.fixedNegativePromptTemplates : []),
    ...(Array.isArray(props.customNegativePromptTemplates) ? props.customNegativePromptTemplates : [])
  ]
})

const uploadIconUrl = new URL('../../../icon/shangchuan.png', import.meta.url).href
const saveDirectoryIconUrl = new URL('../../../icon/baocun.png', import.meta.url).href
const promptTemplateIconUrl = new URL('../../../icon/moban.png', import.meta.url).href

const submitButtonLabel = computed(() => {
  if (props.submitButtonState === 'submitting') {
    return '提交中...'
  }

  if (props.submitButtonState === 'success') {
    return '提交成功√'
  }

  return '提交任务'
})

function emitField(field, value) {
  emit('update-field', {
    field,
    value
  })
}

function getUploadDirectoryValue(menuKey) {
  return props.uploadDirectoryDrafts?.[menuKey] || ''
}

function emitUploadDirectoryDraft(menuKey, value) {
  emit('update-upload-directory-draft', {
    menuKey,
    value
  })
}

function saveUploadDirectory(menuKey) {
  emit('save-upload-directory', menuKey)
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function updateStepperField(field, rawValue, min, max) {
  const numericValue = Number(rawValue)

  if (!Number.isFinite(numericValue)) {
    emitField(field, min)
    return
  }

  emitField(field, clampValue(Math.round(numericValue), min, max))
}

function stepField(field, currentValue, delta, min, max) {
  const nextValue = clampValue((Number(currentValue) || min) + delta, min, max)
  emitField(field, nextValue)
}

function handleSubmitTask() {
  // 提交任务事件预留：后续可在这里串联真实表单校验与任务提交。
  emit('submit-task')
}

function updateAssignment(index, field, value) {
  const nextAssignments = seriesAssignments.value.map((item, currentIndex) => {
    if (currentIndex !== index) {
      return item
    }

    return {
      ...item,
      [field]: value
    }
  })

  emitField('imageAssignments', nextAssignments)
}

function updateAssignmentBatchPrompt(index, batchPromptIndex, value) {
  const nextAssignments = seriesAssignments.value.map((item, currentIndex) => {
    if (currentIndex !== index) {
      return item
    }

    const nextBatchPrompts = Array.isArray(item.batchPrompts) ? [...item.batchPrompts] : []
    nextBatchPrompts[batchPromptIndex] = value

    return {
      ...item,
      batchPrompts: nextBatchPrompts
    }
  })

  emitField('imageAssignments', nextAssignments)
}

function replaceAssignments(nextAssignments) {
  emitField('imageAssignments', Array.isArray(nextAssignments) ? nextAssignments : [])
}

function updateSeriesGenerateAssignment(index, field, value) {
  const nextAssignments = seriesGeneratePromptAssignments.value.map((item, currentIndex) => {
    if (currentIndex !== index) {
      return item
    }

    return {
      ...item,
      [field]: value
    }
  })

  emitField('promptAssignments', nextAssignments)
}

function updateSeriesGenerateBatchPrompt(index, batchPromptIndex, value) {
  const nextAssignments = seriesGeneratePromptAssignments.value.map((item, currentIndex) => {
    if (currentIndex !== index) {
      return item
    }

    const nextBatchPrompts = Array.isArray(item.batchPrompts) ? [...item.batchPrompts] : []
    nextBatchPrompts[batchPromptIndex] = value

    return {
      ...item,
      batchPrompts: nextBatchPrompts
    }
  })

  emitField('promptAssignments', nextAssignments)
}

function updateCompareModel(index, value) {
  const nextModels = Array.from({ length: 4 }, (_unused, currentIndex) => {
    return currentIndex === index ? value : (compareModels.value[currentIndex] || props.modelOptions[currentIndex]?.value || '')
  })

  emitField('compareModels', nextModels)
}

function resolveTemplateById(templateId) {
  return promptTemplateOptions.value.find((template) => template.id === templateId) || null
}

function handleTemplateSelection(targetKind, index, templateId) {
  const template = resolveTemplateById(templateId)
  if (!template) {
    if (targetKind === 'series-design') {
      replaceAssignments(applyTemplateSelectionToAssignment({
        assignments: seriesAssignments.value,
        index,
        template: null
      }))
    } else if (targetKind === 'series-generate') {
      updateSeriesGenerateAssignment(index, 'templateId', '')
      updateSeriesGenerateAssignment(index, 'imageType', '')
    }
    return
  }

  if (targetKind === 'series-design') {
    replaceAssignments(applyTemplateSelectionToAssignment({
      assignments: seriesAssignments.value,
      index,
      template
    }))
    return
  }

  if (targetKind === 'series-generate') {
    updateSeriesGenerateAssignment(index, 'templateId', template.id)
    updateSeriesGenerateAssignment(index, 'imageType', template.name)
    updateSeriesGenerateAssignment(index, 'prompt', template.prompt || '')
  }
}
</script>

<template>
  <div class="panel-shell">
    <header class="section-header">
      <div>
        <h2>参数设置</h2>
      </div>
    </header>

    <div class="module-scroll panel-content panel-content--scrollable panel-content--with-footer scrollbar-hidden">
      <label class="form-field">
        <span>任务名称</span>
        <input
          :value="draftForm.taskName || ''"
          type="text"
          placeholder="输入任务名称，例如 XXA"
          @input="emitField('taskName', $event.target.value)"
        />
      </label>

      <template v-if="activeMenu === 'single-image'">
        <section class="form-field">
          <span>测试图片</span>
          <div class="upload-directory-row">
            <button class="icon-action-button" type="button" aria-label="上传测试图片" title="上传测试图片" @click="emit('select-single-image')">
              <img :src="uploadIconUrl" alt="" />
            </button>
            <input
              class="upload-directory-input"
              :value="getUploadDirectoryValue('single-image')"
              type="text"
              placeholder="默认打开目录"
              @input="emitUploadDirectoryDraft('single-image', $event.target.value)"
            />
            <button class="icon-action-button upload-directory-save" type="button" aria-label="保存目录" title="保存目录" @click="saveUploadDirectory('single-image')">
              <img :src="saveDirectoryIconUrl" alt="" />
            </button>
          </div>
          <article v-if="draftForm.sourceImage" class="asset-chip">
            <img v-if="draftForm.sourceImage.preview" :src="draftForm.sourceImage.preview" :alt="draftForm.sourceImage.name" class="asset-chip__preview" />
            <div class="asset-chip__copy">
              <strong>{{ draftForm.sourceImage.name }}</strong>
              <small>{{ draftForm.sourceImage.sizeLabel || '单图测试输入' }}</small>
            </div>
          </article>
        </section>

        <label class="form-field">
          <span>提示词输入区域</span>
          <textarea
            :value="draftForm.prompt"
            rows="6"
            placeholder="输入同一张图片的统一提示词"
            @input="emitField('prompt', $event.target.value)"
          ></textarea>
        </label>

        <label class="form-field">
          <span>补充说明</span>
          <textarea
            :value="draftForm.notes"
            rows="3"
            placeholder="输入对比测试的补充要求"
            @input="emitField('notes', $event.target.value)"
          ></textarea>
        </label>

        <section class="form-field">
          <span>模型选择</span>
          <div class="compare-model-grid">
            <article class="compare-model-lock">
              <span>对比模型 1</span>
              <strong>nano-banana-fast</strong>
            </article>

            <article class="compare-model-lock">
              <span>对比模型 2</span>
              <strong>gpt-image-2</strong>
            </article>

            <label class="form-field compare-model-field">
              <span>对比模型 3</span>
              <select :value="compareModels[2]" @change="updateCompareModel(2, $event.target.value)">
                <option v-for="model in modelOptions" :key="model.value" :value="model.value">
                  {{ model.label }}
                </option>
              </select>
            </label>

            <label class="form-field compare-model-field">
              <span>对比模型 4</span>
              <select :value="compareModels[3]" @change="updateCompareModel(3, $event.target.value)">
                <option v-for="model in modelOptions" :key="model.value" :value="model.value">
                  {{ model.label }}
                </option>
              </select>
            </label>
          </div>
        </section>

        <label class="form-field">
          <span>输出比例</span>
          <select :value="draftForm.size" @change="emitField('size', $event.target.value)">
            <option v-for="option in ratioOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </template>

      <template v-else-if="activeMenu === 'single-design'">
        <section class="form-field">
          <span>参考图片</span>
          <div class="upload-directory-row">
            <button class="icon-action-button" type="button" aria-label="上传参考图片" title="上传参考图片" @click="emit('select-single-design-image')">
              <img :src="uploadIconUrl" alt="" />
            </button>
            <input
              class="upload-directory-input"
              :value="getUploadDirectoryValue('single-design')"
              type="text"
              placeholder="默认打开目录"
              @input="emitUploadDirectoryDraft('single-design', $event.target.value)"
            />
            <button class="icon-action-button upload-directory-save" type="button" aria-label="保存目录" title="保存目录" @click="saveUploadDirectory('single-design')">
              <img :src="saveDirectoryIconUrl" alt="" />
            </button>
          </div>
          <article v-if="draftForm.sourceImage" class="asset-chip">
            <img v-if="draftForm.sourceImage.preview" :src="draftForm.sourceImage.preview" :alt="draftForm.sourceImage.name" class="asset-chip__preview" />
            <div class="asset-chip__copy">
              <strong>{{ draftForm.sourceImage.name }}</strong>
              <small>{{ draftForm.sourceImage.sizeLabel || '单图设计参考图' }}</small>
            </div>
          </article>
        </section>

        <label class="form-field">
          <span>提示词输入区域</span>
          <textarea
            :value="draftForm.prompt"
            rows="6"
            placeholder="输入单图设计提示词，不上传图片时将直接按文生图执行"
            @input="emitField('prompt', $event.target.value)"
          ></textarea>
        </label>

        <label class="form-field">
          <span>补充说明</span>
          <textarea
            :value="draftForm.notes"
            rows="3"
            placeholder="输入风格、构图、材质表现等补充要求"
            @input="emitField('notes', $event.target.value)"
          ></textarea>
        </label>

        <label class="form-field">
          <span>设计模型</span>
          <select :value="draftForm.model" @change="emitField('model', $event.target.value)">
            <option v-for="model in modelOptions" :key="model.value" :value="model.value">
              {{ model.label }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>输出比例</span>
          <select :value="draftForm.size" @change="emitField('size', $event.target.value)">
            <option v-for="option in ratioOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </template>

      <template v-else-if="activeMenu === 'series-design'">
        <section class="form-field">
          <span>套图素材</span>
          <div class="upload-directory-row">
            <button class="icon-action-button" type="button" aria-label="上传一套图片" title="上传一套图片" @click="emit('select-series-design-images')">
              <img :src="uploadIconUrl" alt="" />
            </button>
            <input
              class="upload-directory-input"
              :value="getUploadDirectoryValue('series-design')"
              type="text"
              placeholder="默认打开目录"
              @input="emitUploadDirectoryDraft('series-design', $event.target.value)"
            />
            <button class="icon-action-button upload-directory-save" type="button" aria-label="保存目录" title="保存目录" @click="saveUploadDirectory('series-design')">
              <img :src="saveDirectoryIconUrl" alt="" />
            </button>
          </div>
        </section>

        <label class="form-field">
          <span>全局主提示词</span>
          <textarea
            :value="draftForm.globalPrompt || ''"
            rows="4"
            placeholder="输入当前整套图片共用的全局主提示词"
            @input="emitField('globalPrompt', $event.target.value)"
          ></textarea>
        </label>

        <label class="form-field">
          <span>模型选择</span>
          <select :value="draftForm.model" @change="emitField('model', $event.target.value)">
            <option v-for="model in modelOptions" :key="model.value" :value="model.value">
              {{ model.label }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>反向提示词</span>
          <select :value="draftForm.negativeTemplateId || ''" @change="emitField('negativeTemplateId', $event.target.value)">
            <option value="">请选择反向提示词模板</option>
            <option v-for="template in negativePromptTemplateOptions" :key="template.id" :value="template.id">
              {{ template.name }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>生成组数</span>
          <div class="number-stepper">
            <button
              class="stepper-button stepper-button--decrement"
              type="button"
              aria-label="减少生成组数"
              @click="stepField('batchCount', draftForm.batchCount, -1, 1, 9999)"
            >
              <span class="stepper-button__triangle stepper-button__triangle--left"></span>
            </button>
            <input
              :value="draftForm.batchCount"
              class="stepper-value"
              type="number"
              min="1"
              max="9999"
              @input="updateStepperField('batchCount', $event.target.value, 1, 9999)"
            />
            <button
              class="stepper-button stepper-button--increment"
              type="button"
              aria-label="增加生成组数"
              @click="stepField('batchCount', draftForm.batchCount, 1, 1, 9999)"
            >
              <span class="stepper-button__triangle stepper-button__triangle--right"></span>
            </button>
          </div>
        </label>

        <div class="assignment-list">
          <article v-for="(assignment, index) in seriesAssignments" :key="assignment.id || assignment.name" class="assignment-card">
            <div class="assignment-card__toggle-row">
              <label class="assignment-card__toggle">
                <input
                  :checked="assignment.selected !== false"
                  type="checkbox"
                  @change="updateAssignment(index, 'selected', $event.target.checked)"
                />
                <span>参与本次生成</span>
              </label>
              <label class="assignment-card__toggle">
                <input
                  :checked="assignment.differentialEnabled === true"
                  type="checkbox"
                  @change="updateAssignment(index, 'differentialEnabled', $event.target.checked)"
                />
                <span>差异化</span>
              </label>
            </div>
            <div class="assignment-card__top">
              <div class="assignment-card__media">
                <div class="assignment-card__media-frame">
                  <img v-if="assignment.preview" :src="assignment.preview" :alt="assignment.name" class="assignment-card__preview" />
                </div>
                <div class="assignment-card__media-copy">
                  <strong>{{ assignment.name }}</strong>
                  <small>{{ assignment.sizeLabel || '套图素材' }}</small>
                </div>
              </div>
              <div class="assignment-card__control-panel">
                <label class="form-field assignment-card__control-field">
                  <span>图片类型</span>
                  <div class="select-icon-field select-icon-field--strong assignment-card__compact-select">
                    <img class="select-icon-field__icon" :src="promptTemplateIconUrl" alt="" />
                    <select
                      class="assignment-card__template-select"
                      :value="assignment.templateId || ''"
                      @change="handleTemplateSelection('series-design', index, $event.target.value)"
                    >
                      <option value="">请选择图片类型</option>
                      <option v-for="template in promptTemplateOptions" :key="template.id" :value="template.id">
                        {{ template.name }}
                      </option>
                    </select>
                  </div>
                </label>
                <div class="assignment-card__control-stack">
                  <label class="form-field assignment-card__control-field">
                    <span>单张比例</span>
                    <select
                      class="assignment-card__compact-select"
                      :value="assignment.size || draftForm.defaultAssignmentRatio || draftForm.size || '1:1'"
                      @change="updateAssignment(index, 'size', $event.target.value)"
                    >
                      <option v-for="option in ratioOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </label>
                  <label class="form-field assignment-card__control-field">
                    <span>单张模型</span>
                    <select
                      class="assignment-card__compact-select"
                      :value="assignment.model || draftForm.defaultAssignmentModel || draftForm.model || ''"
                      @change="updateAssignment(index, 'model', $event.target.value)"
                    >
                      <option v-for="model in modelOptions" :key="model.value" :value="model.value">
                        {{ model.label }}
                      </option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
            <div class="assignment-card__fields">
              <template v-if="assignment.differentialEnabled === true">
                <label
                  v-for="(batchPrompt, batchPromptIndex) in assignment.batchPrompts || []"
                  :key="`${assignment.id || index}-batch-${batchPromptIndex}`"
                  class="form-field assignment-card__prompt-field--flush"
                >
                  <span>{{ `专属提示词${batchPromptIndex + 1}` }}</span>
                  <textarea
                    :value="batchPrompt"
                    rows="3"
                    :placeholder="`输入当前图片第 ${batchPromptIndex + 1} 组的专属提示词`"
                    @input="updateAssignmentBatchPrompt(index, batchPromptIndex, $event.target.value)"
                  ></textarea>
                </label>
              </template>
              <label v-else class="form-field assignment-card__prompt-field--flush">
                <span>图片专属提示词</span>
                <textarea
                  :value="assignment.prompt"
                  rows="3"
                  placeholder="输入当前图片的专属提示词"
                  @input="updateAssignment(index, 'prompt', $event.target.value)"
                ></textarea>
              </label>
            </div>
          </article>
        </div>

        <p v-if="longRunningHint" class="section-copy">{{ longRunningHint }}</p>
        <section v-if="taskScaleSummary" class="task-scale-summary">
          <strong>当前任务预计输出 {{ taskScaleSummary.totalOutputs }} 张</strong>
          <small>风险等级：{{ taskScaleSummary.levelLabel }}</small>
          <small>预计积分：{{ taskScaleSummary.estimatedCredits || 0 }}</small>
        </section>
      </template>

      <template v-else-if="activeMenu === 'series-generate'">
        <section class="form-field">
          <span>参考图片</span>
          <div class="upload-directory-row">
            <button class="icon-action-button" type="button" aria-label="上传参考图" title="上传参考图" @click="emit('select-series-generate-image')">
              <img :src="uploadIconUrl" alt="" />
            </button>
            <input
              class="upload-directory-input"
              :value="getUploadDirectoryValue('series-generate')"
              type="text"
              placeholder="默认打开目录"
              @input="emitUploadDirectoryDraft('series-generate', $event.target.value)"
            />
            <button class="icon-action-button upload-directory-save" type="button" aria-label="保存目录" title="保存目录" @click="saveUploadDirectory('series-generate')">
              <img :src="saveDirectoryIconUrl" alt="" />
            </button>
          </div>
          <article v-if="draftForm.sourceImage" class="asset-chip">
            <img v-if="draftForm.sourceImage.preview" :src="draftForm.sourceImage.preview" :alt="draftForm.sourceImage.name" class="asset-chip__preview" />
            <div class="asset-chip__copy">
              <strong>{{ draftForm.sourceImage.name }}</strong>
              <small>{{ draftForm.sourceImage.sizeLabel || '参考图' }}</small>
            </div>
          </article>
        </section>

        <label class="form-field">
          <span>全局风格提示词</span>
          <textarea
            :value="draftForm.globalPrompt || ''"
            rows="4"
            placeholder="输入当前批次共用的全局风格提示词"
            @input="emitField('globalPrompt', $event.target.value)"
          ></textarea>
        </label>

        <label class="form-field">
          <span>模型选择</span>
          <select :value="draftForm.model" @change="emitField('model', $event.target.value)">
            <option v-for="model in modelOptions" :key="model.value" :value="model.value">
              {{ model.label }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>反向提示词</span>
          <select :value="draftForm.negativeTemplateId || ''" @change="emitField('negativeTemplateId', $event.target.value)">
            <option value="">请选择反向提示词模板</option>
            <option v-for="template in negativePromptTemplateOptions" :key="template.id" :value="template.id">
              {{ template.name }}
            </option>
          </select>
        </label>

        <div class="form-row">
          <label class="form-field">
            <span>生成数量</span>
            <div class="number-stepper">
              <button
                class="stepper-button stepper-button--decrement"
                type="button"
                aria-label="减少生成数量"
                @click="stepField('generateCount', draftForm.generateCount, -1, 1, 500)"
              >
                <span class="stepper-button__triangle stepper-button__triangle--left"></span>
              </button>
              <input
                :value="draftForm.generateCount"
                class="stepper-value"
                type="number"
                min="1"
                max="500"
                @input="updateStepperField('generateCount', $event.target.value, 1, 500)"
              />
              <button
                class="stepper-button stepper-button--increment"
                type="button"
                aria-label="增加生成数量"
                @click="stepField('generateCount', draftForm.generateCount, 1, 1, 500)"
              >
                <span class="stepper-button__triangle stepper-button__triangle--right"></span>
              </button>
            </div>
          </label>

          <label class="form-field">
            <span>批次</span>
            <div class="number-stepper">
              <button
                class="stepper-button stepper-button--decrement"
                type="button"
                aria-label="减少批次"
                @click="stepField('batchCount', draftForm.batchCount, -1, 1, 9999)"
              >
                <span class="stepper-button__triangle stepper-button__triangle--left"></span>
              </button>
              <input
                :value="draftForm.batchCount"
                class="stepper-value"
                type="number"
                min="1"
                max="9999"
                @input="updateStepperField('batchCount', $event.target.value, 1, 9999)"
              />
              <button
                class="stepper-button stepper-button--increment"
                type="button"
                aria-label="增加批次"
                @click="stepField('batchCount', draftForm.batchCount, 1, 1, 9999)"
              >
                <span class="stepper-button__triangle stepper-button__triangle--right"></span>
              </button>
            </div>
          </label>
        </div>
        <p v-if="longRunningHint" class="section-copy">{{ longRunningHint }}</p>
        <section v-if="taskScaleSummary" class="task-scale-summary">
          <strong>当前任务预计输出 {{ taskScaleSummary.totalOutputs }} 张</strong>
          <small>风险等级：{{ taskScaleSummary.levelLabel }}</small>
          <small>预计积分：{{ taskScaleSummary.estimatedCredits || 0 }}</small>
        </section>
        <section class="form-field">
          <span>逐张提示词配置</span>
          <div class="assignment-list">
            <article v-for="(assignment, index) in seriesGeneratePromptAssignments" :key="assignment.id || assignment.index || index" class="assignment-card">
              <div class="assignment-card__body assignment-card__body--prompt-only">
                <div class="assignment-card__fields">
                  <div class="assignment-card__template-row assignment-card__template-row--prompt-only">
                    <div class="assignment-card__template-meta">
                      <strong>{{ `第 ${index + 1} 张` }}</strong>
                      <label class="assignment-card__toggle assignment-card__toggle--inline">
                        <input
                          :checked="assignment.differentialEnabled === true"
                          type="checkbox"
                          @change="updateSeriesGenerateAssignment(index, 'differentialEnabled', $event.target.checked)"
                        />
                        <span>差异化</span>
                      </label>
                    </div>
                    <div class="select-icon-field">
                      <img class="select-icon-field__icon" :src="promptTemplateIconUrl" alt="" />
                      <select
                        class="assignment-card__template-select"
                        :value="assignment.templateId || ''"
                        @change="handleTemplateSelection('series-generate', index, $event.target.value)"
                      >
                        <option value="">请选择图片类型</option>
                        <option v-for="template in promptTemplateOptions" :key="template.id" :value="template.id">
                          {{ template.name }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <template v-if="assignment.differentialEnabled === true">
                    <label
                      v-for="(batchPrompt, batchPromptIndex) in assignment.batchPrompts || []"
                      :key="`${assignment.id || index}-generate-batch-${batchPromptIndex}`"
                      class="form-field assignment-card__prompt-field--flush"
                    >
                      <span>{{ `专属提示词${batchPromptIndex + 1}` }}</span>
                      <textarea
                        :value="batchPrompt"
                        rows="3"
                        :placeholder="`输入第 ${index + 1} 张第 ${batchPromptIndex + 1} 组的专属提示词`"
                        @input="updateSeriesGenerateBatchPrompt(index, batchPromptIndex, $event.target.value)"
                      ></textarea>
                    </label>
                  </template>
                  <label v-else class="form-field assignment-card__prompt-field--flush">
                    <textarea
                      :value="assignment.prompt"
                      rows="3"
                      :placeholder="`输入第 ${index + 1} 张要生成的具体画面要求`"
                      @input="updateSeriesGenerateAssignment(index, 'prompt', $event.target.value)"
                    ></textarea>
                  </label>
                </div>
              </div>
            </article>
          </div>
        </section>

        <label class="form-field">
          <span>输出比例</span>
          <select :value="draftForm.size" @change="emitField('size', $event.target.value)">
            <option v-for="option in ratioOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </template>
    </div>

    <footer class="panel-footer">
      <button
        :class="['primary-action', { 'primary-action--success': submitButtonState === 'success' }]"
        :disabled="submitButtonState !== 'idle'"
        type="button"
        @click="handleSubmitTask"
      >
        {{ submitButtonLabel }}
      </button>
    </footer>
  </div>
</template>
