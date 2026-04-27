import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const cleanupPaths = []

describe('generatedImageSaveService', () => {
  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map(async (targetPath) => {
      await fs.rm(targetPath, { recursive: true, force: true })
    }))
  })

  it('saves base64 image results into the output directory', async () => {
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-output-'))
    cleanupPaths.push(outputDirectory)

    const imageBytes = Buffer.from('base64-image-content')
    const { saveGeneratedImages } = await import('../../main/src/services/generatedImageSaveService.js')

    const savedResults = await saveGeneratedImages({
      taskId: 'task-base64',
      results: [
        {
          base64: imageBytes.toString('base64')
        }
      ],
      outputDirectory
    })

    expect(savedResults).toHaveLength(1)
    expect(savedResults[0].savedPath).toContain(outputDirectory)
    expect(savedResults[0].previewUrl).toContain('data:image/png;base64,')

    const savedContent = await fs.readFile(savedResults[0].savedPath)
    expect(savedContent.equals(imageBytes)).toBe(true)
  })

  it('downloads url image results into the output directory when base64 is unavailable', async () => {
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-output-'))
    cleanupPaths.push(outputDirectory)

    const requestClient = {
      get: vi.fn().mockResolvedValue({
        data: Buffer.from('url-image-content')
      })
    }

    const { saveGeneratedImages } = await import('../../main/src/services/generatedImageSaveService.js')
    const savedResults = await saveGeneratedImages({
      taskId: 'task-url',
      results: [
        {
          url: 'https://example.com/generated/example.jpg'
        }
      ],
      outputDirectory
    }, {
      requestClient
    })

    expect(requestClient.get).toHaveBeenCalledWith('https://example.com/generated/example.jpg', {
      responseType: 'arraybuffer'
    })
    expect(savedResults).toHaveLength(1)
    expect(savedResults[0].savedPath.endsWith('.jpg')).toBe(true)
    expect(savedResults[0].previewUrl).toContain('data:image/jpeg;base64,')

    const savedContent = await fs.readFile(savedResults[0].savedPath)
    expect(savedContent.equals(Buffer.from('url-image-content'))).toBe(true)
  })
})
