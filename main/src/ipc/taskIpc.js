const { dialog, ipcMain } = require('electron')
const path = require('node:path')
const ipcChannels = require('../../../shared/ipcChannels')
const { createHttpClientService } = require('../services/httpClientService')
const {
  listSupportedImageFiles,
  listSupportedImageFilesFromDirectory
} = require('../services/localInputAssetService')

async function safeRuntimeLog (runtimeLogger, payload) {
  if (!runtimeLogger || typeof runtimeLogger.log !== 'function') {
    return
  }

  try {
    await runtimeLogger.log(payload)
  } catch {
    // 运行日志失败不影响主流程。
  }
}

function createApiClientFromSettings (settingsService, { messageRecorder } = {}) {
  const settings = settingsService.getSettings()

  if (!settings.apiKey) {
    throw new Error('Please configure your API Key first.')
  }

  return createHttpClientService({
    apiBaseUrl: settings.apiBaseUrl,
    apiKey: settings.apiKey,
    messageRecorder
  })
}

function resolvePrompt (payload = {}, promptTemplateService) {
  if (payload.prompt) {
    return payload.prompt
  }

  if (!payload.templateId) {
    return ''
  }

  const template = promptTemplateService.listTemplates().find((item) => item.id === payload.templateId)
  return template ? template.prompt : ''
}

function registerTaskIpc ({
  settingsService,
  promptTemplateService,
  localTaskStoreService,
  taskModeService,
  taskRunnerService,
  exportTaskDirectory,
  messageRecorder,
  runtimeLogger,
  activationGuard
}) {
  const runningTasks = new Map()

  ipcMain.handle(ipcChannels.INPUT_PICK_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    const [directoryPath] = result.filePaths || []

    return {
      canceled: result.canceled,
      paths: result.filePaths || [],
      files: result.canceled || !directoryPath
        ? []
        : await listSupportedImageFilesFromDirectory(directoryPath)
    }
  })

  ipcMain.handle(ipcChannels.INPUT_PICK_FILE, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }
      ]
    })
    return {
      canceled: result.canceled,
      paths: listSupportedImageFiles(result.filePaths || [])
    }
  })

  ipcMain.handle(ipcChannels.TASKS_CREATE_LOCAL, async (_event, payload = {}) => {
    const resolvedPrompt = resolvePrompt(payload, promptTemplateService)
    let task

    if (payload.mode === 'style-batch') {
      task = await taskModeService.createStyleBatchTask({
        ...payload,
        prompt: resolvedPrompt
      })
    } else if (payload.mode === 'detail-set') {
      task = await taskModeService.createDetailSetTask({
        ...payload,
        basePrompt: resolvedPrompt
      })
    } else {
      task = await taskModeService.createSingleTask({
        prompt: resolvedPrompt,
        size: payload.size || '1:1',
        templateId: payload.templateId || ''
      })
    }

    const savedTask = await localTaskStoreService.createTask(task)
    await safeRuntimeLog(runtimeLogger, {
      level: 'info',
      event: 'local-task-created',
      taskId: savedTask.id,
      mode: savedTask.mode,
      inputDirectory: savedTask.inputDirectory || '',
      outputDirectory: savedTask.outputDirectory || ''
    })
    return savedTask
  })

  ipcMain.handle(ipcChannels.TASKS_LIST, () => {
    return localTaskStoreService.listTasks()
  })

  ipcMain.handle(ipcChannels.TASKS_GET, (_event, payload = {}) => {
    return localTaskStoreService.getTask(payload.id)
  })

  ipcMain.handle(ipcChannels.TASKS_RUN, async (_event, payload = {}) => {
    await activationGuard?.assertActivated?.()
    const task = localTaskStoreService.getTask(payload.id)
    if (!task) {
      throw new Error('Task not found.')
    }

    if (!runningTasks.has(payload.id)) {
      const httpClient = createApiClientFromSettings(settingsService, { messageRecorder })
      const pendingRun = taskRunnerService.runTask(task, { httpClient })
        .finally(() => {
          runningTasks.delete(payload.id)
        })
      runningTasks.set(payload.id, pendingRun)
    }

    return localTaskStoreService.getTask(payload.id)
  })

  ipcMain.handle(ipcChannels.TASKS_EXPORT, async (_event, payload = {}) => {
    const task = localTaskStoreService.getTask(payload.id)
    if (!task) {
      throw new Error('Task not found.')
    }

    const defaultZipPath = path.resolve(path.dirname(task.outputDirectory), `${task.id}.zip`)
    const result = await dialog.showSaveDialog({
      defaultPath: defaultZipPath,
      filters: [
        {
          name: 'Zip Archive',
          extensions: ['zip']
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return {
        taskId: payload.id,
        canceled: true,
        targetZipPath: ''
      }
    }

    const exported = await exportTaskDirectory({
      sourceDirectory: task.outputDirectory,
      targetZipPath: result.filePath
    })
    await safeRuntimeLog(runtimeLogger, {
      level: 'info',
      event: 'local-task-exported',
      taskId: payload.id,
      sourceDirectory: task.outputDirectory,
      targetZipPath: exported.targetZipPath
    })

    return {
      taskId: payload.id,
      canceled: false,
      targetZipPath: exported.targetZipPath
    }
  })
}

module.exports = registerTaskIpc
