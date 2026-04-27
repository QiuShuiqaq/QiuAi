const fs = require('node:fs/promises')
const path = require('node:path')
const {
  ensureDataLayout,
  getDataFilePaths
} = require('./dataPathsService')

function createDataTraceService ({
  appendFile = fs.appendFile,
  mkdir = fs.mkdir,
  getNow = () => new Date().toISOString()
} = {}) {
  const {
    messageFilePath,
    logFilePath,
    outputRootDirectory
  } = getDataFilePaths()
  const outputMessageFilePath = path.resolve(outputRootDirectory, 'message.txt')

  async function appendLine (targetFilePath, payload = {}) {
    await ensureDataLayout({ mkdir })
    await appendFile(targetFilePath, `${JSON.stringify({
      timestamp: getNow(),
      ...payload
    })}\n`, 'utf8')
  }

  async function record (payload = {}) {
    await appendLine(messageFilePath, payload)
    await appendLine(outputMessageFilePath, payload)
  }

  async function log (payload = {}) {
    await appendLine(logFilePath, payload)
  }

  return {
    messageFilePath,
    logFilePath,
    record,
    log
  }
}

module.exports = {
  createDataTraceService
}
