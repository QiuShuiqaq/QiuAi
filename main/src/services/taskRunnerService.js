const { createDrawTask } = require('./drawTaskService')
const { getCompletedDrawResult } = require('./completedDrawResultService')
const { toDataUrl, getMimeTypeFromPath } = require('./localInputAssetService')

function sleep (durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

async function safeRuntimeLog (runtimeLogger, payload) {
  if (!runtimeLogger || typeof runtimeLogger.log !== 'function') {
    return
  }

  try {
    await runtimeLogger.log(payload)
  } catch {
    // 日志记录失败不应中断任务执行。
  }
}

function createTaskRunnerService ({
  createDrawTask: createDrawTaskDependency = createDrawTask,
  getCompletedDrawResult: getCompletedDrawResultDependency = getCompletedDrawResult,
  toDataUrl: toDataUrlDependency = toDataUrl,
  getMimeTypeFromPath: getMimeTypeFromPathDependency = getMimeTypeFromPath,
  localTaskStoreService,
  runtimeLogger,
  wait = sleep
}) {
  async function runTask (task, { httpClient }) {
    await localTaskStoreService.updateTask(task.id, {
      status: 'running'
    })
    await safeRuntimeLog(runtimeLogger, {
      level: 'info',
      event: 'task-run-start',
      taskId: task.id,
      mode: task.mode,
      outputDirectory: task.outputDirectory
    })

    for (const item of task.items || []) {
      try {
        await localTaskStoreService.updateTaskItem(task.id, item.id, {
          status: 'submitting',
          progress: 0,
          failureReason: '',
          error: ''
        })
        await safeRuntimeLog(runtimeLogger, {
          level: 'info',
          event: 'task-item-submitting',
          taskId: task.id,
          itemId: item.id,
          itemLabel: item.label || ''
        })

        const urls = item.sourcePath
          ? [await toDataUrlDependency({
              filePath: item.sourcePath,
              mimeType: getMimeTypeFromPathDependency(item.sourcePath)
            })]
          : []

        const remoteTask = await createDrawTaskDependency({
          model: item.model || task.model || 'gpt-image-2',
          prompt: item.prompt || task.prompt,
          aspectRatio: task.size,
          urls
        }, {
          httpClient
        })

        await localTaskStoreService.updateTaskItem(task.id, item.id, {
          remoteTaskId: remoteTask.id,
          status: 'running'
        })
        await safeRuntimeLog(runtimeLogger, {
          level: 'info',
          event: 'task-item-running',
          taskId: task.id,
          itemId: item.id,
          remoteTaskId: remoteTask.id
        })

        let result

        do {
          result = await getCompletedDrawResultDependency({
            id: remoteTask.id,
            outputDirectory: task.outputDirectory
          }, {
            httpClient
          })

          if (result.status === 'running') {
            await wait(2500)
          }
        } while (result.status === 'running')

        if (result.status === 'succeeded') {
          await localTaskStoreService.updateTaskItem(task.id, item.id, {
            remoteTaskId: remoteTask.id,
            status: 'succeeded',
            progress: 100,
            results: result.results || [],
            failureReason: '',
            error: ''
          })
          await safeRuntimeLog(runtimeLogger, {
            level: 'info',
            event: 'task-item-succeeded',
            taskId: task.id,
            itemId: item.id,
            remoteTaskId: remoteTask.id,
            outputDirectory: task.outputDirectory
          })
          continue
        }

        await localTaskStoreService.updateTaskItem(task.id, item.id, {
          remoteTaskId: remoteTask.id,
          status: 'failed',
          progress: 100,
          results: [],
          failureReason: result.failure_reason || '',
          error: result.error || ''
        })
        await safeRuntimeLog(runtimeLogger, {
          level: 'error',
          event: 'task-item-failed',
          taskId: task.id,
          itemId: item.id,
          remoteTaskId: remoteTask.id,
          failureReason: result.failure_reason || '',
          error: result.error || ''
        })
      } catch (error) {
        await localTaskStoreService.updateTaskItem(task.id, item.id, {
          status: 'failed',
          progress: 100,
          results: [],
          failureReason: 'error',
          error: error.message
        })
        await safeRuntimeLog(runtimeLogger, {
          level: 'error',
          event: 'task-item-error',
          taskId: task.id,
          itemId: item.id,
          error: error.message
        })
      }
    }

    await safeRuntimeLog(runtimeLogger, {
      level: 'info',
      event: 'task-run-complete',
      taskId: task.id
    })

    if (typeof localTaskStoreService.getTask === 'function') {
      return localTaskStoreService.getTask(task.id)
    }

    return {
      ...task,
      status: 'running'
    }
  }

  return {
    runTask
  }
}

module.exports = {
  createTaskRunnerService
}
