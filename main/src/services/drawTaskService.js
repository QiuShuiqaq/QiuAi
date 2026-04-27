function resolveRequestPath(model = 'gpt-image-2') {
  return model === 'gpt-image-2' ? '/v1/draw/completions' : '/v1/draw/nano-banana'
}

async function createDrawTask ({ model = 'gpt-image-2', prompt, aspectRatio = '1:1', imageSize, urls = [] }, { httpClient }) {
  const payload = {
    model,
    prompt,
    aspectRatio,
    webHook: '-1',
    shutProgress: false
  }

  if (imageSize) {
    payload.imageSize = imageSize
  }

  if (Array.isArray(urls) && urls.length) {
    payload.urls = urls
  }

  const response = await httpClient.post(resolveRequestPath(model), payload)

  if (response.data.code !== 0) {
    throw new Error(response.data.msg || 'Failed to create draw task.')
  }

  return response.data.data
}

module.exports = {
  resolveRequestPath,
  createDrawTask
}
