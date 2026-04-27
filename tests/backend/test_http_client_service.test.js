import { describe, expect, it, vi } from 'vitest'

describe('httpClientService', () => {
  it('records api request and response messages into the message recorder', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        code: 0,
        msg: 'success',
        data: {
          id: 'task-1'
        }
      }
    })
    const requestClient = vi.fn(() => ({
      post
    }))
    const messageRecorder = {
      record: vi.fn().mockResolvedValue(undefined)
    }

    const { createHttpClientService } = await import('../../main/src/services/httpClientService.js')
    const httpClient = createHttpClientService({
      apiBaseUrl: 'https://grsai.dakka.com.cn',
      apiKey: 'sk-test',
      requestClient,
      messageRecorder
    })

    const response = await httpClient.post('/v1/draw/completions', {
      model: 'gpt-image-2'
    })

    expect(post).toHaveBeenCalledWith('/v1/draw/completions', {
      model: 'gpt-image-2'
    })
    expect(messageRecorder.record).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'api',
      method: 'POST',
      requestPath: '/v1/draw/completions'
    }))
    expect(response.data.data.id).toBe('task-1')
  })
})
