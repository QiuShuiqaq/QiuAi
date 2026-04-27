<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  templates: {
    type: Array,
    required: true
  },
  saveHandler: {
    type: Function,
    required: true
  },
  removeHandler: {
    type: Function,
    required: true
  }
})

const draft = reactive({
  id: '',
  name: '',
  category: '',
  prompt: ''
})

watch(() => props.templates, (templates) => {
  if (!draft.id && templates.length) {
    Object.assign(draft, templates[0])
  }
}, {
  immediate: true
})

function applyTemplate (template) {
  Object.assign(draft, {
    id: template.id,
    name: template.name,
    category: template.category,
    prompt: template.prompt
  })
}

function resetDraft () {
  Object.assign(draft, {
    id: '',
    name: '',
    category: '',
    prompt: ''
  })
}

async function saveTemplate () {
  await props.saveHandler({
    id: draft.id || undefined,
    name: draft.name,
    category: draft.category,
    prompt: draft.prompt
  })
  resetDraft()
}

async function removeTemplate () {
  if (!draft.id) {
    return
  }
  await props.removeHandler(draft.id)
  resetDraft()
}
</script>

<template>
  <section class="panel-card template-manager-card panel-scroll">
    <div class="task-head">
      <h3>提示词模板</h3>
      <button class="action-button action-button--ghost" type="button" @click="resetDraft">新建模板</button>
    </div>

    <div class="template-list">
      <button
        v-for="template in templates"
        :key="template.id"
        class="template-chip"
        type="button"
        @click="applyTemplate(template)"
      >
        {{ template.name }}
      </button>
    </div>

    <label class="field-card">
      <span>模板名称</span>
      <input v-model="draft.name" type="text" />
    </label>

    <label class="field-card">
      <span>分类</span>
      <input v-model="draft.category" type="text" />
    </label>

    <label class="field-card">
      <span>提示词</span>
      <textarea v-model="draft.prompt" rows="4"></textarea>
    </label>

    <div class="inline-actions">
      <button class="action-button" type="button" @click="saveTemplate">保存模板</button>
      <button class="action-button action-button--ghost" type="button" @click="removeTemplate">删除模板</button>
    </div>
  </section>
</template>
