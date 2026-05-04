<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  apiKey: {
    type: String,
    default: ''
  },
  isSaving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update-api-key', 'save', 'close'])
</script>

<template>
  <div v-if="visible" class="admin-api-key-modal">
    <div class="admin-api-key-modal__card">
      <header class="admin-api-key-modal__header">
        <strong>管理员 API-Key 配置</strong>
      </header>

      <label class="form-field">
        <span>API-Key</span>
        <input
          :value="apiKey"
          class="admin-api-key-modal__input"
          type="text"
          placeholder="请输入 API-Key"
          @input="emit('update-api-key', $event.target.value)"
        />
      </label>

      <footer class="admin-api-key-modal__actions">
        <button class="secondary-action" type="button" @click="emit('close')">
          关闭
        </button>
        <button class="primary-action" type="button" :disabled="isSaving" @click="emit('save')">
          保存
        </button>
      </footer>
    </div>
  </div>
</template>
