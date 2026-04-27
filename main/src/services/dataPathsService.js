const fs = require('node:fs/promises')
const path = require('node:path')

const DATA_ROOT_DIRECTORY = path.resolve(__dirname, '../../..', 'DATA')
const INPUT_ROOT_DIRECTORY = path.resolve(DATA_ROOT_DIRECTORY, 'input')
const OUTPUT_ROOT_DIRECTORY = path.resolve(DATA_ROOT_DIRECTORY, 'output')
const MESSAGE_FILE_PATH = path.resolve(DATA_ROOT_DIRECTORY, 'message.txt')
const LOG_FILE_PATH = path.resolve(DATA_ROOT_DIRECTORY, 'log.txt')
const TASK_MANAGER_FILE_PATH = path.resolve(DATA_ROOT_DIRECTORY, 'taskmanager.json')

const featureDirectoryMap = {
  single: 'single-image',
  'single-image': 'single-image',
  'single-design': 'single-design',
  'style-batch': 'series-design',
  'series-design': 'series-design',
  'detail-set': 'series-generate',
  'series-generate': 'series-generate',
  workspace: 'workspace',
  'model-pricing': 'model-pricing'
}

function getFeatureDirectoryKey (featureKey = 'single') {
  return featureDirectoryMap[featureKey] || 'single-image'
}

function getTaskDataDirectories ({ featureKey = 'single', taskId = '' } = {}) {
  const normalizedFeatureKey = getFeatureDirectoryKey(featureKey)
  const pathSegments = taskId ? [normalizedFeatureKey, taskId] : [normalizedFeatureKey]

  return {
    featureKey: normalizedFeatureKey,
    inputDirectory: path.resolve(INPUT_ROOT_DIRECTORY, ...pathSegments),
    outputDirectory: path.resolve(OUTPUT_ROOT_DIRECTORY, ...pathSegments)
  }
}

function getDataFilePaths () {
  return {
    dataRootDirectory: DATA_ROOT_DIRECTORY,
    inputRootDirectory: INPUT_ROOT_DIRECTORY,
    outputRootDirectory: OUTPUT_ROOT_DIRECTORY,
    messageFilePath: MESSAGE_FILE_PATH,
    logFilePath: LOG_FILE_PATH,
    taskManagerFilePath: TASK_MANAGER_FILE_PATH
  }
}

async function ensureDirectory (directoryPath, { mkdir = fs.mkdir } = {}) {
  await mkdir(directoryPath, { recursive: true })
  return directoryPath
}

async function ensureDataLayout ({ mkdir = fs.mkdir } = {}) {
  await ensureDirectory(DATA_ROOT_DIRECTORY, { mkdir })
  await ensureDirectory(INPUT_ROOT_DIRECTORY, { mkdir })
  await ensureDirectory(OUTPUT_ROOT_DIRECTORY, { mkdir })

  return getDataFilePaths()
}

module.exports = {
  DATA_ROOT_DIRECTORY,
  INPUT_ROOT_DIRECTORY,
  OUTPUT_ROOT_DIRECTORY,
  MESSAGE_FILE_PATH,
  LOG_FILE_PATH,
  TASK_MANAGER_FILE_PATH,
  getFeatureDirectoryKey,
  getTaskDataDirectories,
  getDataFilePaths,
  ensureDirectory,
  ensureDataLayout
}
