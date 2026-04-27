<script setup>
defineProps({
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

const outputDirectoryIconUrl = new URL('../../../icon/baocun.png', import.meta.url).href
const downloadIconUrl = new URL('../../../icon/down.png', import.meta.url).href
const deleteIconUrl = new URL('../../../icon/shanchu.png', import.meta.url).href

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
      <article v-for="item in exportItems" :key="item.id" class="export-item">
        <label class="export-item__label">
          <input
            class="export-item__checkbox"
            :checked="selectedExportIds.includes(item.id)"
            type="checkbox"
            @change="toggleItem(item.id)"
          />
          <span class="export-item__copy">
            <strong>{{ item.name }}</strong>
            <small>{{ item.type }} / {{ item.status }}</small>
            <small>{{ `${item.itemCount || 0} 个结果文件` }}</small>
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
            class="icon-action-button icon-action-button--danger"
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

    <footer class="panel-footer">
      <button class="icon-action-button icon-action-button--primary export-download-button" type="button" aria-label="批量下载" title="批量下载" @click="handleBatchDownload">
        <img :src="downloadIconUrl" alt="" />
      </button>
    </footer>
  </div>
</template>
