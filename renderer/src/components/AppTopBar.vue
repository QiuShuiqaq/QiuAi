<script setup>
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
  }
})

const emit = defineEmits(['brand-click', 'theme-change', 'wechat-click'])

function onBrandClick() {
  // Logo 点击事件预留：顶部品牌位后续可接入返回或首页导航。
  emit('brand-click')
}

function onThemeChange(event) {
  // 主题切换事件预留：后续可接入三主题全局持久化。
  emit('theme-change', event.target.value)
}

function onWechatClick() {
  // 微信按钮点击事件预留：后续可接入帮助、客服或社群入口。
  emit('wechat-click')
}
</script>

<template>
  <header class="topbar-shell">
    <button class="brand-button" type="button" @click="onBrandClick">
      <span class="brand-mark">秋</span>
      <span class="brand-copy">{{ brandLabel }}</span>
    </button>

    <label class="topbar-theme">
      <span>主题</span>
      <select :value="activeTheme" @change="onThemeChange">
        <option v-for="option in themeOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <button class="wechat-button" type="button" aria-label="微信入口" @click="onWechatClick">
      <span class="wechat-button__icon">微</span>
    </button>
  </header>
</template>
