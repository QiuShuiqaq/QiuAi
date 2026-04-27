const { dialog, ipcMain, shell } = require('electron')
const path = require('node:path')
const ipcChannels = require('../../../shared/ipcChannels')

async function openOutputDirectory ({ outputDirectory = '' } = {}) {
  if (!outputDirectory) {
    throw new Error('Output directory is required.')
  }

  return shell.openPath(outputDirectory)
}

function registerStudioIpc({ studioWorkspaceService }) {
  ipcMain.handle(ipcChannels.STUDIO_GET_SNAPSHOT, () => {
    return studioWorkspaceService.getSnapshot()
  })

  ipcMain.handle(ipcChannels.STUDIO_SAVE_DRAFT, async (_event, payload = {}) => {
    return studioWorkspaceService.saveDraft(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_CREATE_TASK, async (_event, payload = {}) => {
    return studioWorkspaceService.createTask(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_OPEN_OUTPUT_DIRECTORY, async (_event, payload = {}) => {
    return openOutputDirectory(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_DELETE_EXPORT_ITEM, async (_event, payload = {}) => {
    return studioWorkspaceService.deleteExportItem(payload)
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
