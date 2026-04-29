<script setup>
import { computed } from 'vue'

const props = defineProps({
  activationState: {
    type: Object,
    required: true
  },
  isLoading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['copy-device-code', 'import-license', 'refresh-license'])

const statusLabel = computed(() => {
  if (props.isLoading) {
    return '校验中'
  }

  if (props.activationState.status === 'activated') {
    return '已激活'
  }

  if (props.activationState.status === 'mismatch') {
    return '设备不匹配'
  }

  if (props.activationState.status === 'invalid') {
    return '授权无效'
  }

  return '未激活'
})
</script>

<template>
  <section class="activation-gate">
    <div class="activation-gate__card">
      <div class="activation-gate__header">
        <span class="activation-gate__eyebrow">设备授权</span>
        <strong>QiuAi 激活</strong>
        <p>当前版本使用永久单机授权，请复制设备码并导入授权文件。</p>
      </div>

      <div class="activation-gate__status">
        <span class="activation-gate__status-label">状态</span>
        <span class="activation-gate__status-pill">{{ statusLabel }}</span>
      </div>

      <label class="activation-gate__field">
        <span>设备码</span>
        <textarea :value="activationState.deviceCode || ''" readonly rows="3" />
      </label>

      <p class="activation-gate__message">
        {{ activationState.message || (activationState.status === 'activated' ? '已激活' : '未检测到授权文件') }}
      </p>

      <div class="activation-gate__actions">
        <button type="button" class="primary-action" @click="emit('copy-device-code')">
          复制设备码
        </button>
        <button type="button" class="primary-action" @click="emit('import-license')">
          导入授权文件
        </button>
        <button type="button" class="secondary-action" @click="emit('refresh-license')">
          刷新校验
        </button>
      </div>
    </div>
  </section>
</template>
