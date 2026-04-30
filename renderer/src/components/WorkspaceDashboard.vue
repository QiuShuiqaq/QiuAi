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
  creditAdjustmentValue: {
    type: String,
    required: true
  },
  totalCreditsValue: {
    type: String,
    required: true
  },
  isSavingApiConfig: {
    type: Boolean,
    required: true
  },
  isApplyingCreditAdjustment: {
    type: Boolean,
    required: true
  },
  isSavingTotalCredits: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits([
  'update-api-key',
  'switch-api-key',
  'save-api-config',
  'update-credit-adjustment',
  'apply-credit-adjustment',
  'update-total-credits',
  'save-total-credits'
])

// 固定工作台卡片标题：
// 单图测试统计
// 单图设计统计
// 套图设计统计
// 套图生成统计
// 固定统计项示例：
// 模型调用次数

function createFallbackStatsCard(title) {
  return {
    title,
    items: []
  }
}

const topStatisticsCards = computed(() => {
  return [
    props.workspaceDashboard.singleImageStats || createFallbackStatsCard('单图测试统计'),
    props.workspaceDashboard.singleDesignStats || createFallbackStatsCard('单图设计统计')
  ]
})

const middleStatisticsCards = computed(() => {
  return [
    props.workspaceDashboard.seriesDesignStats || createFallbackStatsCard('套图设计统计'),
    props.workspaceDashboard.seriesGenerateStats || createFallbackStatsCard('套图生成统计')
  ]
})

const networkMonitorCard = computed(() => {
  return props.workspaceDashboard.networkMonitor || {
    title: '网络监控',
    items: [],
    summary: {
      latestLatencyMs: 0,
      averageLatencyMs: 0,
      successRate: '0%'
    }
  }
})

const networkMonitorSummaryItems = computed(() => {
  const summary = networkMonitorCard.value.summary || {}
  return [
    {
      label: '最近请求延迟',
      value: `${summary.latestLatencyMs || 0} ms`
    },
    {
      label: '平均延迟',
      value: `${summary.averageLatencyMs || 0} ms`
    },
    {
      label: '成功率',
      value: summary.successRate || '0%'
    }
  ]
})

const networkMonitorChartItems = computed(() => {
  return [...(networkMonitorCard.value.items || [])].slice(0, 12).reverse()
})

const networkMonitorListItems = computed(() => {
  return (networkMonitorCard.value.items || []).slice(0, 6)
})

const networkMonitorPoints = computed(() => {
  const items = networkMonitorChartItems.value
  if (!items.length) {
    return ''
  }

  const maxLatency = Math.max(...items.map((item) => Number(item.elapsedMs) || 0), 1)
  const chartWidth = 360
  const chartHeight = 118
  const bottomPadding = 18
  const usableHeight = chartHeight - bottomPadding

  return items.map((item, index) => {
    const x = items.length === 1
      ? chartWidth / 2
      : Math.round((chartWidth / (items.length - 1)) * index)
    const y = Math.round(chartHeight - ((Math.max(0, Number(item.elapsedMs) || 0) / maxLatency) * usableHeight) - bottomPadding)
    return `${x},${y}`
  }).join(' ')
})

const creditOverviewCard = computed(() => {
  return props.workspaceDashboard.creditOverview || {
    title: '积分仪表盘',
    items: [
      { label: '剩余积分', value: '0' },
      { label: '累计充值积分', value: '0' }
    ]
  }
})

function resolveCreditOverviewValue(labels) {
  const normalizedLabels = Array.isArray(labels) ? labels : [labels]
  return computed(() => {
    const matchedItem = (creditOverviewCard.value.items || []).find((item) => normalizedLabels.includes(item.label))
    return matchedItem?.value || '0'
  })
}

const remainingCredits = resolveCreditOverviewValue('剩余积分')
const totalCredits = resolveCreditOverviewValue(['总积分', '累计充值积分'])

const creditGaugeProgress = computed(() => {
  const currentValue = Number.parseInt(String(remainingCredits.value).replace(/[^\d]/g, ''), 10) || 0
  const maxValue = Number.parseInt(String(totalCredits.value).replace(/[^\d]/g, ''), 10) || currentValue || 1
  return Math.max(0, Math.min(100, Math.round((currentValue / maxValue) * 100)))
})

