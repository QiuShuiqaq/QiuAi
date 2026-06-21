<script setup>
import { computed, ref } from 'vue'

defineProps({
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
  }
})

const emit = defineEmits(['brand-click', 'theme-change', 'cleanup-click'])

const wechatIconUrl = new URL('../../../icon/weixin.png', import.meta.url).href
const enterpriseWechatIconUrl = new URL('../../../icon/qiyeweixin.png', import.meta.url).href

const contactGroups = [
  {
    key: 'wechat',
    label: '微信',
    iconUrl: wechatIconUrl,
    description: '点击图片查看微信联系方式入口',
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
    description: '点击图片查看企业微信联系方式入口',
    images: [
      {
        name: 'Qiyeweixin',
        url: new URL('../../../icon/Qiyeweixin.jpg', import.meta.url).href
      }
    ]
  }
]

const activeContactKey = ref('')

const activeContactGroup = computed(() => {
  return contactGroups.find((item) => item.key === activeContactKey.value) || null
})

function onBrandClick() {
  emit('brand-click')
}

function onThemeChange(event) {
  emit('theme-change', event.target.value)
}

function onCleanupClick() {
  emit('cleanup-click')
}

function openContactPreview(contactKey) {
  activeContactKey.value = contactKey
}

function closeContactPreview() {
  activeContactKey.value = ''
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
          <span class="topbar-concurrency__option topbar-concurrency__option--active">4</span>
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
