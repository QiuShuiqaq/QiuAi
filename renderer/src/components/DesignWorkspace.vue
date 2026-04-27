<script setup>
import WorkspaceDashboard from './WorkspaceDashboard.vue'
import ParameterSettingsPanel from './ParameterSettingsPanel.vue'
import ResultDisplayPanel from './ResultDisplayPanel.vue'

// 工作台主区标题：
// 文案生成统计
// 套图设计统计
// 单图测试统计
// 单图设计
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
  submitButtonState: {
    type: String,
    required: true
  },
  modelPricingCatalog: {
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
  apiConfigState: {
    type: Object,
    required: true
  },
  isSavingApiConfig: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits([
  'update-field',
  'submit-task',
  'toggle-export-item',
  'batch-download',
  'select-copywriting-images',
  'clear-copywriting-images',
  'select-single-image',
  'select-single-design-image',
  'select-series-design-images',
  'select-series-generate-image',
  'open-output-directory',
  'update-api-key',
  'switch-api-key',
  'save-api-config'
])
</script>

<template>
  <section
    :class="[
      'workspace-panels',
      {
        'workspace-panels--single': activeMenu === 'workspace' || activeMenu === 'model-pricing',
        'workspace-panels--focus-display': activeMenu !== 'workspace' && activeMenu !== 'model-pricing'
      }
    ]"
  >
    <template v-if="activeMenu === 'workspace'">
      <section class="workspace-panel">
        <WorkspaceDashboard
          :workspace-dashboard="workspaceDashboard"
          :host-info="hostInfo"
          :api-config-state="apiConfigState"
          :is-saving-api-config="isSavingApiConfig"
          @update-api-key="emit('update-api-key', $event)"
          @switch-api-key="emit('switch-api-key', $event)"
          @save-api-config="emit('save-api-config')"
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
          :latest-task="latestTask"
        />
      </section>
    </template>

    <template v-else>
      <section class="workspace-panel workspace-panel--bordered">
        <ParameterSettingsPanel
          :active-menu="activeMenu"
          :menu-label="menuLabel"
          :draft-form="draftForm"
          :model-options="modelOptions"
          :batch-options="batchOptions"
          :ratio-options="ratioOptions"
          :submit-button-state="submitButtonState"
          @update-field="emit('update-field', $event)"
          @submit-task="emit('submit-task')"
          @select-copywriting-images="emit('select-copywriting-images')"
          @clear-copywriting-images="emit('clear-copywriting-images')"
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
          :latest-task="latestTask"
        />
      </section>
    </template>
  </section>
</template>
