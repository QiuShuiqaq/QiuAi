const { app, BrowserWindow } = require('electron')

function registerAppEvents (createMainWindow, {
  onBeforeQuit = null
} = {}) {
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })

  if (typeof onBeforeQuit === 'function') {
    app.on('before-quit', () => {
      Promise.resolve(onBeforeQuit()).catch(() => {})
    })
  }

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

module.exports = registerAppEvents
