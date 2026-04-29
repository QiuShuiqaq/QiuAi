import { describe, expect, it } from 'vitest'

describe('localInputAssetService', () => {
  it('filters supported image files and converts local files to data urls', async () => {
    const {
      listSupportedImageFiles,
      listSupportedImageFilesFromDirectory,
      describeSupportedImageFiles,
      toDataUrl
    } = await import('../../main/src/services/localInputAssetService.js')

    expect(listSupportedImageFiles([
      'C:/images/a.png',
      'C:/images/readme.txt',
      'C:/images/b.jpg',
      'C:/images/c.webp'
    ])).toEqual([
      'C:/images/a.png',
      'C:/images/b.jpg',
      'C:/images/c.webp'
    ])

    const dataUrl = await toDataUrl({
      filePath: 'C:/images/a.png',
      mimeType: 'image/png'
    }, {
      readFile: async () => Buffer.from('hello')
    })

    expect(dataUrl).toBe(`data:image/png;base64,${Buffer.from('hello').toString('base64')}`)

    const files = await listSupportedImageFilesFromDirectory('C:/images', {
      readdir: async () => [
        { name: 'a.png', isFile: () => true },
        { name: 'ignore', isFile: () => false },
        { name: 'b.txt', isFile: () => true },
        { name: 'c.jpeg', isFile: () => true }
      ]
    })

    expect(files).toEqual([
      'C:\\images\\a.png',
      'C:\\images\\c.jpeg'
    ])

    const describedFiles = await describeSupportedImageFiles([
      'C:/images/a.png',
      'C:/images/ignore.txt',
      'C:/images/c.jpeg'
    ], {
      stat: async () => ({ size: 2048 })
    })

    expect(describedFiles).toEqual([
      {
        name: 'a.png',
        path: 'C:/images/a.png',
        size: 2048
      },
      {
        name: 'c.jpeg',
        path: 'C:/images/c.jpeg',
        size: 2048
      }
    ])
  })
})
