<script setup>
import WorkspaceDashboard from './WorkspaceDashboard.vue'
import ParameterSettingsPanel from './ParameterSettingsPanel.vue'
import ResultDisplayPanel from './ResultDisplayPanel.vue'
import PromptLibraryPanel from './PromptLibraryPanel.vue'
import ClearRuntimeConfirmDialog from './ClearRuntimeConfirmDialog.vue'

// 工作台主区标题：
// 套图设计统计
// 单图测试统计
// 单图设计统计
// 套图生成统计
// 全局 API-Key 配置
// 用户主机信息

defineProps({
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
    required: true
  },
  submitButtonState: {
    type: String,
    required: true
  },
  longRunningHint: {
    type: String,
    default: ''
  },
  taskScaleSummary: {
    type: Object,
    default: null
  },
  modelPricingCatalog: {
    type: Array,
    required: true
  },
  rechargePricingCatalog: {
    type: Array,
    required: true
  },
  resultPayload: {
    type: Object,
    required: true
  },
  exportItems: {
    type: Array,
    required: true
  },
  selectedExportIds: {
    type: Array,
    required: true
  },
  latestTask: {
    type: Object,
    default: null
  },
  workspaceDashboard: {
    type: Object,
    required: true
  },
  hostInfo: {
    type: Object,
    required: true
  },
  isRefreshingTotalCredits: {
    type: Boolean,
    required: true
  },
  isRefreshingRemainingCredits: {
    type: Boolean,
    required: true
  },
  runtimeResetSequence: {
    type: Number,
    default: 0
  },
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
  allPromptTemplates: {
    type: Array,
    required: true
  },
  isClearRuntimeConfirmVisible: {
    type: Boolean,
    default: false
  },
  isClearingRuntimeState: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update-field',
  'update-upload-directory-draft',
  'save-upload-directory',
  'submit-task',
  'toggle-export-item',
  'batch-download',
  'select-single-image',
  'select-single-design-image',
  'select-series-design-images',
  'select-series-generate-image',
  'open-output-directory',
  'refresh-total-credits',
  'refresh-remaining-credits',
  'save-prompt-template',
  'remove-prompt-template',
  'save-negative-prompt-template',
  'remove-negative-prompt-template',
  'confirm-clear-runtime-state',
  'close-clear-runtime-confirm'
])
</script>

<template>
  <section
    :class="[
      'workspace-panels',
      {
        'workspace-panels--single': activeMenu === 'workspace' || activeMenu === 'model-pricing' || activeMenu === 'prompt-library',
        'workspace-panels--focus-display': activeMenu !== 'workspace' && activeMenu !== 'model-pricing' && activeMenu !== 'prompt-library'
      }
    ]"
  >
    <ClearRuntimeConfirmDialog
      :visible="isClearRuntimeConfirmVisible"
      :is-processing="isClearingRuntimeState"
      @confirm="emit('confirm-clear-runtime-state')"
      @close="emit('close-clear-runtime-confirm')"
    />

    <template v-if="activeMenu === 'workspace'">
      <section class="workspace-panel">
        <WorkspaceDashboard
          :workspace-dashboard="workspaceDashboard"
          :host-info="hostInfo"
          :is-refreshing-total-credits="isRefreshingTotalCredits"
          :is-refreshing-remaining-credits="isRefreshingRemainingCredits"
          @refresh-total-credits="emit('refresh-total-credits')"
          @refresh-remaining-credits="emit('refresh-remaining-credits')"
        />
      </section>
    </template>

    <template v-else-if="activeMenu === 'model-pricing'">
      <section class="workspace-panel">
        <ResultDisplayPanel
          :active-menu="activeMenu"
          :menu-label="menuLabel"
          :result-payload="resultPayload"
          :model-pricing-catalog="modelPricingCatalog"
          :recharge-pricing-catalog="rechargePricingCatalog"
          :latest-task="latestTask"
        />
      </section>
    </template>

    <template v-else-if="activeMenu === 'prompt-library'">
      <section class="workspace-panel">
        <PromptLibraryPanel
          :fixed-prompt-templates="fixedPromptTemplates"
          :custom-prompt-templates="customPromptTemplates"
          :fixed-negative-prompt-templates="fixedNegativePromptTemplates"
          :custom-negative-prompt-templates="customNegativePromptTemplates"
          @save-template="emit('save-prompt-template', $event)"
          @remove-template="emit('remove-prompt-template', $event)"
          @save-negative-template="emit('save-negative-prompt-template', $event)"
          @remove-negative-template="emit('remove-negative-prompt-template', $event)"
        />
      </section>
    </template>

    <template v-else>
      <section class="workspace-panel workspace-panel--bordered">
        <ParameterSettingsPanel
          :key="`${activeMenu}-${runtimeResetSequence}`"
          :active-menu="activeMenu"
          :menu-label="menuLabel"
          :draft-form="draftForm"
          :model-options="modelOptions"
          :batch-options="batchOptions"
          :ratio-options="ratioOptions"
          :upload-directory-drafts="uploadDirectoryDrafts"
          :submit-button-state="submitButtonState"
          :long-running-hint="longRunningHint"
          :task-scale-summary="taskScaleSummary"
          :prompt-templates="allPromptTemplates"
          :fixed-negative-prompt-templates="fixedNegativePromptTemplates"
          :custom-negative-prompt-templates="customNegativePromptTemplates"
          @update-field="emit('update-field', $event)"
          @update-upload-directory-draft="emit('update-upload-directory-draft', $event)"
          @save-upload-directory="emit('save-upload-directory', $event)"
          @submit-task="emit('submit-task')"
          @select-single-image="emit('select-single-image')"
          @select-single-design-image="emit('select-single-design-image')"
          @select-series-design-images="emit('select-series-design-images')"
          @select-series-generate-image="emit('select-series-generate-image')"
        />
      </section>

      <section class="workspace-panel workspace-panel--display">
        <ResultDisplayPanel
          :active-menu="activeMenu"
          :menu-label="menuLabel"
          :result-payload="resultPayload"
          :model-pricing-catalog="modelPricingCatalog"
          :recharge-pricing-catalog="rechargePricingCatalog"
          :latest-task="latestTask"
        />
      </section>
    </template>
  </section>
</template>
