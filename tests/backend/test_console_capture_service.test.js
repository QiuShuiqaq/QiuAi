import { describe, expect, it, vi } from 'vitest'

describe('consoleCaptureService', () => {
  it('forwards console output into the runtime logger', async () => {
    delete globalThis[Symbol.for('qiuai.console.capture')]

    const runtimeLogger = {
      log: vi.fn().mockResolvedValue(undefined)
    }
    const originalError = vi.fn()
    const consoleObject = {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: originalError
    }

    const { attachConsoleCapture } = await import('../../main/src/services/consoleCaptureService.js')
    attachConsoleCapture({
      runtimeLogger,
      consoleObject
    })

    consoleObject.error('studio task failed', { reason: '429' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runtimeLogger.log).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      event: 'console-output'
    }))
    expect(originalError).toHaveBeenCalledWith('studio task failed', { reason: '429' })
  })
})
