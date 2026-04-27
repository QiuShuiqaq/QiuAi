import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const cleanupPaths = []

describe('imageDownloadService', () => {
  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map(async (targetPath) => {
      await fs.rm(targetPath, { recursive: true, force: true })
    }))
  })

  it('downloads a generated image to the local download directory', async () => {
    const targetDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-download-'))
    cleanupPaths.push(targetDirectory)

    const requestClient = {
      get: vi.fn().mockResolvedValue({
        data: Buffer.from('image-bytes')
      })
    }

    const { downloadImageToDirectory } = await import('../../main/src/services/imageDownloadService.js')
    const result = await downloadImageToDirectory({
      imageUrl: 'https://example.com/folder/file.png',
      targetDirectory
    }, {
      requestClient
    })

    expect(requestClient.get).toHaveBeenCalledWith('https://example.com/folder/file.png', {
      responseType: 'arraybuffer'
    })

    const fileStat = await fs.stat(result.savedPath)
    expect(fileStat.isFile()).toBe(true)
    expect(result.savedPath.endsWith('file.png')).toBe(true)
  })
})
