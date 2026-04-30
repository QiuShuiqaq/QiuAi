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
      messageRecorder,
      getNowMs: (() => {
        let counter = 0
        return () => {
          counter += 250
          return counter
        }
      })()
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
      requestPath: '/v1/draw/completions',
      elapsedMs: 250,
      requestStatus: 'success'
    }))
    expect(response.data.data.id).toBe('task-1')
  })

  it('records elapsed time and failure state when the request fails', async () => {
    const error = new Error('timeout')
    error.response = {
      data: {
        code: -1,
        msg: 'timeout'
      }
    }
    const post = vi.fn().mockRejectedValue(error)
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
      messageRecorder,
      getNowMs: (() => {
        let counter = 1000
        return () => {
          counter += 120
          return counter
        }
      })()
    })

    await expect(httpClient.post('/v1/draw/result', {
      id: 'task-1'
    })).rejects.toThrow('timeout')

    expect(messageRecorder.record).toHaveBeenCalledWith(expect.objectContaining({
      requestPath: '/v1/draw/result',
      elapsedMs: 120,
      requestStatus: 'failed',
      errorMessage: 'timeout'
    }))
  })

  it('passes a custom timeout to the axios client when provided', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        code: 0
      }
    })
    const requestClient = vi.fn(() => ({
      post
    }))

    const { createHttpClientService } = await import('../../main/src/services/httpClientService.js')
    const httpClient = createHttpClientService({
      apiBaseUrl: 'https://grsai.dakka.com.cn',
      apiKey: 'sk-test',
      requestClient,
      timeoutMs: 120000
    })

    await httpClient.post('/v1/chat/completions', {
      model: 'gemini-3-pro'
    })

    expect(requestClient).toHaveBeenCalledWith(expect.objectContaining({
      timeout: 120000
    }))
  })
})
