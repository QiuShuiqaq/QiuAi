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
  writeFile = fsPromises.writeFile,
  persistDebounceMs = 120,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
} = {}) {
  let cachedTasks = readTaskListFromDisk(taskManagerFilePath, {
    readFileSync
  })
  let flushTimer = null
  let pendingWriteDeferred = null
  let pendingWritePromise = Promise.resolve()

  function createDeferred() {
    let resolve
    let reject
    const promise = new Promise((innerResolve, innerReject) => {
      resolve = innerResolve
      reject = innerReject
    })

    return {
      promise,
      resolve,
      reject
    }
  }

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

  function schedulePersist() {
    if (!pendingWriteDeferred) {
      pendingWriteDeferred = createDeferred()
      pendingWritePromise = pendingWriteDeferred.promise
    }

    if (flushTimer) {
      clearTimeoutFn(flushTimer)
      flushTimer = null
    }

    flushTimer = setTimeoutFn(async () => {
      const currentDeferred = pendingWriteDeferred
      flushTimer = null
      pendingWriteDeferred = null

      try {
        const normalizedTasks = await persistTasks(cachedTasks)
        currentDeferred?.resolve(normalizedTasks)
      } catch (error) {
        currentDeferred?.reject(error)
      }
    }, persistDebounceMs)

    return pendingWritePromise
  }

  async function flushPendingWrites() {
    if (!flushTimer && !pendingWriteDeferred) {
      return listTasks()
    }

    return pendingWritePromise
  }

  async function saveTask(task = {}) {
    cachedTasks = [
      task,
      ...cachedTasks.filter((item) => item.id !== task.id)
    ]
    void schedulePersist().catch(() => {})

    return task
  }

  return {
    taskManagerFilePath,
    listTasks,
    saveTask,
    flushPendingWrites
  }
}

module.exports = {
  createStudioTaskManagerService
}
