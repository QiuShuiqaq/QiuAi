import { reactive } from 'vue'

export const defaultHost = 'https://grsai.dakka.com.cn'

export function createInitialState () {
  return {
    currentPage: 'generation',
    settings: {
      apiBaseUrl: defaultHost,
      apiKey: '',
      defaultSize: '1:1',
      downloadDirectory: '',
      themeMode: 'dark'
    },
    generation: {
      mode: 'single',
      prompt: '',
      size: '1:1',
      templateId: '',
      styleSourceFolder: '',
      styleSourceFiles: [],
      detailSourceImage: '',
      isSubmitting: false
    },
    promptTemplates: [],
    localTasks: [],
    selectedTaskId: '',
    currentTask: {
      id: '',
      status: 'idle',
      progress: 0,
      failureReason: '',
      error: '',
      results: [],
      items: [],
      outputDirectory: '',
      mode: 'single'
    }
  }
}

export const appStore = reactive(createInitialState())

function normalizeThemeMode () {
  return 'dark'
}

export function setSettings (state, payload = {}) {
  state.settings = {
    ...state.settings,
    ...payload,
    themeMode: normalizeThemeMode(payload.themeMode || state.settings.themeMode)
  }

  if (!state.generation.size || state.generation.size === '1:1') {
    state.generation.size = state.settings.defaultSize
  }
}

export function setCurrentTask (state, payload = {}) {
  state.currentTask = {
    ...state.currentTask,
    ...payload
  }
}

export function setPromptTemplates (state, templates = []) {
  state.promptTemplates = Array.isArray(templates) ? templates : []
}

export function setLocalTasks (state, tasks = []) {
  state.localTasks = Array.isArray(tasks) ? tasks : []
}

export function setSelectedTaskId (state, taskId = '') {
  state.selectedTaskId = taskId
}
