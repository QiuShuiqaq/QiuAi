import { describe, expect, it } from 'vitest'
import { createDeviceFingerprintService } from '../../main/src/services/deviceFingerprintService'

describe('createDeviceFingerprintService', () => {
  it('builds a stable device code from machine guid and volume serial', async () => {
    const service = createDeviceFingerprintService({
      readMachineGuid: async () => 'guid-123',
      readSystemDriveSerial: async () => 'abcd-0001'
    })

    const firstCode = await service.getDeviceCode()
    const secondCode = await service.getDeviceCode()

    expect(firstCode).toMatch(/^QAI(?:-[A-F0-9]{4}){8}$/)
    expect(firstCode).toBe(secondCode)
  })

  it('uses placeholders when device identifiers are missing', async () => {
    const service = createDeviceFingerprintService({
      readMachineGuid: async () => '',
      readSystemDriveSerial: async () => ''
    })

    await expect(service.getDeviceCode()).resolves.toMatch(/^QAI(?:-[A-F0-9]{4}){8}$/)
  })
})
