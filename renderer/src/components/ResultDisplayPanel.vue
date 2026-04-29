<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  activeMenu: {
    type: String,
    required: true
  },
  menuLabel: {
    type: String,
    required: true
  },
  resultPayload: {
    type: Object,
    required: true
  },
  modelPricingCatalog: {
    type: Array,
    required: true
  },
  rechargePricingCatalog: {
    type: Array,
    required: true
  },
  latestTask: {
    type: Object,
    default: null
  }
})

const showModelPricing = computed(() => props.activeMenu === 'model-pricing')
const showSingleImage = computed(() => props.activeMenu === 'single-image')
const showSingleDesign = computed(() => props.activeMenu === 'single-design')
const showSeriesDesign = computed(() => props.activeMenu === 'series-design')
const showSeriesGenerate = computed(() => props.activeMenu === 'series-generate')

const hasContent = computed(() => {
  return Boolean(
    (props.resultPayload.textResults || []).length ||
    (props.resultPayload.comparisonResults || []).length ||
    (props.resultPayload.groupedResults || []).length
  )
})

const taskStatusClassMap = {
  等待中: 'task-status--waiting',
  进行中: 'task-status--running',
  ['\u5df2\u5b8c\u6210']: 'task-status--completed',
  失败: 'task-status--failed'
}

const showLatestTaskProgress = computed(() => {
  return !showModelPricing.value && Boolean(props.latestTask)
})

const groupElapsedLabel = computed(() => {
  const elapsedLabel = props.resultPayload.summary?.elapsedLabel || ''
  return elapsedLabel.replace(/^生成耗时\s*/, '')
})

const latestTaskProgressWidth = computed(() => {
  const rawProgress = Number(props.latestTask?.progress ?? 0)
  return `${Math.min(100, Math.max(0, rawProgress))}%`
})

const latestTaskStatusClass = computed(() => {
  return taskStatusClassMap[props.latestTask?.status] || 'task-status--waiting'
})

const latestTaskMeta = computed(() => {
  if (!props.latestTask) {
    return []
  }

  return [
    {
      label: '任务状态',
      value: props.latestTask.status || '--'
    },
    {
      label: '当前进度',
      value: `${Math.min(100, Math.max(0, Number(props.latestTask.progress ?? 0)))}%`
    },
    {
      label: '当前组',
      value: Number.isInteger(props.latestTask.currentGroupIndex)
        ? `第 ${props.latestTask.currentGroupIndex + 1} 组`
        : '--'
    },
    {
      label: '组内进度',
      value: props.latestTask.currentGroupTotalCount
        ? `${props.latestTask.currentGroupCompletedCount || 0} / ${props.latestTask.currentGroupTotalCount}`
        : '--'
    }
  ]
})

const selectedPreview = ref(null)

function openPreview(item) {
  if (!item?.preview) {
    return
  }

  selectedPreview.value = {
    title: item.title || item.name || '预览图',
    model: item.model || '',
    preview: item.preview
  }
}

function closePreview() {
  selectedPreview.value = null
}

// 模型价格主区示例：
// gpt-image-2
// 3000 / 次
</script>

