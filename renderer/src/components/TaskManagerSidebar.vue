<script setup>
import { computed, ref } from 'vue'
import ResultExportPanel from './ResultExportPanel.vue'

const props = defineProps({
  tasks: {
    type: Array,
    required: true
  },
  activeMenu: {
    type: String,
    required: true
  },
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

const statusClassMap = {
  等待中: 'task-status--waiting',
  进行中: 'task-status--running',
  已完成: 'task-status--completed',
  失败: 'task-status--failed'
}

// 固定任务分类占位：
// 单图测试
// 单图设计
// 套图设计
// 套图生成

const pageSize = 10
const currentPage = ref(1)

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(props.tasks.length / pageSize))
})

const pagedTasks = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize
  return props.tasks.slice(startIndex, startIndex + pageSize)
})

const paddedTasks = computed(() => {
  return Array.from({ length: pageSize }, (_unused, index) => {
    return pagedTasks.value[index] || null
  })
})

const showWorkspaceTasks = computed(() => {
  return props.activeMenu === 'workspace'
})

const showExportPanel = computed(() => {
  return props.activeMenu === 'single-image' ||
    props.activeMenu === 'single-design' ||
    props.activeMenu === 'series-design' ||
    props.activeMenu === 'series-generate'
})

function getStatusClass(status) {
  return statusClassMap[status] || 'task-status--waiting'
}

function formatTaskNumber(taskNumber = '', fallbackId = '') {
  const normalizedValue = String(taskNumber || fallbackId || '')
  return normalizedValue.replace(/^QAI-\d{8}-/i, 'QAI-')
}

function goToPreviousPage() {
  currentPage.value = Math.max(1, currentPage.value - 1)
}

function goToNextPage() {
  currentPage.value = Math.min(totalPages.value, currentPage.value + 1)
}
</script>

<template>
  <section class="task-sidebar-shell">
    <section v-if="showWorkspaceTasks" class="task-sidebar-shell--card">
      <header class="section-header">
        <h2>任务队列</h2>
      </header>

      <section class="task-list-shell">
        <div class="task-list task-list--paged module-scroll">
          <article v-for="(task, index) in paddedTasks" :key="task?.id || `task-empty-${index}`" class="task-card task-card--compact">
            <template v-if="task">
              <div class="task-card__head task-card__head--compact">
                <span class="task-card__summary task-card__summary--strong">任务编号 {{ formatTaskNumber(task.taskNumber, task.id) }}</span>
                <strong :class="['task-status', getStatusClass(task.status)]">{{ task.progress }}%</strong>
              </div>

              <span class="task-card__summary">生成时间 {{ task.createdAt }}</span>

              <div class="task-progress">
                <span class="task-progress__bar" :style="{ width: `${task.progress}%` }"></span>
              </div>
            </template>

            <div v-else class="task-card__empty">空任务位</div>
          </article>
        </div>

        <footer class="task-pagination">
          <button
            class="secondary-action pagination-arrow-button"
            type="button"
            aria-label="上一页"
            :disabled="currentPage === 1"
            @click="goToPreviousPage"
          >
            <span class="pagination-arrow-button__triangle pagination-arrow-button__triangle--left"></span>
          </button>
          <span>第 {{ currentPage }} / {{ totalPages }} 页 · 10 个任务</span>
          <button
            class="secondary-action pagination-arrow-button"
            type="button"
            aria-label="下一页"
            :disabled="currentPage === totalPages"
            @click="goToNextPage"
          >
            <span class="pagination-arrow-button__triangle pagination-arrow-button__triangle--right"></span>
          </button>
        </footer>
      </section>
    </section>

    <section v-else-if="showExportPanel" class="task-export-shell">
      <ResultExportPanel
        :menu-label="menuLabel"
        :export-items="exportItems"
        :selected-export-ids="selectedExportIds"
        @toggle-export-item="emit('toggle-export-item', $event)"
        @batch-download="emit('batch-download')"
        @open-output-directory="emit('open-output-directory', $event)"
        @delete-export-item="emit('delete-export-item', $event)"
      />
    </section>

    <section v-else class="task-sidebar-empty">
      <strong>当前页面暂无侧边内容</strong>
      <p>切换到工作台可查看任务管理，切换到设计页可查看结果导出。</p>
    </section>
  </section>
</template>
