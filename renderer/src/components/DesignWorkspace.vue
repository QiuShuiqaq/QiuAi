<script setup>
import WorkspaceDashboard from './WorkspaceDashboard.vue'
import ParameterSettingsPanel from './ParameterSettingsPanel.vue'
import ResultDisplayPanel from './ResultDisplayPanel.vue'
import PromptLibraryPanel from './PromptLibraryPanel.vue'

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
  submitButtonState: {
    type: String,
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
  },
  fixedPromptTemplates: {
    type: Array,
    required: true
  },
  customPromptTemplates: {
    type: Array,
    required: true
  }
})

const emit = defineEmits([
  'update-field',
  'submit-task',
  'toggle-export-item',
  'batch-download',
  'select-single-image',
  'select-single-design-image',
  'select-series-design-images',
  'select-series-generate-image',
  'open-output-directory',
  'update-api-key',
  'switch-api-key',
  'save-api-config',
  'save-prompt-template',
  'remove-prompt-template'
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
          @save-template="emit('save-prompt-template', $event)"
          @remove-template="emit('remove-prompt-template', $event)"
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
          :custom-prompt-templates="customPromptTemplates"
          @update-field="emit('update-field', $event)"
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
