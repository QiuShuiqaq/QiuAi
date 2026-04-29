const { ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')
const { createHttpClientService } = require('../services/httpClientService')
const { createDrawTask } = require('../services/drawTaskService')
const { getCompletedDrawResult } = require('../services/completedDrawResultService')
const { downloadImageToDirectory } = require('../services/imageDownloadService')

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

function registerDrawIpc ({ settingsService, messageRecorder, runtimeLogger, activationGuard }) {
  ipcMain.handle(ipcChannels.DRAW_CREATE_TASK, async (_event, payload = {}) => {
    await activationGuard?.assertActivated?.()
    const httpClient = createApiClientFromSettings(settingsService, { messageRecorder })

    try {
      const result = await createDrawTask({
        model: payload.model || 'gpt-image-2',
        prompt: payload.prompt,
        aspectRatio: payload.aspectRatio || payload.size || '1:1'
      }, {
        httpClient
      })
      await safeRuntimeLog(runtimeLogger, {
        level: 'info',
        event: 'draw-task-created',
        remoteTaskId: result.id || '',
        aspectRatio: payload.aspectRatio || payload.size || ''
      })
      return result
    } catch (error) {
      await safeRuntimeLog(runtimeLogger, {
        level: 'error',
        event: 'draw-task-create-error',
        error: error.message
      })
      throw error
    }
  })

  ipcMain.handle(ipcChannels.DRAW_GET_RESULT, async (_event, payload = {}) => {
    await activationGuard?.assertActivated?.()
    const httpClient = createApiClientFromSettings(settingsService, { messageRecorder })

    try {
      const result = await getCompletedDrawResult({
        id: payload.id
      }, {
        httpClient
      })
      await safeRuntimeLog(runtimeLogger, {
        level: 'info',
        event: 'draw-task-result',
        remoteTaskId: payload.id || '',
        status: result.status || ''
      })
      return result
    } catch (error) {
      await safeRuntimeLog(runtimeLogger, {
        level: 'error',
        event: 'draw-task-result-error',
        remoteTaskId: payload.id || '',
        error: error.message
      })
      throw error
    }
  })

  ipcMain.handle(ipcChannels.DRAW_DOWNLOAD_IMAGE, async (_event, payload = {}) => {
    try {
      const result = await downloadImageToDirectory({
        imageUrl: payload.imageUrl,
        targetDirectory: payload.targetDirectory
      })
      await safeRuntimeLog(runtimeLogger, {
        level: 'info',
        event: 'draw-image-downloaded',
        targetDirectory: payload.targetDirectory || '',
        savedPath: result.savedPath || ''
      })
      return result
    } catch (error) {
      await safeRuntimeLog(runtimeLogger, {
        level: 'error',
        event: 'draw-image-download-error',
        targetDirectory: payload.targetDirectory || '',
        error: error.message
      })
      throw error
    }
  })
}

module.exports = registerDrawIpc
