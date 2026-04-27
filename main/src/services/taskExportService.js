const fs = require('node:fs')

async function exportTaskDirectory (
  { sourceDirectory, targetZipPath },
  {
    createWriteStream = fs.createWriteStream,
    createArchive
  } = {}
) {
  const archiveFactory = createArchive || (() => {
    const archiver = require('archiver')
    return archiver('zip', { zlib: { level: 9 } })
  })

  return new Promise((resolve, reject) => {
    const output = createWriteStream(targetZipPath)
    const archive = archiveFactory()

    output.on('close', () => {
      resolve({
        targetZipPath
      })
    })
    output.on('error', reject)
    archive.on('error', reject)

    archive.pipe(output)
    archive.directory(sourceDirectory, false)
    archive.finalize().catch(reject)
  })
}

module.exports = {
  exportTaskDirectory
}
