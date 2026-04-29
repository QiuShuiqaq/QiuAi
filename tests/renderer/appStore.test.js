import { describe, expect, it } from 'vitest'

describe('appStore', () => {
  it('defaults to the domestic host and 1:1 size', async () => {
    const {
      createInitialState,
      setSettings,
      setCurrentTask
    } = await import('../../renderer/src/stores/appStore.js')

    const state = createInitialState()

    expect(state.settings.apiBaseUrl).toBe('https://grsai.dakka.com.cn')
    expect(state.settings.defaultSize).toBe('1:1')
    expect(state.settings.themeMode).toBe('dark')
    expect(state.generation.size).toBe('1:1')
    expect(state.generation.mode).toBe('single')
    expect(state.generation.styleSourceFolder).toBe('')
    expect(state.generation.detailSourceImage).toBe('')
    expect(Array.isArray(state.promptTemplates)).toBe(true)
    expect(Array.isArray(state.localTasks)).toBe(true)

    setSettings(state, {
      apiKey: 'sk-1',
      defaultSize: '16:9',
      themeMode: 'eye-care'
    })
    expect(state.settings.apiKey).toBe('sk-1')
    expect(state.settings.defaultSize).toBe('16:9')
    expect(state.settings.themeMode).toBe('dark')

    setCurrentTask(state, {
      id: 'task-1',
      status: 'running',
      progress: 30
    })
    expect(state.currentTask.id).toBe('task-1')
    expect(state.currentTask.progress).toBe(30)
  })
})
