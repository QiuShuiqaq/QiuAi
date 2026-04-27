const fs = require('node:fs/promises')
const path = require('node:path')
const axios = require('axios')

async function downloadImageToDirectory ({ imageUrl, targetDirectory }, { requestClient = axios } = {}) {
  if (!imageUrl) {
    throw new Error('Image URL is required.')
  }

  if (!targetDirectory) {
    throw new Error('Download directory is required.')
  }

  const response = await requestClient.get(imageUrl, {
    responseType: 'arraybuffer'
  })

  const urlObject = new URL(imageUrl)
  const fileName = path.basename(urlObject.pathname) || `qiuai-${Date.now()}.png`
  const savedPath = path.resolve(targetDirectory, fileName)

  await fs.mkdir(path.dirname(savedPath), { recursive: true })
  await fs.writeFile(savedPath, response.data)

  return {
    savedPath
  }
}

module.exports = {
  downloadImageToDirectory
}
