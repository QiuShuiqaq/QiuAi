const fs = require('node:fs/promises')
const path = require('node:path')
const axios = require('axios')
const { OUTPUT_ROOT_DIRECTORY } = require('./dataPathsService')

const DEFAULT_OUTPUT_DIRECTORY = OUTPUT_ROOT_DIRECTORY

function getBase64Payload (result = {}) {
  const candidateKeys = ['base64', 'b64_json', 'image_base64', 'imageBase64', 'data']

  for (const key of candidateKeys) {
    const value = result[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function parseBase64Payload (result = {}) {
  let payload = getBase64Payload(result)

  if (!payload) {
    return null
  }

  let mimeType = result.mime_type || result.mimeType || 'image/png'
  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/i.exec(payload)

  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1] || mimeType
    payload = dataUrlMatch[2]
  }

  return {
    buffer: Buffer.from(payload, 'base64'),
    mimeType
  }
}

function extensionFromMimeType (mimeType = 'image/png') {
  const knownExtensions = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp'
  }

  if (knownExtensions[mimeType]) {
    return knownExtensions[mimeType]
  }

  const mimeSuffix = mimeType.split('/')[1]

  return mimeSuffix ? `.${mimeSuffix}` : '.png'
}

function mimeTypeFromExtension (extension = '') {
  const normalizedExtension = extension.toLowerCase()
  const knownMimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp'
  }

  return knownMimeTypes[normalizedExtension] || 'image/png'
}

function extensionFromUrl (imageUrl = '') {
  try {
    const urlObject = new URL(imageUrl)
    const extension = path.extname(urlObject.pathname)

    return extension || '.png'
  } catch {
    return '.png'
  }
}

function createFileName ({ taskId, index, extension }) {
  return `qiuai-${taskId}-${index + 1}${extension}`
}

async function writeResultBuffer ({ taskId, index, buffer, extension, outputDirectory }) {
  const savedPath = path.resolve(outputDirectory, createFileName({
    taskId,
    index,
    extension
  }))

  await fs.mkdir(path.dirname(savedPath), { recursive: true })
  await fs.writeFile(savedPath, buffer)

  return savedPath
}

async function saveGeneratedImages ({ taskId, results = [], outputDirectory = DEFAULT_OUTPUT_DIRECTORY }, { requestClient = axios } = {}) {
  if (!taskId) {
    throw new Error('Task ID is required.')
  }

  if (!Array.isArray(results)) {
    throw new Error('Generated image results must be an array.')
  }

  const resolvedOutputDirectory = path.resolve(outputDirectory)

  await fs.mkdir(resolvedOutputDirectory, { recursive: true })

  return Promise.all(results.map(async (result, index) => {
    const base64Payload = parseBase64Payload(result)

    if (base64Payload) {
      const savedPath = await writeResultBuffer({
        taskId,
        index,
        buffer: base64Payload.buffer,
        extension: extensionFromMimeType(base64Payload.mimeType),
        outputDirectory: resolvedOutputDirectory
      })

      return {
        ...result,
        savedPath,
        previewUrl: `data:${base64Payload.mimeType};base64,${base64Payload.buffer.toString('base64')}`
      }
    }

    if (result.url) {
      const response = await requestClient.get(result.url, {
        responseType: 'arraybuffer'
      })
      const extension = extensionFromUrl(result.url)
      const mimeType = mimeTypeFromExtension(extension)
      const buffer = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data)

      const savedPath = await writeResultBuffer({
        taskId,
        index,
        buffer,
        extension,
        outputDirectory: resolvedOutputDirectory
      })

      return {
        ...result,
        savedPath,
        previewUrl: `data:${mimeType};base64,${buffer.toString('base64')}`
      }
    }

    throw new Error('Generated image result does not contain a supported image payload.')
  }))
}

module.exports = {
  DEFAULT_OUTPUT_DIRECTORY,
  saveGeneratedImages
}
