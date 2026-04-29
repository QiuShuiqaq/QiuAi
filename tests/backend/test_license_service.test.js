import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLicenseService } from '../../main/src/services/licenseService'

function signPayload(privateKey, payload) {
  const payloadString = JSON.stringify(payload)
  const signature = crypto.sign('sha256', Buffer.from(payloadString), privateKey).toString('base64')

  return {
    ...payload,
    signature
  }
}

describe('createLicenseService', () => {
  let keyPair

  beforeEach(() => {
    keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  })

  it('accepts a valid signed license bound to the current device', async () => {
    const payload = signPayload(keyPair.privateKey, {
      version: 1,
      customerName: 'Demo Customer',
      deviceCode: 'QAI-TEST-CODE',
      activatedAt: '2026-04-29T12:00:00.000Z'
    })
    const service = createLicenseService({
      publicKey: keyPair.publicKey.export({ type: 'pkcs1', format: 'pem' }),
      getDeviceCode: async () => 'QAI-TEST-CODE',
      readFile: vi.fn().mockResolvedValue(JSON.stringify(payload)),
      writeFile: vi.fn(),
      ensureDirectory: vi.fn(),
      licenseFilePath: 'C:/QiuAi/license.qai'
    })

    const result = await service.getActivationStatus()

    expect(result.status).toBe('activated')
    expect(result.customerName).toBe('Demo Customer')
    expect(result.deviceCode).toBe('QAI-TEST-CODE')
  })

  it('rejects a tampered license payload', async () => {
    const signed = signPayload(keyPair.privateKey, {
      version: 1,
      customerName: 'Demo Customer',
      deviceCode: 'QAI-TEST-CODE',
      activatedAt: '2026-04-29T12:00:00.000Z'
    })
    const tampered = {
      ...signed,
      customerName: 'Changed Name'
    }
    const service = createLicenseService({
      publicKey: keyPair.publicKey.export({ type: 'pkcs1', format: 'pem' }),
      getDeviceCode: async () => 'QAI-TEST-CODE',
      readFile: vi.fn().mockResolvedValue(JSON.stringify(tampered)),
      writeFile: vi.fn(),
      ensureDirectory: vi.fn(),
      licenseFilePath: 'C:/QiuAi/license.qai'
    })

    const result = await service.getActivationStatus()

    expect(result.status).toBe('invalid')
    expect(result.message).toMatch(/授权文件已损坏|授权校验失败/)
  })

  it('rejects a valid license from another device', async () => {
    const payload = signPayload(keyPair.privateKey, {
      version: 1,
      customerName: 'Demo Customer',
      deviceCode: 'QAI-OTHER-DEVICE',
      activatedAt: '2026-04-29T12:00:00.000Z'
    })
    const service = createLicenseService({
      publicKey: keyPair.publicKey.export({ type: 'pkcs1', format: 'pem' }),
      getDeviceCode: async () => 'QAI-TEST-CODE',
      readFile: vi.fn().mockResolvedValue(JSON.stringify(payload)),
      writeFile: vi.fn(),
      ensureDirectory: vi.fn(),
      licenseFilePath: 'C:/QiuAi/license.qai'
    })

    const result = await service.getActivationStatus()

    expect(result.status).toBe('mismatch')
    expect(result.message).toBe('当前设备与授权不匹配')
  })

  it('persists an imported valid license file', async () => {
    const payload = signPayload(keyPair.privateKey, {
      version: 1,
      customerName: 'Demo Customer',
      deviceCode: 'QAI-TEST-CODE',
      activatedAt: '2026-04-29T12:00:00.000Z'
    })
    const readSourceFile = vi.fn().mockResolvedValue(JSON.stringify(payload))
    const ensureDirectory = vi.fn()
    const writeFile = vi.fn()
    const service = createLicenseService({
      publicKey: keyPair.publicKey.export({ type: 'pkcs1', format: 'pem' }),
      getDeviceCode: async () => 'QAI-TEST-CODE',
      readFile: readSourceFile,
      writeFile,
      ensureDirectory,
      licenseDirectoryPath: 'C:/QiuAi/license',
      licenseFilePath: 'C:/QiuAi/license/license.qai'
    })

    const result = await service.importLicenseFromFile({
      filePath: 'D:/Downloads/license.qai'
    })

    expect(result.status).toBe('activated')
    expect(ensureDirectory).toHaveBeenCalledWith('C:/QiuAi/license')
    expect(writeFile).toHaveBeenCalledWith('C:/QiuAi/license/license.qai', JSON.stringify(payload, null, 2), 'utf8')
  })
})
