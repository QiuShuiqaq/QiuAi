const fs = require('node:fs')
const fsPromises = require('node:fs/promises')
const path = require('node:path')
const { TASK_MANAGER_FILE_PATH, ensureDirectory } = require('./dataPathsService')

function sortTasks(tasks = []) {
  return [...tasks].sort((left, right) => {
    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
  })
}

function readTaskListFromDisk(taskManagerFilePath, { readFileSync = fs.readFileSync } = {}) {
  try {
    const payload = readFileSync(taskManagerFilePath, 'utf8')
    const parsedPayload = JSON.parse(payload)
    return Array.isArray(parsedPayload) ? sortTasks(parsedPayload) : []
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return []
    }

    return []
  }
}

function createStudioTaskManagerService({
  taskManagerFilePath = TASK_MANAGER_FILE_PATH,
  ensureDirectory: ensureDirectoryDependency = ensureDirectory,
  readFileSync = fs.readFileSync,
  writeFile = fsPromises.writeFile
} = {}) {
  let cachedTasks = readTaskListFromDisk(taskManagerFilePath, {
    readFileSync
  })

  function listTasks() {
    return sortTasks(cachedTasks)
  }

  async function persistTasks(tasks = []) {
    const normalizedTasks = sortTasks(tasks)
    cachedTasks = normalizedTasks
    await ensureDirectoryDependency(path.dirname(taskManagerFilePath))
    await writeFile(taskManagerFilePath, `${JSON.stringify(normalizedTasks, null, 2)}\n`, 'utf8')
    return normalizedTasks
  }

  async function saveTask(task = {}) {
    const nextTasks = [
      task,
      ...cachedTasks.filter((item) => item.id !== task.id)
    ]

    await persistTasks(nextTasks)
    return task
  }

  return {
    taskManagerFilePath,
    listTasks,
    saveTask
  }
}

module.exports = {
  createStudioTaskManagerService
}
