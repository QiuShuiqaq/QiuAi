import { describe, expect, it, vi } from 'vitest'

describe('taskRunnerService', () => {
  it('runs local task items sequentially, writes results, and records runtime logs', async () => {
    const updates = []
    const runtimeLogger = {
      log: vi.fn().mockResolvedValue(undefined)
    }
    const localTaskStoreService = {
      updateTask: vi.fn().mockImplementation(async (_id, patch) => patch),
      updateTaskItem: vi.fn().mockImplementation(async (taskId, itemId, patch) => {
        updates.push({ taskId, itemId, patch })
        return patch
      })
    }

    const createDrawTask = vi
      .fn()
      .mockResolvedValueOnce({ id: 'remote-1' })
      .mockRejectedValueOnce(new Error('network down'))

    const getCompletedDrawResult = vi.fn().mockResolvedValue({
      id: 'remote-1',
      status: 'succeeded',
      progress: 100,
      failure_reason: '',
      error: '',
      results: [{ savedPath: 'C:/output/1.png', previewUrl: 'data:image/png;base64,AAA' }],
      outputDirectory: 'C:/output/task-1'
    })

    const { createTaskRunnerService } = await import('../../main/src/services/taskRunnerService.js')
    const service = createTaskRunnerService({
      createDrawTask,
      getCompletedDrawResult,
      runtimeLogger,
      localTaskStoreService,
      toDataUrl: async ({ filePath }) => `data:image/png;base64,${filePath}`,
      getMimeTypeFromPath: () => 'image/png'
    })

    const result = await service.runTask({
      id: 'task-1',
      size: '1:1',
      outputDirectory: 'C:/output/task-1',
      items: [
        {
          id: 'item-1',
          sourcePath: 'C:/input/a.png',
          prompt: '统一风格图',
          status: 'pending'
        },
        {
          id: 'item-2',
          sourcePath: 'C:/input/b.png',
          prompt: '统一风格图',
          status: 'pending'
        }
      ]
    }, {
      httpClient: { post: vi.fn() }
    })

    expect(createDrawTask).toHaveBeenCalledTimes(2)
    expect(getCompletedDrawResult).toHaveBeenCalledTimes(1)
    expect(localTaskStoreService.updateTask).toHaveBeenCalledWith('task-1', { status: 'running' })
    expect(updates.some((entry) => entry.itemId === 'item-1' && entry.patch.status === 'succeeded')).toBe(true)
    expect(updates.some((entry) => entry.itemId === 'item-2' && entry.patch.status === 'failed')).toBe(true)
    expect(runtimeLogger.log).toHaveBeenCalled()
    expect(result.id).toBe('task-1')
  })
})
