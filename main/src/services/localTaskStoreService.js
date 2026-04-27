const crypto = require('node:crypto')

const TASKS_KEY = 'localTasks'

function summarizeTask (task = {}) {
  const items = Array.isArray(task.items) ? task.items : []
  const completedCount = items.filter((item) => ['succeeded', 'failed'].includes(item.status)).length
  const succeededCount = items.filter((item) => item.status === 'succeeded').length
  const failedCount = items.filter((item) => item.status === 'failed').length

  let status = task.status || (items.length ? 'running' : 'draft')

  if (!items.length || completedCount === 0) {
    status = task.status || 'draft'
  } else if (succeededCount === items.length) {
    status = 'succeeded'
  } else if (failedCount === items.length) {
    status = 'failed'
  } else if (completedCount === items.length && succeededCount > 0 && failedCount > 0) {
    status = 'partial'
  }

  return {
    ...task,
    status,
    progress: items.length ? Math.round((completedCount / items.length) * 100) : 0
  }
}

function createLocalTaskStoreService ({ store, createId = () => crypto.randomUUID() }) {
  function listTasks () {
    const tasks = store.get(TASKS_KEY, [])
    return Array.isArray(tasks) ? tasks.map((task) => summarizeTask(task)) : []
  }

  function persistTasks (tasks) {
    store.set(TASKS_KEY, tasks)
  }

  function getTask (id) {
    return listTasks().find((task) => task.id === id) || null
  }

  async function createTask (payload = {}) {
    const task = summarizeTask({
      id: payload.id || createId(),
      mode: payload.mode || 'single',
      featureKey: payload.featureKey || '',
      name: payload.name || '',
      createdAt: payload.createdAt || new Date().toISOString(),
      size: payload.size || '1:1',
      prompt: payload.prompt || '',
      templateId: payload.templateId || '',
      sourcePaths: payload.sourcePaths || [],
      inputDirectory: payload.inputDirectory || '',
      outputDirectory: payload.outputDirectory || '',
      items: payload.items || []
    })
    const nextTasks = [task, ...listTasks()]
    persistTasks(nextTasks)
    return task
  }

  async function saveTask (payload = {}) {
    const task = summarizeTask(payload)
    const nextTasks = [task, ...listTasks().filter((item) => item.id !== task.id)]
    persistTasks(nextTasks)
    return task
  }

  async function updateTask (id, patch = {}) {
    const currentTask = getTask(id)
    if (!currentTask) {
      return null
    }
    return saveTask({
      ...currentTask,
      ...patch
    })
  }

  async function updateTaskItem (taskId, itemId, patch = {}) {
    const currentTask = getTask(taskId)
    if (!currentTask) {
      return null
    }
    return saveTask({
      ...currentTask,
      items: currentTask.items.map((item) => {
        if (item.id !== itemId) {
          return item
        }
        return {
          ...item,
          ...patch
        }
      })
    })
  }

  return {
    listTasks,
    getTask,
    createTask,
    saveTask,
    updateTask,
    updateTaskItem
  }
}

module.exports = {
  TASKS_KEY,
  summarizeTask,
  createLocalTaskStoreService
}
