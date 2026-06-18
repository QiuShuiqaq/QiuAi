<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  brandLabel: {
    type: String,
    required: true
  },
  themeOptions: {
    type: Array,
    required: true
  },
  activeTheme: {
    type: String,
    required: true
  },
  activationSummary: {
    type: Object,
    default: null
  },
  seriesGroupConcurrency: {
    type: Number,
    default: 2
  }
})

const emit = defineEmits(['brand-click', 'theme-change', 'cleanup-click', 'series-group-concurrency-change'])

const wechatIconUrl = new URL('../../../icon/weixin.png', import.meta.url).href
const enterpriseWechatIconUrl = new URL('../../../icon/qiyeweixin.png', import.meta.url).href

const contactGroups = [
  {
    key: 'wechat',
    label: '微信',
    iconUrl: wechatIconUrl,
    description: '点击图片可查看你的微信联系方式入口',
    images: [
      {
        name: 'Dockerfans',
        url: new URL('../../../icon/Dockerfans.jpg', import.meta.url).href
      }
    ]
  },
  {
    key: 'enterprise-wechat',
    label: '企业微信',
    iconUrl: enterpriseWechatIconUrl,
    description: '点击图片可查看你的企业微信联系方式入口',
    images: [
      {
        name: 'Qiyeweixin',
        url: new URL('../../../icon/Qiyeweixin.jpg', import.meta.url).href
      }
    ]
  }
]

const seriesConcurrencyOptions = [2, 3, 4]
const activeContactKey = ref('')

const activeContactGroup = computed(() => {
  return contactGroups.find((item) => item.key === activeContactKey.value) || null
})

function onBrandClick() {
  // Logo 点击事件预留：顶部品牌位后续可接入返回首页或重置工作区逻辑。
  emit('brand-click')
}

function onThemeChange(event) {
  // 主题切换事件预留：后续可接入主题持久化或更多主题方案。
  emit('theme-change', event.target.value)
}

function onCleanupClick() {
  // 一键清理按钮点击事件预留：后续可接入本地缓存、草稿和日志清理逻辑。
  emit('cleanup-click')
}

function openContactPreview(contactKey) {
  // 微信 / 企业微信图片预览切换：点击后展示对应联系图片。
  activeContactKey.value = contactKey
}

function closeContactPreview() {
  activeContactKey.value = ''
}

function handleSeriesGroupConcurrencyChange(nextValue) {
  if (![2, 3, 4].includes(nextValue) || nextValue === props.seriesGroupConcurrency) {
    return
  }

  emit('series-group-concurrency-change', nextValue)
}
</script>

<template>
  <header class="topbar-shell">
    <button class="brand-button" type="button" @click="onBrandClick">
      <span class="brand-mark">秋</span>
      <span class="brand-copy">{{ brandLabel }}</span>
    </button>

    <div class="topbar-center-actions">
      <label v-if="themeOptions.length > 1" class="topbar-theme">
        <span>主题</span>
        <select :value="activeTheme" @change="onThemeChange">
          <option v-for="option in themeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <div class="topbar-concurrency">
        <span class="topbar-concurrency__label">套图并发</span>
        <div class="topbar-concurrency__group">
          <button
            v-for="option in seriesConcurrencyOptions"
            :key="option"
            type="button"
            class="topbar-concurrency__option"
            :class="{ 'topbar-concurrency__option--active': option === seriesGroupConcurrency }"
            @click="handleSeriesGroupConcurrencyChange(option)"
          >
            {{ option }}
          </button>
        </div>
      </div>
    </div>

    <div class="topbar-right-actions">
      <div v-if="activationSummary" class="topbar-activation-pill">
        <span>已激活</span>
        <strong>{{ activationSummary.customerName || '已授权设备' }}</strong>
      </div>

      <button class="topbar-clean-button" type="button" aria-label="一键清理" @click="onCleanupClick">
        一键清理
      </button>

      <div class="topbar-contact-actions">
        <button
          v-for="contact in contactGroups"
          :key="contact.key"
          class="topbar-contact-button"
          type="button"
          :aria-label="contact.label"
          :title="contact.label"
          @click="openContactPreview(contact.key)"
        >
          <img :src="contact.iconUrl" alt="" />
          <span>{{ contact.label }}</span>
        </button>
      </div>
    </div>
  </header>

  <div
    v-if="activeContactGroup"
    class="contact-preview-modal"
    role="dialog"
    aria-modal="true"
    :aria-label="`${activeContactGroup.label}预览`"
    @click.self="closeContactPreview"
  >
    <div class="contact-preview-modal__card">
      <header class="contact-preview-modal__header">
        <div>
          <strong>{{ activeContactGroup.label }}</strong>
          <span>{{ activeContactGroup.description }}</span>
        </div>

        <button class="secondary-action" type="button" @click="closeContactPreview">
          关闭
        </button>
      </header>

      <div class="contact-preview-modal__image-grid">
        <a
          v-for="image in activeContactGroup.images"
          :key="image.name"
          class="contact-preview-modal__image-card"
          :href="image.url"
          target="_blank"
          rel="noreferrer"
        >
          <img :src="image.url" :alt="image.name" />
          <span>{{ image.name }}</span>
        </a>
      </div>
    </div>
  </div>
</template>
