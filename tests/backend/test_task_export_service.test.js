import { describe, expect, it, vi } from 'vitest'

describe('taskExportService', () => {
  it('exports a task directory into a zip archive', async () => {
    const pipe = vi.fn()
    const directory = vi.fn()
    const finalize = vi.fn().mockResolvedValue(undefined)
    const on = vi.fn((_event, handler) => {
      if (_event === 'close') {
        handler()
      }
    })
    const createWriteStream = vi.fn(() => ({
      on
    }))
    const createArchive = vi.fn(() => ({
      pipe,
      directory,
      finalize,
      on: vi.fn()
    }))

    const { exportTaskDirectory } = await import('../../main/src/services/taskExportService.js')
    const result = await exportTaskDirectory({
      sourceDirectory: 'C:/QiuAi/DATA/output/series-design/task-1',
      targetZipPath: 'C:/QiuAi/DATA/output/series-design/task-1.zip'
    }, {
      createWriteStream,
      createArchive
    })

    expect(pipe).toHaveBeenCalled()
    expect(directory).toHaveBeenCalledWith('C:/QiuAi/DATA/output/series-design/task-1', false)
    expect(finalize).toHaveBeenCalled()
    expect(result.targetZipPath).toBe('C:/QiuAi/DATA/output/series-design/task-1.zip')
  })
})
