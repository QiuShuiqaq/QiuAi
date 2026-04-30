<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  menuLabel: {
    type: String,
    required: true
  },
  exportItems: {
    type: Array,
    required: true
  },
  selectedExportIds: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['toggle-export-item', 'batch-download', 'open-output-directory', 'delete-export-item'])

const outputDirectoryIconUrl = new URL('../../../icon/wenjianjia.png', import.meta.url).href
const downloadIconUrl = new URL('../../../icon/down.png', import.meta.url).href
const deleteIconUrl = new URL('../../../icon/shanchu.png', import.meta.url).href
const pageSize = 8
const currentPage = ref(1)

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(props.exportItems.length / pageSize))
})

const pagedExportItems = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize
  return props.exportItems.slice(startIndex, startIndex + pageSize)
})

watch(() => props.exportItems.length, () => {
  currentPage.value = Math.min(currentPage.value, totalPages.value)
})

function toggleItem(itemId) {
  emit('toggle-export-item', itemId)
}

function handleBatchDownload() {
  // 批量下载事件预留：后续可在这里接入本地导出与下载逻辑。
  emit('batch-download')
}

function handleOpenOutputDirectory(directoryPath) {
  // 打开输出目录事件预留：后续可在这里接入桌面端目录打开逻辑。
  emit('open-output-directory', directoryPath)
}

function handleDeleteExportItem(itemId) {
  // 删除结果文件夹事件预留：后续可在这里接入桌面端目录删除逻辑。
  emit('delete-export-item', itemId)
}

function goToPreviousPage() {
  currentPage.value = Math.max(1, currentPage.value - 1)
}

function goToNextPage() {
  currentPage.value = Math.min(totalPages.value, currentPage.value + 1)
}
</script>

<template>
  <div class="panel-shell">
    <header class="section-header">
      <div>
        <h2>结果导出</h2>
        <p class="section-copy">{{ menuLabel }} 已生成分组文件夹</p>
      </div>
    </header>

    <div class="module-scroll panel-content panel-content--export-scroll panel-content--with-footer scrollbar-hidden">
      <article v-for="item in pagedExportItems" :key="item.id" class="export-item">
        <label class="export-item__toggle">
          <input
            class="export-item__checkbox"
            :checked="selectedExportIds.includes(item.id)"
            type="checkbox"
            @change="toggleItem(item.id)"
          />
        </label>

        <label class="export-item__label">
          <span class="export-item__copy">
            <strong>{{ item.name }}</strong>
            <small>{{ item.type }} / {{ item.status }}</small>
            <small>{{ `${item.itemCount || 0} 个图片` }}</small>
          </span>
        </label>

        <div class="export-item__actions">
          <button
            v-if="item.directoryPath || item.outputDirectory"
            class="icon-action-button export-item__action"
            type="button"
            aria-label="打开输出目录"
            title="打开输出目录"
            @click="handleOpenOutputDirectory(item.directoryPath || item.outputDirectory)"
          >
            <img :src="outputDirectoryIconUrl" alt="" />
          </button>
          <button
            class="icon-action-button icon-action-button--danger export-item__action"
            type="button"
            aria-label="删除结果文件夹"
            title="删除结果文件夹"
            @click="handleDeleteExportItem(item.id)"
          >
            <img :src="deleteIconUrl" alt="" />
          </button>
        </div>
      </article>

      <p class="section-copy">复选框用于批量选择下载的结果文件夹。</p>
    </div>

    <div v-if="totalPages > 1" class="export-pagination">
      <button
        class="secondary-action pagination-arrow-button"
        type="button"
        aria-label="上一页"
        :disabled="currentPage === 1"
        @click="goToPreviousPage"
      >
        <span class="pagination-arrow-button__triangle pagination-arrow-button__triangle--left"></span>
      </button>
      <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
      <button
        class="secondary-action pagination-arrow-button"
        type="button"
        aria-label="下一页"
        :disabled="currentPage === totalPages"
        @click="goToNextPage"
      >
        <span class="pagination-arrow-button__triangle pagination-arrow-button__triangle--right"></span>
      </button>
    </div>

    <footer class="panel-footer">
      <button class="icon-action-button icon-action-button--primary export-download-button" type="button" aria-label="批量下载" title="批量下载" @click="handleBatchDownload">
        <img :src="downloadIconUrl" alt="" />
      </button>
    </footer>
  </div>
</template>
