const path = require('node:path')
const { app } = require('electron')

if (app.isPackaged && !process.env.QIUAI_DATA_ROOT) {
  process.env.QIUAI_DATA_ROOT = path.join(app.getPath('userData'), 'DATA')
}

const createMainWindow = require('./src/bootstrap/createMainWindow')
const registerAppEvents = require('./src/bootstrap/registerAppEvents')
const registerIpc = require('./src/bootstrap/registerIpc')

async function bootstrap () {
  await app.whenReady()
  app.setAppUserModelId('com.qiuai.desktop')
  const { studioTaskManagerService } = registerIpc()
  registerAppEvents(createMainWindow, {
    onBeforeQuit: () => studioTaskManagerService?.flushPendingWrites?.()
  })
  createMainWindow()
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap QiuAi:', error)
  app.quit()
})
