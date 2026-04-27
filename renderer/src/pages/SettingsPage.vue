<script setup>
import { appStore } from '../stores/appStore'

defineProps({
  saveHandler: {
    type: Function,
    required: true
  }
})

function useDomesticNode () {
  appStore.settings.apiBaseUrl = 'https://grsai.dakka.com.cn'
}

function clearApiKey () {
  appStore.settings.apiKey = ''
}
</script>

<template>
  <section class="panel-card settings-panel panel-scroll">
    <div class="panel-head">
      <div>
        <p class="panel-kicker">Settings</p>
        <h2>连接设置</h2>
      </div>
      <div class="inline-actions">
        <button class="action-button action-button--ghost" type="button" @click="useDomesticNode">使用国内节点</button>
        <button class="action-button action-button--ghost" type="button" @click="clearApiKey">清空 Key</button>
        <button class="action-button" type="button" @click="saveHandler">保存设置</button>
      </div>
    </div>
    <label class="field-card">
      <span>API Host</span>
      <input v-model="appStore.settings.apiBaseUrl" type="text" />
    </label>
    <label class="field-card">
      <span>API Key</span>
      <input v-model="appStore.settings.apiKey" type="password" />
    </label>
    <label class="field-card">
      <span>界面主题</span>
      <select v-model="appStore.settings.themeMode">
        <option value="dark">夜间科技</option>
        <option value="light">明亮护眼</option>
      </select>
    </label>
    <label class="field-card">
      <span>默认比例</span>
      <select v-model="appStore.settings.defaultSize">
        <option value="1:1">1:1</option>
        <option value="16:9">16:9</option>
        <option value="9:16">9:16</option>
        <option value="4:3">4:3</option>
        <option value="3:4">3:4</option>
      </select>
    </label>
    <p class="settings-note">生成成功后，图片会自动保存到项目目录下的 output 文件夹。</p>
  </section>
</template>
