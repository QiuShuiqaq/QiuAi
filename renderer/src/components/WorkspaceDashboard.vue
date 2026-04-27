<script setup>
import { computed } from 'vue'

const props = defineProps({
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

const emit = defineEmits(['update-api-key', 'switch-api-key', 'save-api-config'])

// 固定工作台卡片标题：
// 套图设计统计
// 单图测试统计
// 单图设计统计
// 套图生成统计
// 固定统计项示例：
// 模型调用次数

const leftColumnCards = computed(() => {
  return [
    props.workspaceDashboard.singleImageStats,
    props.workspaceDashboard.seriesDesignStats
  ]
})

const middleColumnCards = computed(() => {
  return [
    props.workspaceDashboard.singleDesignStats,
    props.workspaceDashboard.seriesGenerateStats
  ]
})

const hostInfoItems = computed(() => {
  return [
    { label: '主机名', value: props.hostInfo.systemName },
    { label: '登录用户', value: props.hostInfo.userName },
    { label: '系统平台', value: props.hostInfo.platformName },
    { label: '系统架构', value: props.hostInfo.architecture },
    { label: 'CPU 信息', value: props.hostInfo.cpuModel },
    { label: '运行时', value: props.hostInfo.runtimeName }
  ]
})

function saveApiConfig() {
  // API-Key 保存事件预留：后续可在这里扩展更完整的校验提示。
  emit('save-api-config')
}

function updateApiKey(index, value) {
  // API-Key 输入事件预留：后续可在这里接入更细粒度的输入校验。
  emit('update-api-key', {
    index,
    value
  })
}

function switchApiKey(index) {
  // API-Key 切换事件预留：后续可在这里接入更细粒度的切换提醒。
  emit('switch-api-key', index)
}
</script>

<template>
  <section class="workspace-dashboard">
    <div class="workspace-dashboard__inner">
      <div class="dashboard-column dashboard-column--split">
        <article
          v-for="card in leftColumnCards"
          :key="card.title"
          class="dashboard-stat-card"
        >
          <header class="dashboard-card__header">
            <div>
              <h2>{{ card.title }}</h2>
            </div>
          </header>

          <div class="dashboard-card__content dashboard-card__content--stats">
            <div class="dashboard-stat-list">
              <div v-for="item in card.items" :key="`${card.title}-${item.label}`" class="dashboard-stat-row">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div class="dashboard-column dashboard-column--split dashboard-column--bordered">
        <article
          v-for="card in middleColumnCards"
          :key="card.title"
          class="dashboard-stat-card"
        >
          <header class="dashboard-card__header">
            <div>
              <h2>{{ card.title }}</h2>
            </div>
          </header>

          <div class="dashboard-card__content dashboard-card__content--stats">
            <div class="dashboard-stat-list">
              <div v-for="item in card.items" :key="`${card.title}-${item.label}`" class="dashboard-stat-row">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div class="dashboard-column dashboard-column--split">
        <article class="dashboard-config-card">
          <header class="dashboard-card__header">
            <div>
              <h2>全局 API-Key 配置</h2>
            </div>
          </header>

          <div class="dashboard-card__content">
            <div class="dashboard-api-config">
              <div class="dashboard-api-config__inputs">
                <label class="form-field">
                  <span>API-Key 1</span>
                  <input
                    :value="apiConfigState.apiKeys[0]"
                    type="password"
                    placeholder="请输入 API-Key 1"
                    @input="updateApiKey(0, $event.target.value)"
                  />
                </label>

                <label class="form-field">
                  <span>API-Key 2</span>
                  <input
                    :value="apiConfigState.apiKeys[1]"
                    type="password"
                    placeholder="请输入 API-Key 2"
                    @input="updateApiKey(1, $event.target.value)"
                  />
                </label>
              </div>

              <div class="dashboard-button-row">
                <button
                  :class="[
                    'secondary-action',
                    { 'secondary-action--active': apiConfigState.activeApiKeyIndex === 0 }
                  ]"
                  type="button"
                  @click="switchApiKey(0)"
                >
                  启用 Key 1
                </button>
                <button
                  :class="[
                    'secondary-action',
                    { 'secondary-action--active': apiConfigState.activeApiKeyIndex === 1 }
                  ]"
                  type="button"
                  @click="switchApiKey(1)"
                >
                  启用 Key 2
                </button>
              </div>
            </div>
          </div>

          <footer class="dashboard-card__footer">
            <button class="primary-action" type="button" :disabled="isSavingApiConfig" @click="saveApiConfig">
              {{ isSavingApiConfig ? '保存中...' : '保存配置' }}
            </button>
          </footer>
        </article>

        <article class="dashboard-config-card">
          <header class="dashboard-card__header">
            <div>
              <h2>用户主机信息</h2>
              <p class="section-copy">展示当前桌面端实际运行环境。</p>
            </div>
          </header>

          <div class="dashboard-card__content">
            <div class="dashboard-info-list">
              <div v-for="item in hostInfoItems" :key="item.label" class="dashboard-info-row">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
