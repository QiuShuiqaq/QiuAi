import { describe, expect, it, vi } from 'vitest'

describe('drawResultService', () => {
  it('returns succeeded result data from the result endpoint', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        code: 0,
        msg: 'success',
        data: {
          id: 'task-1',
          progress: 100,
          status: 'succeeded',
          failure_reason: '',
          error: '',
          results: [
            { url: 'https://example.com/image.png' }
          ]
        }
      }
    })

    const { getDrawResult } = await import('../../main/src/services/drawResultService.js')
    const result = await getDrawResult(
      { id: 'task-1' },
      { httpClient: { post } }
    )

    expect(post).toHaveBeenCalledWith('/v1/draw/result', { id: 'task-1' })
    expect(result.status).toBe('succeeded')
    expect(result.results[0].url).toBe('https://example.com/image.png')
  })

  it('treats temporary task-not-found responses as running instead of failing immediately', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        code: -22,
        msg: '任务不存在'
      }
    })

    const { getDrawResult } = await import('../../main/src/services/drawResultService.js')
    const result = await getDrawResult(
      { id: 'task-1' },
      { httpClient: { post } }
    )

    expect(result).toEqual({
      id: 'task-1',
      progress: 0,
      status: 'running',
      failure_reason: '',
      error: '',
      results: []
    })
  })
})
