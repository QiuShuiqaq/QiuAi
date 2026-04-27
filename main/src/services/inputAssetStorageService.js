const fs = require('node:fs/promises')
const path = require('node:path')

async function persistSourceFiles (
  { sourcePaths = [], targetDirectory = '' } = {},
  {
    mkdir = fs.mkdir,
    copyFile = fs.copyFile
  } = {}
) {
  if (!targetDirectory) {
    throw new Error('Target directory is required.')
  }

  await mkdir(targetDirectory, { recursive: true })

  const usedNames = new Set()
  const persistedPaths = []

  for (const sourcePath of sourcePaths) {
    const parsedPath = path.parse(sourcePath)
    let nextName = `${parsedPath.name}${parsedPath.ext}`
    let suffix = 1

    while (usedNames.has(nextName.toLowerCase())) {
      nextName = `${parsedPath.name}-${suffix}${parsedPath.ext}`
      suffix += 1
    }

    usedNames.add(nextName.toLowerCase())

    const targetPath = path.resolve(targetDirectory, nextName)
    await copyFile(sourcePath, targetPath)
    persistedPaths.push(targetPath)
  }

  return persistedPaths
}

module.exports = {
  persistSourceFiles
}
