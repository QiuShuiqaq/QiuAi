const path = require('node:path')
const { BrowserWindow } = require('electron')

function createMainWindow () {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#f4ecdf',
    webPreferences: {
      preload: path.resolve(__dirname, '../../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
    return mainWindow
  }

  mainWindow.loadFile(path.resolve(__dirname, '../../../renderer/dist/index.html'))
  return mainWindow
}

module.exports = createMainWindow
