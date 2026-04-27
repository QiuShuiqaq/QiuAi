<script setup>
import { computed, reactive } from 'vue'

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
  customPromptTemplates: {
    type: Array,
    default: () => []
  },
  submitButtonState: {
    type: String,
    default: 'idle'
  }
})

const emit = defineEmits([
  'update-field',
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

const seriesGenerateImageTypeOptions = [
  '商品主图',
  '详情图',
  '细节图',
  '尺寸图',
  '白底图',
  '颜色图'
]

const uploadIconUrl = new URL('../../../icon/shangchuan.png', import.meta.url).href
const promptImportState = reactive({
  visible: false,
  targetKind: '',
  index: -1
})

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

function updateCompareModel(index, value) {
  const nextModels = Array.from({ length: 4 }, (_unused, currentIndex) => {
    return currentIndex === index ? value : (compareModels.value[currentIndex] || props.modelOptions[currentIndex]?.value || '')
  })

  emitField('compareModels', nextModels)
}

function openPromptImport(targetKind, index) {
  promptImportState.visible = true
  promptImportState.targetKind = targetKind
  promptImportState.index = index
}

function closePromptImport() {
  promptImportState.visible = false
  promptImportState.targetKind = ''
  promptImportState.index = -1
}

function appendPromptTemplate(templatePrompt = '') {
  const promptText = String(templatePrompt || '').trim()
  if (!promptText) {
    closePromptImport()
    return
  }

  if (promptImportState.targetKind === 'series-design') {
    const currentAssignment = seriesAssignments.value[promptImportState.index]
    if (!currentAssignment) {
      closePromptImport()
      return
    }

    const nextPrompt = [String(currentAssignment.prompt || '').trim(), promptText].filter(Boolean).join('\n')
    updateAssignment(promptImportState.index, 'prompt', nextPrompt)
    closePromptImport()
    return
  }

  if (promptImportState.targetKind === 'series-generate') {
    const currentAssignment = seriesGeneratePromptAssignments.value[promptImportState.index]
    if (!currentAssignment) {
      closePromptImport()
      return
    }

    const nextPrompt = [String(currentAssignment.prompt || '').trim(), promptText].filter(Boolean).join('\n')
    updateSeriesGenerateAssignment(promptImportState.index, 'prompt', nextPrompt)
    closePromptImport()
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
          <div class="toggle-row">
            <button class="icon-action-button" type="button" aria-label="上传测试图片" title="上传测试图片" @click="emit('select-single-image')">
              <img :src="uploadIconUrl" alt="" />
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
          <div class="toggle-row">
            <button class="icon-action-button" type="button" aria-label="上传参考图片" title="上传参考图片" @click="emit('select-single-design-image')">
              <img :src="uploadIconUrl" alt="" />
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
          <div class="toggle-row">
            <button class="icon-action-button" type="button" aria-label="上传一套图片" title="上传一套图片" @click="emit('select-series-design-images')">
              <img :src="uploadIconUrl" alt="" />
            </button>
          </div>
        </section>

        <label class="form-field">
          <span>全局主提示词</span>
          <textarea
            :value="draftForm.globalPrompt"
            rows="4"
            placeholder="输入整套图片都要遵守的统一风格要求"
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

        <div class="assignment-list">
          <article v-for="(assignment, index) in seriesAssignments" :key="assignment.id || assignment.name" class="assignment-card">
            <label class="assignment-card__toggle">
              <input
                :checked="assignment.selected !== false"
                type="checkbox"
                @change="updateAssignment(index, 'selected', $event.target.checked)"
              />
              <span>参与本次生成</span>
            </label>
            <div class="assignment-card__body">
              <img v-if="assignment.preview" :src="assignment.preview" :alt="assignment.name" class="assignment-card__preview" />
              <div class="assignment-card__fields">
                <strong>{{ assignment.name }}</strong>
                <label class="form-field">
                  <span>图片类型</span>
                  <div class="prompt-import-row">
                    <select
                      :value="assignment.imageType || ''"
                      @change="updateAssignment(index, 'imageType', $event.target.value)"
                    >
                      <option value="">请选择图片类型</option>
                      <option v-for="type in seriesGenerateImageTypeOptions" :key="type" :value="type">
                        {{ type }}
                      </option>
                    </select>
                    <button class="secondary-action" type="button" @click="openPromptImport('series-design', index)">导入</button>
                  </div>
                </label>
                <label class="form-field">
                  <span>图片专属提示词</span>
                  <input
                    :value="assignment.prompt"
                    type="text"
                    placeholder="输入当前图片的专属提示词"
                    @input="updateAssignment(index, 'prompt', $event.target.value)"
                  />
                </label>
              </div>
            </div>
          </article>
        </div>

        <label class="form-field">
          <span>生成组数</span>
          <div class="number-stepper">
            <button
              class="stepper-button stepper-button--decrement"
              type="button"
              aria-label="减少生成组数"
              @click="stepField('batchCount', draftForm.batchCount, -1, 1, 6)"
            >
              <span class="stepper-button__triangle stepper-button__triangle--left"></span>
            </button>
            <input
              :value="draftForm.batchCount"
              class="stepper-value"
              type="number"
              min="1"
              max="6"
              @input="updateStepperField('batchCount', $event.target.value, 1, 6)"
            />
            <button
              class="stepper-button stepper-button--increment"
              type="button"
              aria-label="增加生成组数"
              @click="stepField('batchCount', draftForm.batchCount, 1, 1, 6)"
            >
              <span class="stepper-button__triangle stepper-button__triangle--right"></span>
            </button>
          </div>
        </label>
      </template>

      <template v-else-if="activeMenu === 'series-generate'">
        <section class="form-field">
          <span>参考图片</span>
          <div class="toggle-row">
            <button class="icon-action-button" type="button" aria-label="上传参考图" title="上传参考图" @click="emit('select-series-generate-image')">
              <img :src="uploadIconUrl" alt="" />
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
            :value="draftForm.globalPrompt"
            rows="5"
            placeholder="输入整组图片统一遵守的风格、构图和电商展示要求"
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

        <div class="form-row">
          <label class="form-field">
            <span>生成数量</span>
            <div class="number-stepper">
              <button
                class="stepper-button stepper-button--decrement"
                type="button"
                aria-label="减少生成数量"
                @click="stepField('generateCount', draftForm.generateCount, -1, 1, 20)"
              >
                <span class="stepper-button__triangle stepper-button__triangle--left"></span>
              </button>
              <input
                :value="draftForm.generateCount"
                class="stepper-value"
                type="number"
                min="1"
                max="20"
                @input="updateStepperField('generateCount', $event.target.value, 1, 20)"
              />
              <button
                class="stepper-button stepper-button--increment"
                type="button"
                aria-label="增加生成数量"
                @click="stepField('generateCount', draftForm.generateCount, 1, 1, 20)"
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
                @click="stepField('batchCount', draftForm.batchCount, -1, 1, 6)"
              >
                <span class="stepper-button__triangle stepper-button__triangle--left"></span>
              </button>
              <input
                :value="draftForm.batchCount"
                class="stepper-value"
                type="number"
                min="1"
                max="6"
                @input="updateStepperField('batchCount', $event.target.value, 1, 6)"
              />
              <button
                class="stepper-button stepper-button--increment"
                type="button"
                aria-label="增加批次"
                @click="stepField('batchCount', draftForm.batchCount, 1, 1, 6)"
              >
                <span class="stepper-button__triangle stepper-button__triangle--right"></span>
              </button>
            </div>
          </label>
        </div>
        <section class="form-field">
          <span>逐张提示词配置</span>
          <div class="assignment-list">
            <article v-for="(assignment, index) in seriesGeneratePromptAssignments" :key="assignment.id || assignment.index || index" class="assignment-card">
              <div class="assignment-card__body assignment-card__body--prompt-only">
                <div class="assignment-card__fields">
                  <div class="form-row">
                    <strong>{{ `第 ${index + 1} 张` }}</strong>
                    <label class="form-field">
                      <span>图片类型</span>
                      <div class="prompt-import-row">
                        <select
                          :value="assignment.imageType || ''"
                          @change="updateSeriesGenerateAssignment(index, 'imageType', $event.target.value)"
                        >
                          <option value="">请选择图片类型</option>
                          <option v-for="type in seriesGenerateImageTypeOptions" :key="type" :value="type">
                            {{ type }}
                          </option>
                        </select>
                        <button class="secondary-action" type="button" @click="openPromptImport('series-generate', index)">导入</button>
                      </div>
                    </label>
                  </div>
                  <label class="form-field">
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

    <div v-if="promptImportState.visible" class="prompt-import-modal" @click.self="closePromptImport">
      <div class="prompt-import-modal__card">
        <div class="prompt-import-modal__header">
          <div>
            <strong>请选择要补充的提示词模板</strong>
            <span class="section-copy">仅展示自定义提示词，点击后会补充到当前提示词</span>
          </div>
          <button class="secondary-action" type="button" @click="closePromptImport">关闭</button>
        </div>
        <div class="prompt-import-modal__list scrollbar-hidden">
          <button
            v-for="template in customPromptTemplates"
            :key="template.id"
            class="prompt-import-modal__item"
            type="button"
            @click="appendPromptTemplate(template.prompt)"
          >
            <strong>{{ template.name }}</strong>
            <span>{{ template.category }}</span>
            <small>{{ template.prompt }}</small>
          </button>
          <div v-if="!customPromptTemplates.length" class="task-sidebar-empty">
            <strong>暂无自定义提示词</strong>
            <p>请先到提示词库中新增自定义模板。</p>
          </div>
        </div>
        <button class="primary-action" type="button" @click="closePromptImport">补充到当前提示词</button>
      </div>
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
