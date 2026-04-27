import { describe, expect, it } from 'vitest'

describe('localTaskStoreService', () => {
  it('creates local tasks and aggregates child item status', async () => {
    const memory = new Map()
    const store = {
      get (key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set (key, value) {
        memory.set(key, value)
      }
    }

    const { createLocalTaskStoreService } = await import('../../main/src/services/localTaskStoreService.js')
    const service = createLocalTaskStoreService({
      store,
      createId: (() => {
        let counter = 0
        return () => `task-${++counter}`
      })()
    })

    const task = await service.createTask({
      mode: 'style-batch',
      name: '春夏女装风格统一',
      items: [
        { id: 'item-1', status: 'pending', progress: 0 },
        { id: 'item-2', status: 'pending', progress: 0 }
      ]
    })

    expect(task.status).toBe('draft')

    await service.updateTaskItem(task.id, 'item-1', {
      status: 'succeeded',
      progress: 100
    })
    await service.updateTaskItem(task.id, 'item-2', {
      status: 'failed',
      progress: 100
    })

    const nextTask = service.getTask(task.id)
    expect(nextTask.status).toBe('partial')
    expect(nextTask.progress).toBe(100)
  })
})
