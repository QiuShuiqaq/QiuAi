import { describe, expect, it, vi } from 'vitest'

describe('copywritingGenerationService', () => {
  it('submits one chat request and splits the returned text into quantity-limited results', async () => {
    const createChatCompletion = vi.fn(async () => ({
      id: 'chat-1',
      model: 'gemini-3-pro',
      content: '标题一\n标题二\n标题三\n标题四'
    }))

    const { createCopywritingGenerationService } = await import('../../main/src/services/copywritingGenerationService.js')

    const service = createCopywritingGenerationService({
      settingsService: {
        getSettings: () => ({
          apiKeys: ['sk-test'],
          activeApiKeyIndex: 0,
          apiBaseUrl: 'https://grsai.dakka.com.cn'
        })
      },
      messageRecorder: null,
      createHttpClientServiceDependency: () => ({ post: vi.fn() }),
      createChatCompletionDependency: createChatCompletion
    })

    const results = await service.generateCopywritingResults({
      taskId: 'copy-task-1',
      draft: {
        prompt: '请生成适合电商主图的中文标题',
        quantity: 3,
        model: 'gemini-3-pro',
        copyMode: 'prompt-only',
        referenceImages: []
      }
    })

    expect(createChatCompletion).toHaveBeenCalledTimes(1)
    expect(createChatCompletion).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3-pro',
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('请一次性输出 3 条')
        })
      ])
    }), expect.any(Object))
    expect(results).toHaveLength(3)
    expect(results.map((item) => item.content)).toEqual(['标题一', '标题二', '标题三'])
    expect(results[0].title).toBe('文案 1')
  })
})
