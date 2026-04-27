<script setup>
import { computed, ref, watch } from 'vue'
import { appStore } from '../stores/appStore'

defineProps({
  submitHandler: {
    type: Function,
    required: true
  },
  refreshHandler: {
    type: Function,
    required: true
  },
  pickStyleFolderHandler: {
    type: Function,
    required: true
  },
  pickDetailImageHandler: {
    type: Function,
    required: true
  },
  exportHandler: {
    type: Function,
    required: true
  },
  generationEstimate: {
    type: Object,
    required: true
  }
})

const resultList = computed(() => {
  return (appStore.currentTask.items || []).flatMap((item) => {
    return (item.results || []).map((result) => ({
      ...result,
      itemLabel: item.label
    }))
  })
})

const taskSuccessRate = computed(() => {
  const items = appStore.currentTask.items || []
  if (!items.length) {
    return 0
  }
  const succeededCount = items.filter((item) => item.status === 'succeeded').length
  return Math.round((succeededCount / items.length) * 100)
})

const assetFilter = ref('all')
const selectedAssetKeys = ref([])

const filteredResults = computed(() => {
  if (assetFilter.value === 'recent') {
    return resultList.value.slice(0, 12)
  }

  if (assetFilter.value === 'downloadable') {
    return resultList.value.filter((result) => hasAssetDownloadSource(result))
  }

  return resultList.value
})

const selectedResultList = computed(() => {
  return resultList.value.filter((result) => selectedAssetKeys.value.includes(getAssetKey(result)))
})

const downloadableCount = computed(() => {
  return resultList.value.filter((result) => hasAssetDownloadSource(result)).length
})

watch(resultList, (results) => {
  const nextKeys = new Set(results.map((result) => getAssetKey(result)))
  selectedAssetKeys.value = selectedAssetKeys.value.filter((key) => nextKeys.has(key))
}, { deep: true })

function getDownloadName (result) {
  if (result.savedPath) {
    return result.savedPath.split(/[\\/]/).pop()
  }

  return 'qiuai-image.png'
}

function selectMode (mode) {
  appStore.generation.mode = mode
}

function getStatusClass (status) {
  const knownStatuses = ['idle', 'draft', 'running', 'succeeded', 'failed', 'partial', 'submitting']
  return knownStatuses.includes(status) ? `status-badge--${status}` : 'status-badge--idle'
}

function getAssetKey (result) {
  return [
    result.savedPath,
    result.previewUrl,
    result.url,
    result.itemLabel
  ].filter(Boolean).join('::')
}

function hasAssetDownloadSource (result) {
  return Boolean(result.previewUrl || result.url)
}

function isAssetSelected (result) {
  return selectedAssetKeys.value.includes(getAssetKey(result))
}

function toggleAssetSelection (result) {
  const assetKey = getAssetKey(result)

  if (!assetKey) {
    return
  }

  if (selectedAssetKeys.value.includes(assetKey)) {
    selectedAssetKeys.value = selectedAssetKeys.value.filter((key) => key !== assetKey)
    return
  }

  selectedAssetKeys.value = [...selectedAssetKeys.value, assetKey]
}

function selectAllAssets () {
  selectedAssetKeys.value = filteredResults.value.map((result) => getAssetKey(result))
}

function clearAssetSelection () {
  selectedAssetKeys.value = []
}

function clearPrompt () {
  appStore.generation.prompt = ''
}

function clearStyleFolder () {
  appStore.generation.styleSourceFolder = ''
  appStore.generation.styleSourceFiles = []
}

function clearDetailImage () {
  appStore.generation.detailSourceImage = ''
}

function triggerDownload (href, filename) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function downloadResult (result) {
  const sourceUrl = result.previewUrl || result.url

  if (!sourceUrl) {
    return
  }

  const downloadName = getDownloadName(result)

  if (sourceUrl.startsWith('data:') || sourceUrl.startsWith('blob:')) {
    triggerDownload(sourceUrl, downloadName)
    return
  }

  try {
    const response = await fetch(sourceUrl)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    triggerDownload(blobUrl, downloadName)
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1200)
  } catch (error) {
    triggerDownload(sourceUrl, downloadName)
  }
}

async function downloadSelectedAssets () {
  const downloadQueue = selectedResultList.value.filter((result) => hasAssetDownloadSource(result))

  for (const result of downloadQueue) {
    await downloadResult(result)
    await new Promise((resolve) => window.setTimeout(resolve, 120))
  }
}
</script>