<template>
  <div class="panel-shell">
    <header class="section-header">
      <div>
        <h2>效果展示</h2>
        <p class="section-copy">{{ resultPayload.summary?.title || `${menuLabel} 当前渲染占位` }}</p>
      </div>
    </header>

    <div class="module-scroll panel-content panel-content--display-scroll scrollbar-hidden">
      <section v-if="showLatestTaskProgress" class="latest-task-progress">
        <div class="latest-task-progress__header">
          <div>
            <h3>任务进度</h3>
            <p class="section-copy">当前仅展示这个模块最新提交的一个任务</p>
          </div>
          <strong :class="['task-status', latestTaskStatusClass]">{{ latestTask?.status || '--' }}</strong>
        </div>

        <div class="latest-task-progress__meta">
          <article v-for="item in latestTaskMeta" :key="item.label" class="latest-task-progress__item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </article>
        </div>

        <div class="task-progress">
          <span class="latest-task-progress__bar" :style="{ width: latestTaskProgressWidth }"></span>
        </div>
      </section>

      <section v-if="showModelPricing" class="result-text-block">
        <h3 class="section-title section-title--centered">积分充值</h3>
        <div class="recharge-price-grid">
          <article v-for="item in rechargePricingCatalog" :key="`${item.price}-${item.credits}`" class="recharge-price-card">
            <span v-if="item.bonus" class="recharge-price-card__ribbon">{{ item.bonus }}</span>
            <strong>{{ item.price }}</strong>
            <span>{{ item.credits }}</span>
          </article>
        </div>

        <h3>模型价格卡片</h3>
        <div class="model-price-grid">
          <article v-for="model in modelPricingCatalog" :key="model.name" class="model-price-card">
            <strong>{{ model.name }}</strong>
            <span>{{ model.credits }}</span>
          </article>
        </div>
      </section>

      <div v-if="!showModelPricing && !hasContent" class="empty-state">
        <strong>空状态占位</strong>
        <p>当前模块还没有结果返回，这里保留文本或图片结果渲染位。</p>
      </div>

      <section v-if="showSingleImage && resultPayload.comparisonResults?.length" class="result-image-block">
        <h3>四模型效果对比</h3>
        <div class="comparison-grid">
          <article v-for="image in resultPayload.comparisonResults" :key="image.id" class="comparison-card">
            <div class="comparison-card__header">
              <strong>{{ image.model }}</strong>
            </div>
            <button class="image-preview-button" type="button" @click="openPreview(image)">
              <img :src="image.preview" :alt="image.title" />
            </button>
          </article>
        </div>
      </section>

      <section v-if="showSingleDesign && resultPayload.comparisonResults?.length" class="result-image-block">
        <h3>单模型效果展示</h3>
        <div class="comparison-grid comparison-grid--single comparison-grid--adaptive">
          <article v-for="image in resultPayload.comparisonResults" :key="image.id" class="comparison-card comparison-card--adaptive">
            <div class="comparison-card__header">
              <strong>{{ image.model }}</strong>
            </div>
            <button class="image-preview-button" type="button" @click="openPreview(image)">
              <img :src="image.preview" :alt="image.title" />
            </button>
          </article>
        </div>
      </section>

      <section v-if="showSeriesDesign && resultPayload.groupedResults?.length" class="result-group-block">
        <h3>批次输出</h3>
        <article v-for="group in resultPayload.groupedResults" :key="group.id" class="result-group-card">
          <div class="result-group-card__header">
            <strong>{{ group.groupTitle }}</strong>
            <span v-if="groupElapsedLabel" class="result-group-card__elapsed">生成耗时 {{ groupElapsedLabel }}</span>
          </div>
          <div class="group-output-grid group-output-grid--scroll group-output-grid--visible-scroll">
            <article v-for="output in group.outputs" :key="output.id" class="image-result-card">
              <button class="image-preview-button" type="button" @click="openPreview(output)">
                <img :src="output.preview" :alt="output.title" />
              </button>
              <strong>{{ output.model }}</strong>
            </article>
          </div>
        </article>
      </section>

      <section v-if="showSeriesGenerate && resultPayload.groupedResults?.length" class="result-group-block">
        <h3>批次输出</h3>
        <article v-for="group in resultPayload.groupedResults" :key="group.id" class="result-group-card">
          <div class="result-group-card__header">
            <strong>{{ group.groupTitle }}</strong>
            <span v-if="groupElapsedLabel" class="result-group-card__elapsed">生成耗时 {{ groupElapsedLabel }}</span>
          </div>
          <div class="group-output-grid group-output-grid--scroll group-output-grid--visible-scroll">
            <article v-for="output in group.outputs" :key="output.id" class="image-result-card">
              <button class="image-preview-button" type="button" @click="openPreview(output)">
                <img :src="output.preview" :alt="output.title" />
              </button>
              <strong>{{ output.model }}</strong>
            </article>
          </div>
        </article>
      </section>
    </div>

    <div v-if="selectedPreview" class="preview-modal" @click.self="closePreview">
      <div class="preview-modal__card">
        <div class="preview-modal__header">
          <div>
            <strong>{{ selectedPreview.title }}</strong>
            <span>{{ selectedPreview.model }}</span>
          </div>
          <button class="secondary-action" type="button" @click="closePreview">关闭</button>
        </div>
        <img :src="selectedPreview.preview" :alt="selectedPreview.title" class="preview-modal__image" />
        <a class="primary-action preview-modal__download" :href="selectedPreview.preview" :download="`${selectedPreview.title}.png`">下载图片</a>
      </div>
    </div>
  </div>
</template>
