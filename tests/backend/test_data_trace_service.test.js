import { describe, expect, it, vi } from 'vitest'

describe('dataTraceService', () => {
  it('clears runtime trace files without removing output result directories', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined)

    const { createDataTraceService } = await import('../../main/src/services/dataTraceService.js')
    const service = createDataTraceService({
      writeFile,
      mkdir: vi.fn().mockResolvedValue(undefined)
    })

    const result = await service.clearRuntimeFiles()

    expect(writeFile).toHaveBeenCalledTimes(3)
    expect(writeFile).toHaveBeenCalledWith(service.messageFilePath, '', 'utf8')
    expect(writeFile).toHaveBeenCalledWith(service.logFilePath, '', 'utf8')
    expect(result.cleared).toBe(true)
  })
})