const creditGaugeGlow = computed(() => {
  const numericProgress = Number(creditGaugeProgress.value) || 0
  return Math.max(0.2, Math.min(0.95, numericProgress / 100))
})

const creditMessagesCard = computed(() => {
  return props.workspaceDashboard.creditMessages || {
    title: '积分消息记录',
    items: []
  }
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

function updateCreditAdjustmentValue(value) {
  // 积分调整输入事件预留：后续可在这里扩展输入格式校验。
  emit('update-credit-adjustment', value)
}

function applyCreditAdjustment(operation) {
  // 积分增减事件预留：后续可在这里接入更细粒度的业务确认。
  emit('apply-credit-adjustment', operation)
}

function updateTotalCreditsValue(value) {
  // 总积分输入事件预留：后续可在这里扩展输入格式校验。
  emit('update-total-credits', value)
}

function saveTotalCredits() {
  // 总积分保存事件预留：后续可在这里接入更细粒度的业务确认。
  emit('save-total-credits')
}
</script>

<template>
  <section class="workspace-dashboard">
    <div class="workspace-dashboard__inner">
      <div class="dashboard-column dashboard-column--stats-stack">
        <div class="dashboard-column__stack">
          <article
            v-for="card in topStatisticsCards"
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

        <div class="dashboard-column__stack">
          <article
            v-for="card in middleStatisticsCards"
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

        <article class="dashboard-stat-card dashboard-network-monitor">
          <header class="dashboard-card__header">
            <div>
              <h2>{{ networkMonitorCard.title }}</h2>
            </div>
          </header>

          <div class="dashboard-card__content dashboard-card__content--network">
            <div class="dashboard-network-monitor__chart">
              <svg viewBox="0 0 360 140" aria-hidden="true">
                <defs>
                  <linearGradient id="networkMonitorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#22d3ee" />
                    <stop offset="50%" stop-color="#7c3aed" />
                    <stop offset="100%" stop-color="#38d9ff" />
                  </linearGradient>
                </defs>

                <path
                  class="dashboard-network-monitor__track"
                  d="M 0 122 L 360 122"
                />
                <polyline
                  v-if="networkMonitorPoints"
                  class="dashboard-network-monitor__polyline"
                  :points="networkMonitorPoints"
                />
              </svg>
            </div>

            <div class="dashboard-network-monitor__metrics">
              <div
                v-for="item in networkMonitorSummaryItems"
                :key="item.label"
                class="dashboard-network-monitor__metric"
              >
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>

            <div v-if="networkMonitorListItems.length" class="dashboard-network-monitor__list">
              <div
                v-for="item in networkMonitorListItems"
                :key="item.id || `${item.requestPath}-${item.createdAt}`"
                class="dashboard-network-monitor__row"
              >
                <div class="dashboard-network-monitor__copy">
                  <strong>{{ item.method }} {{ item.requestPath }}</strong>
                  <span>{{ item.timeLabel || item.createdAt || '--' }}</span>
                </div>

                <strong :class="['dashboard-network-monitor__status', `dashboard-network-monitor__status--${item.status}`]">
                  {{ item.elapsedMs }} ms
                </strong>
              </div>
            </div>

            <div v-else class="task-sidebar-empty">
              <p>暂无请求记录</p>
            </div>
          </div>
        </article>
      </div>

      <div class="dashboard-column dashboard-column--credit">
        <article class="dashboard-stat-card">
          <header class="dashboard-card__header">
            <div>
              <h2>{{ creditOverviewCard.title }}</h2>
            </div>
          </header>

          <div class="dashboard-card__content dashboard-card__content--credit-gauge">
            <div class="dashboard-credit-gauge">
              <div class="dashboard-credit-gauge__dial">
                <svg class="dashboard-credit-gauge__svg" viewBox="0 0 320 220" aria-hidden="true">
                  <defs>
                    <linearGradient id="creditGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#ff5f6d" />
                      <stop offset="50%" stop-color="#4ade80" />
                      <stop offset="100%" stop-color="#38d9ff" />
                    </linearGradient>
                    <radialGradient id="creditGaugeCoreGlow" cx="50%" cy="68%" r="70%">
                      <stop offset="0%" stop-color="rgba(223, 193, 255, 0.26)" />
                      <stop offset="55%" stop-color="rgba(137, 97, 255, 0.1)" />
                      <stop offset="100%" stop-color="rgba(137, 97, 255, 0)" />
                    </radialGradient>
                  </defs>

                  <path
                    class="dashboard-credit-gauge__halo"
                    d="M 24 168 A 136 136 0 0 1 296 168"
                    pathLength="100"
                  />
                  <path
                    class="dashboard-credit-gauge__track"
                    d="M 24 168 A 136 136 0 0 1 296 168"
                    pathLength="100"
                  />
                  <path
                    class="dashboard-credit-gauge__arc dashboard-credit-gauge__arc--active dashboard-credit-gauge__progress-band"
                    d="M 24 168 A 136 136 0 0 1 296 168"
                    pathLength="100"
                    :style="{
                      strokeDasharray: `${creditGaugeProgress} 100`,
                      strokeDashoffset: `${100 - creditGaugeProgress}`,
                      opacity: creditGaugeGlow
                    }"
                  />

                  <circle class="dashboard-credit-gauge__core-glow" cx="160" cy="168" r="76" />
                </svg>

                <div class="dashboard-credit-gauge__center">
                  <span class="dashboard-credit-gauge__caption">剩余积分</span>
                  <strong class="dashboard-credit-gauge__value">{{ remainingCredits }} / {{ totalCredits }}</strong>
                </div>
              </div>
            </div>
          </div>

          <footer class="dashboard-card__footer dashboard-card__footer--compact">
            <div class="dashboard-credit-adjust">
              <div class="dashboard-credit-adjust__grid">
                <label class="form-field">
                  <span>总积分</span>
                  <input
                    :value="totalCreditsValue"
                    type="number"
                    min="0"
                    placeholder="输入总积分"
                    @input="updateTotalCreditsValue($event.target.value)"
                  />
                </label>

                <label class="form-field">
                  <span>调整积分</span>
                  <input
                    :value="creditAdjustmentValue"
                    type="number"
                    min="1"
                    placeholder="输入要调整的积分"
                    @input="updateCreditAdjustmentValue($event.target.value)"
                  />
                </label>
              </div>

              <div class="dashboard-credit-adjust__actions">
                <button
                  class="secondary-action secondary-action--compact"
                  type="button"
                  :disabled="isSavingTotalCredits"
                  @click="saveTotalCredits"
                >
                  {{ isSavingTotalCredits ? '保存中' : '保存' }}
                </button>

                <button
                  class="secondary-action secondary-action--compact"
                  type="button"
                  :disabled="isApplyingCreditAdjustment"
                  @click="applyCreditAdjustment('increase')"
                >
                  {{ isApplyingCreditAdjustment ? '处理中...' : '增加积分' }}
                </button>
                <button
                  class="secondary-action secondary-action--compact"
                  type="button"
                  :disabled="isApplyingCreditAdjustment"
                  @click="applyCreditAdjustment('decrease')"
                >
                  {{ isApplyingCreditAdjustment ? '处理中...' : '扣减积分' }}
                </button>
              </div>
            </div>
          </footer>
        </article>

        <article class="dashboard-config-card">
          <header class="dashboard-card__header">
            <div>
              <h2>{{ creditMessagesCard.title }}</h2>
            </div>
          </header>

          <div class="dashboard-card__content">
            <div v-if="creditMessagesCard.items.length" class="dashboard-credit-message-list scrollbar-hidden">
              <div
                v-for="item in creditMessagesCard.items"
                :key="item.id || `${item.type}-${item.createdAt}`"
                class="dashboard-credit-message-row"
              >
                <div class="dashboard-credit-message-copy">
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.description }}</span>
                </div>

                <div class="dashboard-credit-message-meta">
                  <strong>{{ item.amountDisplay }}</strong>
                  <span>{{ item.createdAt || '--' }}</span>
                </div>
              </div>
            </div>

            <div v-else class="task-sidebar-empty">
              <p>暂无积分变动记录</p>
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
