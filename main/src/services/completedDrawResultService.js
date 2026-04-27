const { getDrawResult } = require('./drawResultService')
const { DEFAULT_OUTPUT_DIRECTORY, saveGeneratedImages } = require('./generatedImageSaveService')

async function getCompletedDrawResult (
  { id, outputDirectory = DEFAULT_OUTPUT_DIRECTORY },
  {
    httpClient,
    saveGeneratedImages: saveGeneratedImagesDependency = saveGeneratedImages
  }
) {
  const result = await getDrawResult({ id }, { httpClient })

  if (result.status !== 'succeeded') {
    return result
  }

  const savedResults = await saveGeneratedImagesDependency({
    taskId: result.id || id,
    results: result.results || [],
    outputDirectory
  })

  return {
    ...result,
    results: savedResults,
    outputDirectory
  }
}

module.exports = {
  getCompletedDrawResult
}