<template>
  <div class="content-stack content-stack--workspace">
    <section id="workspace-panel" class="panel-card panel-card--wide panel-scroll">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Workspace</p>
          <h2>任务配置</h2>
        </div>
        <div class="inline-actions">
          <button class="action-button action-button--ghost" type="button" @click="refreshHandler()">刷新结果</button>
          <button class="action-button" type="button" :disabled="!appStore.selectedTaskId" @click="exportHandler">导出任务</button>
        </div>
      </div>

      <div class="mode-switch">
        <button class="mode-chip" :class="{ 'mode-chip--active': appStore.generation.mode === 'single' }" type="button" @click="selectMode('single')">single</button>
        <button class="mode-chip" :class="{ 'mode-chip--active': appStore.generation.mode === 'style-batch' }" type="button" @click="selectMode('style-batch')">style-batch</button>
        <button class="mode-chip" :class="{ 'mode-chip--active': appStore.generation.mode === 'detail-set' }" type="button" @click="selectMode('detail-set')">detail-set</button>
      </div>

      <div class="workspace-grid-panels">
        <section class="subpanel-card">
          <div class="module-head">
            <h3>提示词与参数</h3>
            <div class="inline-actions">
              <button class="action-button action-button--ghost" type="button" @click="clearPrompt">清空提示词</button>
            </div>
          </div>
          <label class="field-card">
            <span>提示词</span>
            <textarea v-model="appStore.generation.prompt" rows="5" placeholder="输入电商生图提示词，或直接选择下方提示词模板"></textarea>
          </label>

          <div class="form-two-column">
            <label class="field-card">
              <span>提示词模板</span>
              <select v-model="appStore.generation.templateId">
                <option value="">不使用模板</option>
                <option v-for="template in appStore.promptTemplates" :key="template.id" :value="template.id">
                  {{ template.name }} / {{ template.category }}
                </option>
              </select>
            </label>

            <label class="field-card">
              <span>输出比例</span>
              <select v-model="appStore.generation.size">
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
                <option value="2:3">2:3</option>
                <option value="3:2">3:2</option>
              </select>
            </label>
          </div>
        </section>

        <section class="subpanel-card">
          <div class="module-head">
            <h3>输入源</h3>
            <div v-if="appStore.generation.mode === 'style-batch'" class="inline-actions">
              <button class="action-button action-button--ghost" type="button" @click="clearStyleFolder">清空文件夹</button>
            </div>
            <div v-else-if="appStore.generation.mode === 'detail-set'" class="inline-actions">
              <button class="action-button action-button--ghost" type="button" @click="clearDetailImage">清空商品图</button>
            </div>
          </div>

          <div v-if="appStore.generation.mode === 'single'" class="input-note input-note--fixed">
            <strong>单图模式</strong>
            <p>只根据提示词生成一张图，不需要上传参考图。</p>
          </div>

          <div v-else-if="appStore.generation.mode === 'style-batch'" class="input-note input-note--fixed">
            <div class="inline-actions inline-actions--spread">
              <button class="action-button" type="button" @click="pickStyleFolderHandler">选择文件夹</button>
              <span>{{ appStore.generation.styleSourceFolder || '尚未选择文件夹' }}</span>
            </div>
            <p>将对该文件夹中的每张电商图生成 1 张统一风格结果。</p>
            <p>已识别图片：{{ appStore.generation.styleSourceFiles.length }} 张</p>
          </div>

          <div v-else class="input-note input-note--fixed">
            <div class="inline-actions inline-actions--spread">
              <button class="action-button" type="button" @click="pickDetailImageHandler">选择商品图</button>
              <span>{{ appStore.generation.detailSourceImage || '尚未选择商品图' }}</span>
            </div>
            <p>将基于 1 张商品图生成白底主图、场景图、卖点图、细节图。</p>
          </div>
        </section>

        <section class="subpanel-card">
          <div class="module-head">
            <h3>成本预估</h3>
          </div>

          <div class="estimate-strip estimate-strip--workspace">
            <article class="estimate-card">
              <span>模型名称</span>
              <strong class="estimate-card__value">gpt-image-2</strong>
            </article>
            <article class="estimate-card">
              <span>预计出图</span>
              <strong class="estimate-card__value">{{ generationEstimate.imageCount }} 张</strong>
            </article>
            <article class="estimate-card">
              <span>预计积分</span>
              <strong class="estimate-card__value">{{ generationEstimate.totalCredits }}</strong>
            </article>
            <article class="estimate-card">
              <span>预计价格</span>
              <strong class="estimate-card__value">{{ generationEstimate.formattedPriceRange }}</strong>
            </article>
          </div>

          <div class="input-note">
            <strong>{{ generationEstimate.formattedCreditsPerImage }}</strong>
            <p>当前固定使用 gpt-image-2，本地按任务模式实时估算本次生成成本。</p>
          </div>
        </section>
      </div>
    </section>

    <section class="panel-card panel-scroll">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Status</p>
          <h2>任务状态</h2>
        </div>
        <button class="primary-button" type="button" :disabled="appStore.generation.isSubmitting" @click="submitHandler">
          {{ appStore.generation.isSubmitting ? '任务提交中...' : '开始任务' }}
        </button>
      </div>

      <div class="status-summary">
        <article class="status-item">
          <span>任务ID</span>
          <strong>{{ appStore.currentTask.id || '尚未创建任务' }}</strong>
        </article>
        <article class="status-item">
          <span>模式</span>
          <strong>{{ appStore.currentTask.mode || appStore.generation.mode }}</strong>
        </article>
        <article class="status-item">
          <span>状态</span>
          <strong class="status-badge" :class="getStatusClass(appStore.currentTask.status)">{{ appStore.currentTask.status }}</strong>
        </article>
        <article class="status-item">
          <span>任务成功率</span>
          <strong>{{ taskSuccessRate }}%</strong>
        </article>
      </div>

      <div class="progress-meter">
        <span class="progress-meter__fill" :style="{ width: `${appStore.currentTask.progress || 0}%` }"></span>
      </div>

      <p v-if="appStore.currentTask.outputDirectory" class="result-path">输出目录：{{ appStore.currentTask.outputDirectory }}</p>
      <p v-if="appStore.currentTask.failureReason" class="result-path">失败原因：{{ appStore.currentTask.failureReason }}</p>
      <p v-if="appStore.currentTask.error" class="result-path">错误信息：{{ appStore.currentTask.error }}</p>

      <div class="panel-head panel-head--compact">
        <div>
          <p class="panel-kicker">Subtasks</p>
          <h3>子任务进度</h3>
        </div>
        <span class="sidebar-count">{{ (appStore.currentTask.items || []).length }}</span>
      </div>

      <div class="subtask-list subtask-list--grid">
        <article v-for="item in appStore.currentTask.items" :key="item.id" class="subtask-card">
          <strong>{{ item.label }}</strong>
          <span class="status-badge" :class="getStatusClass(item.status)">{{ item.status }} / {{ item.progress || 0 }}%</span>
          <div class="progress-meter progress-meter--small">
            <span class="progress-meter__fill" :style="{ width: `${item.progress || 0}%` }"></span>
          </div>
          <span v-if="item.error">{{ item.error }}</span>
        </article>
      </div>
    </section>

    <section class="panel-card panel-scroll">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Preview</p>
          <h2>结果预览</h2>
          <p class="result-path">图片资产 / 素材面板</p>
        </div>
        <span class="sidebar-count">{{ resultList.length }} 张</span>
      </div>

      <div class="asset-toolbar">
        <article class="asset-metric">
          <span>素材统计</span>
          <strong>{{ resultList.length }}</strong>
        </article>
        <article class="asset-metric">
          <span>最近生成</span>
          <strong>{{ appStore.currentTask.id || '未开始' }}</strong>
        </article>
        <article class="asset-metric">
          <span>可下载</span>
          <strong>{{ downloadableCount }}</strong>
        </article>
      </div>

      <div class="asset-filter-bar">
        <div class="inline-actions">
          <button class="asset-filter-chip" :class="{ 'asset-filter-chip--active': assetFilter === 'all' }" type="button" @click="assetFilter = 'all'">
            全部素材
          </button>
          <button class="asset-filter-chip" :class="{ 'asset-filter-chip--active': assetFilter === 'downloadable' }" type="button" @click="assetFilter = 'downloadable'">
            可下载
          </button>
          <button class="asset-filter-chip" :class="{ 'asset-filter-chip--active': assetFilter === 'recent' }" type="button" @click="assetFilter = 'recent'">
            最近生成
          </button>
        </div>

        <div class="inline-actions">
          <span class="selection-pill">已选 {{ selectedAssetKeys.length }}</span>
          <button class="action-button action-button--ghost" type="button" :disabled="!filteredResults.length" @click="selectAllAssets">全选素材</button>
          <button class="action-button action-button--ghost" type="button" :disabled="!selectedAssetKeys.length" @click="clearAssetSelection">清空选择</button>
          <button class="action-button" type="button" :disabled="!selectedAssetKeys.length" @click="downloadSelectedAssets">批量下载</button>
        </div>
      </div>

      <div class="result-grid">
        <article
          v-for="result in filteredResults"
          :key="result.savedPath || result.url || result.previewUrl"
          class="result-card asset-card"
          :class="{ 'asset-card--selected': isAssetSelected(result) }"
        >
          <div class="asset-card__meta asset-card__meta--top">
            <span class="asset-tag">图片资产</span>
            <button class="asset-filter-chip" type="button" @click="toggleAssetSelection(result)">
              {{ isAssetSelected(result) ? '已选' : '选择' }}
            </button>
          </div>
          <a :href="result.previewUrl || result.url" :download="getDownloadName(result)">
            <img :src="result.previewUrl || result.url" :alt="result.itemLabel || 'generated result'" />
          </a>
          <div class="asset-card__meta">
            <p class="result-path"><strong>{{ result.itemLabel || '生成结果' }}</strong></p>
            <button class="action-button action-button--ghost" type="button" @click="downloadResult(result)">下载</button>
          </div>
          <div class="asset-card__meta">
            <span class="asset-tag">可下载</span>
            <span class="asset-tag">最近生成</span>
          </div>
          <p class="result-path">{{ result.savedPath || '已自动写入 output 目录' }}</p>
        </article>
      </div>
    </section>
  </div>
</template>
