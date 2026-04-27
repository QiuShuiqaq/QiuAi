import { describe, expect, it, vi } from 'vitest'

describe('chatCompletionService', () => {
  it('returns the assistant content from chat completions', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        id: 'chat-1',
        model: 'gemini-3-pro',
        choices: [
          {
            message: {
              content: '春季轻薄风衣，通勤百搭。'
            },
            finish_reason: 'stop'
          }
        ]
      }
    })
    const httpClient = { post }

    const { createChatCompletion } = await import('../../main/src/services/chatCompletionService.js')
    const result = await createChatCompletion({
      model: 'gemini-3-pro',
      messages: [
        { role: 'system', content: '你是电商文案助手' },
        { role: 'user', content: '生成一条电商标题' }
      ]
    }, {
      httpClient
    })

    expect(post).toHaveBeenCalledWith('/v1/chat/completions', {
      model: 'gemini-3-pro',
      stream: false,
      messages: [
        { role: 'system', content: '你是电商文案助手' },
        { role: 'user', content: '生成一条电商标题' }
      ]
    })
    expect(result.content).toBe('春季轻薄风衣，通勤百搭。')
    expect(result.model).toBe('gemini-3-pro')
  })
})
