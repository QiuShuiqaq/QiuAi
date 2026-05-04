<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    default: ''
  },
  isSubmitting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update-password', 'confirm', 'close'])
</script>

<template>
  <div v-if="visible" class="admin-password-modal">
    <div class="admin-password-modal__card">
      <header class="admin-password-modal__header">
        <strong>管理员验证</strong>
        <span>请输入管理员密码</span>
      </header>

      <input
        :value="password"
        class="admin-password-modal__input"
        type="password"
        placeholder="请输入管理员密码"
        @input="emit('update-password', $event.target.value)"
      />

      <footer class="admin-password-modal__actions">
        <button class="secondary-action" type="button" @click="emit('close')">
          取消
        </button>
        <button class="primary-action" type="button" :disabled="isSubmitting" @click="emit('confirm')">
          确认
        </button>
      </footer>
    </div>
  </div>
</template>
