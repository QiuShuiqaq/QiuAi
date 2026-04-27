import { describe, expect, it, vi } from 'vitest'

describe('drawTaskService', () => {
  it('submits a gpt-image-2 task using polling mode', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        code: 0,
        msg: 'success',
        data: {
          id: 'task-1'
        }
      }
    })

    const { createDrawTask } = await import('../../main/src/services/drawTaskService.js')
    const result = await createDrawTask(
      {
        model: 'gpt-image-2',
        prompt: 'sunrise mountain',
        aspectRatio: '1:1'
      },
      {
        httpClient: { post }
      }
    )

    expect(post).toHaveBeenCalledWith('/v1/draw/completions', {
      model: 'gpt-image-2',
      prompt: 'sunrise mountain',
      aspectRatio: '1:1',
      webHook: '-1',
      shutProgress: false
    })
    expect(result.id).toBe('task-1')
  })

  it('includes reference image urls when provided', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        code: 0,
        msg: 'success',
        data: {
          id: 'task-2'
        }
      }
    })

    const { createDrawTask } = await import('../../main/src/services/drawTaskService.js')
    await createDrawTask(
      {
        model: 'gpt-image-2',
        prompt: '统一白底电商产品图',
        aspectRatio: '1:1',
        urls: ['data:image/png;base64,AAA']
      },
      {
        httpClient: { post }
      }
    )

    expect(post).toHaveBeenCalledWith('/v1/draw/completions', {
      model: 'gpt-image-2',
      prompt: '统一白底电商产品图',
      aspectRatio: '1:1',
      urls: ['data:image/png;base64,AAA'],
      webHook: '-1',
      shutProgress: false
    })
  })

  it('submits nano banana models to the dedicated endpoint with image size', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        code: 0,
        msg: 'success',
        data: {
          id: 'task-3'
        }
      }
    })

    const { createDrawTask } = await import('../../main/src/services/drawTaskService.js')
    await createDrawTask(
      {
        model: 'nano-banana-2',
        prompt: '电商主图升级',
        aspectRatio: '4:5',
        imageSize: '2K',
        urls: ['data:image/png;base64,BBB']
      },
      {
        httpClient: { post }
      }
    )

    expect(post).toHaveBeenCalledWith('/v1/draw/nano-banana', {
      model: 'nano-banana-2',
      prompt: '电商主图升级',
      aspectRatio: '4:5',
      imageSize: '2K',
      urls: ['data:image/png;base64,BBB'],
      webHook: '-1',
      shutProgress: false
    })
  })
})
