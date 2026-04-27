import { describe, expect, it, vi } from 'vitest'

describe('dataPathsService', () => {
  it('builds DATA input/output directories and root files', async () => {
    const mkdir = vi.fn().mockResolvedValue(undefined)

    const {
      DATA_ROOT_DIRECTORY,
      getFeatureDirectoryKey,
      getTaskDataDirectories,
      getDataFilePaths,
      ensureDataLayout
    } = await import('../../main/src/services/dataPathsService.js')

    expect(DATA_ROOT_DIRECTORY.replace(/\\/g, '/')).toContain('/DATA')
    expect(getFeatureDirectoryKey('single')).toBe('single-image')
    expect(getFeatureDirectoryKey('single-design')).toBe('single-design')
    expect(getFeatureDirectoryKey('style-batch')).toBe('series-design')
    expect(getFeatureDirectoryKey('detail-set')).toBe('series-generate')
    expect(getFeatureDirectoryKey('copywriting')).toBe('copywriting')

    const directories = getTaskDataDirectories({
      featureKey: 'series-design',
      taskId: 'task-1'
    })

    expect(directories.inputDirectory.replace(/\\/g, '/')).toContain('/DATA/input/series-design/task-1')
    expect(directories.outputDirectory.replace(/\\/g, '/')).toContain('/DATA/output/series-design/task-1')
    expect(getDataFilePaths().messageFilePath.replace(/\\/g, '/')).toContain('/DATA/message.txt')
    expect(getDataFilePaths().logFilePath.replace(/\\/g, '/')).toContain('/DATA/log.txt')

    await ensureDataLayout({ mkdir })
    expect(mkdir).toHaveBeenCalled()
  })
})
