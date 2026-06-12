const path = require('node:path')
const { BrowserWindow } = require('electron')

let mainWindowInstance = null

function createMainWindow () {
  if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
    mainWindowInstance.focus()
    return mainWindowInstance
  }

  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#f4ecdf',
    icon: path.resolve(__dirname, '../../assets/app-icon.png'),
    webPreferences: {
      preload: path.resolve(__dirname, '../../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  mainWindowInstance = mainWindow

  mainWindow.on('closed', () => {
    if (mainWindowInstance === mainWindow) {
      mainWindowInstance = null
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
