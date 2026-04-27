import { describe, expect, it } from 'vitest'

describe('studioTaskManagerService', () => {
  it('persists task records to a local taskmanager file and lists them in reverse time order', async () => {
    const fileContents = new Map()
    const readFileSync = (targetPath) => {
      if (!fileContents.has(targetPath)) {
        const error = new Error('ENOENT')
        error.code = 'ENOENT'
        throw error
      }

      return fileContents.get(targetPath)
    }
    const writeFile = async (targetPath, payload) => {
      fileContents.set(targetPath, payload)
    }
    const ensureDirectory = async () => undefined

    const { createStudioTaskManagerService } = await import('../../main/src/services/studioTaskManagerService.js')
    const service = createStudioTaskManagerService({
      taskManagerFilePath: 'C:/QiuAi/DATA/taskmanager.json',
      readFileSync,
      writeFile,
      ensureDirectory
    })

    await service.saveTask({
      id: 'task-1',
      taskNumber: 'QAI-20260426-0001',
      title: '文案生成 2 条',
      createdAt: '2026-04-26 10:00'
    })
    await service.saveTask({
      id: 'task-2',
      taskNumber: 'QAI-20260426-0002',
      title: '单图四模型对比',
      createdAt: '2026-04-26 10:05'
    })

    const tasks = service.listTasks()
    expect(tasks.map((task) => task.id)).toEqual(['task-2', 'task-1'])
    expect(tasks[0].taskNumber).toBe('QAI-20260426-0002')
    expect(String(fileContents.get('C:/QiuAi/DATA/taskmanager.json'))).toContain('"taskNumber": "QAI-20260426-0001"')
  })
})
