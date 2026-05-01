const { dialog, ipcMain, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const ipcChannels = require('../../../shared/ipcChannels')
const { describeSupportedImageFiles } = require('../services/localInputAssetService')

async function openOutputDirectory ({ outputDirectory = '' } = {}) {
  if (!outputDirectory) {
    throw new Error('Output directory is required.')
  }

  return shell.openPath(outputDirectory)
}

function resolveUploadDefaultPath (settingsService, menuKey = '') {
  const configuredPath = settingsService?.getSettings?.().uploadDirectories?.[menuKey] || ''
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath
  }

  return process.cwd()
}

function registerStudioIpc({ studioWorkspaceService, settingsService, dataTraceService, activationGuard }) {
  ipcMain.handle(ipcChannels.STUDIO_GET_SNAPSHOT, () => {
    return studioWorkspaceService.getSnapshot()
  })

  ipcMain.handle(ipcChannels.STUDIO_SAVE_DRAFT, async (_event, payload = {}) => {
    return studioWorkspaceService.saveDraft(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_CREATE_TASK, async (_event, payload = {}) => {
    await activationGuard?.assertActivated?.()
    return studioWorkspaceService.createTask(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_STOP_TASK, async (_event, payload = {}) => {
    return studioWorkspaceService.stopTask(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_PICK_INPUT_ASSETS, async (_event, payload = {}) => {
    const result = await dialog.showOpenDialog({
      defaultPath: resolveUploadDefaultPath(settingsService, payload.menuKey),
      properties: payload.allowMultiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }
      ]
    })

    return {
      canceled: result.canceled,
      files: result.canceled ? [] : await describeSupportedImageFiles(result.filePaths || [])
    }
  })

  ipcMain.handle(ipcChannels.STUDIO_OPEN_OUTPUT_DIRECTORY, async (_event, payload = {}) => {
    return openOutputDirectory(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_DELETE_EXPORT_ITEM, async (_event, payload = {}) => {
    return studioWorkspaceService.deleteExportItem(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_CLEAR_RUNTIME_STATE, async () => {
    const clearedState = await studioWorkspaceService.clearRuntimeState()
    await dataTraceService?.clearRuntimeFiles?.()

    return clearedState
  })

  ipcMain.handle(ipcChannels.STUDIO_EXPORT_RESULTS, async (_event, payload = {}) => {
    const snapshot = studioWorkspaceService.getSnapshot()
    const exportItems = snapshot.exportItemsByMenu?.[payload.menuKey] || []
    const selectedIdSet = new Set(Array.isArray(payload.selectedExportIds) ? payload.selectedExportIds : [])
    const firstSelectedItem = exportItems.find((item) => selectedIdSet.has(item.id)) || exportItems[0]
    const baseDirectory = firstSelectedItem?.savedPath
      ? path.dirname(firstSelectedItem.savedPath)
      : (firstSelectedItem?.outputDirectory || process.cwd())
    const archiveName = `${payload.menuKey || 'studio-results'}-results.zip`
    const result = await dialog.showSaveDialog({
      defaultPath: path.resolve(baseDirectory, archiveName),
      filters: [
        {
          name: 'Zip Archive',
          extensions: ['zip']
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return {
        menuKey: payload.menuKey || '',
        canceled: true,
        targetZipPath: ''
      }
    }

    const exportedArchive = await studioWorkspaceService.exportSelectedResults({
      ...payload,
      targetZipPath: result.filePath
    })

    return {
      ...exportedArchive,
      canceled: false
    }
  })
}

module.exports = registerStudioIpc
