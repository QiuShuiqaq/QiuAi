const fs = require('node:fs/promises')
const path = require('node:path')

const supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp'])

function listSupportedImageFiles (filePaths = []) {
  return filePaths.filter((filePath) => supportedExtensions.has(path.extname(filePath).toLowerCase()))
}

async function listSupportedImageFilesFromDirectory (directoryPath, { readdir = fs.readdir } = {}) {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  return listSupportedImageFiles(entries
    .filter((entry) => typeof entry.isFile === 'function' && entry.isFile())
    .map((entry) => path.resolve(directoryPath, entry.name)))
}

async function describeSupportedImageFiles (filePaths = [], { stat = fs.stat } = {}) {
  const supportedPaths = listSupportedImageFiles(filePaths)
  const files = await Promise.all(supportedPaths.map(async (filePath) => {
    const fileStat = await stat(filePath)
    return {
      name: path.basename(filePath),
      path: filePath,
      size: Number(fileStat.size) || 0
    }
  }))

  return files
}

async function toDataUrl ({ filePath, mimeType }, { readFile = fs.readFile } = {}) {
  const buffer = await readFile(filePath)
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

function getMimeTypeFromPath (filePath = '') {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg'
  }
  if (extension === '.webp') {
    return 'image/webp'
  }
  return 'image/png'
}

module.exports = {
  supportedExtensions,
  listSupportedImageFiles,
  listSupportedImageFilesFromDirectory,
  describeSupportedImageFiles,
  toDataUrl,
  getMimeTypeFromPath
}
