<script setup>
defineProps({
  menuItems: {
    type: Array,
    required: true
  },
  activeMenu: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['menu-select'])

// 固定菜单 key 占位：
// 工作台
// 单图测试
// 单图设计
// 套图设计
// 套图生成
// 模型价格
// 提示词库
// key: 'workspace'
// key: 'single-image'
// key: 'single-design'
// key: 'series-design'
// key: 'series-generate'
// key: 'model-pricing'
// key: 'prompt-library'

function handleMenuClick(menuKey) {
  // 菜单点击事件预留：后续可在这里映射不同业务工作流。
  emit('menu-select', menuKey)
}
</script>

<template>
  <section class="sidebar-shell module-scroll">
    <button
      v-for="item in menuItems"
      :key="item.key"
      class="sidebar-menu-button"
      :class="{ 'sidebar-menu-button--active': item.key === activeMenu }"
      type="button"
      @click="handleMenuClick(item.key)"
    >
      <span class="sidebar-menu-button__label">{{ item.label }}</span>
    </button>
  </section>
</template>
