import { describe, expect, it, vi } from 'vitest'

describe('completedDrawResultService', () => {
  it('saves succeeded draw results into the output directory before returning them', async () => {
    const httpClient = {
      post: vi.fn().mockResolvedValue({
        data: {
          code: 0,
          msg: 'success',
          data: {
            id: 'task-123',
            progress: 100,
            status: 'succeeded',
            failure_reason: '',
            error: '',
            results: [
              {
                base64: Buffer.from('saved-image').toString('base64')
              }
            ]
          }
        }
      })
    }

    const saveGeneratedImages = vi.fn().mockResolvedValue([
      {
        savedPath: 'F:/ProgramDevelopment/VSCODE/vscode/VSCode2026.4/workspace/QiuAi/DATA/output/single-image/task-123/qiuai-task-123-1.png',
        previewUrl: 'data:image/png;base64,c2F2ZWQtaW1hZ2U='
      }
    ])

    const { getCompletedDrawResult } = await import('../../main/src/services/completedDrawResultService.js')
    const result = await getCompletedDrawResult({
      id: 'task-123',
      outputDirectory: 'F:/ProgramDevelopment/VSCODE/vscode/VSCode2026.4/workspace/QiuAi/DATA/output/single-image/task-123'
    }, {
      httpClient,
      saveGeneratedImages
    })

    expect(saveGeneratedImages).toHaveBeenCalledWith({
      taskId: 'task-123',
      results: [
        {
          base64: Buffer.from('saved-image').toString('base64')
        }
      ],
      outputDirectory: 'F:/ProgramDevelopment/VSCODE/vscode/VSCode2026.4/workspace/QiuAi/DATA/output/single-image/task-123'
    })
    expect(result.results[0].savedPath).toContain('/DATA/output/')
  })

  it('does not attempt to save images while the task is still running', async () => {
    const httpClient = {
      post: vi.fn().mockResolvedValue({
        data: {
          code: -22,
          msg: '任务不存在'
        }
      })
    }
    const saveGeneratedImages = vi.fn()

    const { getCompletedDrawResult } = await import('../../main/src/services/completedDrawResultService.js')
    const result = await getCompletedDrawResult({
      id: 'task-running',
      outputDirectory: 'F:/ProgramDevelopment/VSCODE/vscode/VSCode2026.4/workspace/QiuAi/DATA/output/single-image/task-running'
    }, {
      httpClient,
      saveGeneratedImages
    })

    expect(saveGeneratedImages).not.toHaveBeenCalled()
    expect(result.status).toBe('running')
  })
})
