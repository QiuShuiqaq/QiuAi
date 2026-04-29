const { dialog, ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')

function registerLicenseIpc({ licenseService }) {
  ipcMain.handle(ipcChannels.LICENSE_GET_STATUS, () => {
    return licenseService.getActivationStatus()
  })

  ipcMain.handle(ipcChannels.LICENSE_GET_DEVICE_CODE, () => {
    return licenseService.getDeviceCodePayload()
  })

  ipcMain.handle(ipcChannels.LICENSE_IMPORT_FILE, async (_event, payload = {}) => {
    const requestedFilePath = typeof payload.filePath === 'string' ? payload.filePath.trim() : ''
    let filePath = requestedFilePath

    if (!filePath) {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          {
            name: 'QiuAi License',
            extensions: ['qai']
          }
        ]
      })

      if (result.canceled || !result.filePaths?.[0]) {
        return {
          ...(await licenseService.getActivationStatus()),
          canceled: true
        }
      }

      [filePath] = result.filePaths
    }

    return {
      ...(await licenseService.importLicenseFromFile({ filePath })),
      canceled: false
    }
  })

  ipcMain.handle(ipcChannels.LICENSE_REFRESH, () => {
    return licenseService.getActivationStatus()
  })
}

module.exports = registerLicenseIpc
