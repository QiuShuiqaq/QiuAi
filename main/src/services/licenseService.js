const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

function getDefaultUserDataPath() {
  try {
    const { app } = require('electron')
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData')
    }
  } catch {
    // Electron not available in tests.
  }

  return process.cwd()
}

function getLicenseStoragePaths(userDataPath = getDefaultUserDataPath()) {
  const licenseDirectoryPath = path.resolve(userDataPath, 'license')
  return {
    licenseDirectoryPath,
    licenseFilePath: path.resolve(licenseDirectoryPath, 'license.qai')
  }
}

function getLicensePayload(record = {}) {
  return {
    version: record.version,
    customerName: record.customerName,
    deviceCode: record.deviceCode,
    activatedAt: record.activatedAt
  }
}

function createSignedLicenseRecord(payload, privateKey) {
  const normalizedPayload = {
    version: Number(payload.version) || 1,
    customerName: String(payload.customerName || '').trim(),
    deviceCode: String(payload.deviceCode || '').trim(),
    activatedAt: String(payload.activatedAt || new Date().toISOString())
  }
  const signature = crypto.sign(
    'sha256',
    Buffer.from(JSON.stringify(normalizedPayload)),
    privateKey
  ).toString('base64')

  return {
    ...normalizedPayload,
    signature
  }
}

function verifySignedLicenseRecord(record, publicKey) {
  const signature = typeof record.signature === 'string' ? record.signature.trim() : ''
  if (!signature) {
    return false
  }

  return crypto.verify(
    'sha256',
    Buffer.from(JSON.stringify(getLicensePayload(record))),
    publicKey,
    Buffer.from(signature, 'base64')
  )
}

function normalizeLicenseRecord(record = {}) {
  return {
    version: Number(record.version) || 1,
    customerName: String(record.customerName || '').trim(),
    deviceCode: String(record.deviceCode || '').trim(),
    activatedAt: String(record.activatedAt || '').trim(),
    signature: String(record.signature || '').trim()
  }
}

function createActivationStatus(status, overrides = {}) {
  return {
    status,
    customerName: '',
    deviceCode: '',
    activatedAt: '',
    message: '',
    ...overrides
  }
}

function createLicenseService({
  publicKey = '',
  getDeviceCode,
  readFile = fs.readFile,
  writeFile = fs.writeFile,
  ensureDirectory = (targetPath) => fs.mkdir(targetPath, { recursive: true }),
  licenseDirectoryPath = getLicenseStoragePaths().licenseDirectoryPath,
  licenseFilePath = getLicenseStoragePaths().licenseFilePath
} = {}) {
  if (typeof getDeviceCode !== 'function') {
    throw new Error('getDeviceCode is required.')
  }

  async function readStoredLicense(filePath = licenseFilePath) {
    const rawContent = await readFile(filePath, 'utf8')
    return normalizeLicenseRecord(JSON.parse(rawContent))
  }

  async function validateLicenseRecord(record) {
    const normalizedRecord = normalizeLicenseRecord(record)
    const currentDeviceCode = await getDeviceCode()

    if (!normalizedRecord.customerName || !normalizedRecord.deviceCode || !normalizedRecord.activatedAt || !normalizedRecord.signature) {
      return createActivationStatus('invalid', {
        message: '授权文件已损坏或格式无效',
        deviceCode: currentDeviceCode
      })
    }

    try {
      const isValid = verifySignedLicenseRecord(normalizedRecord, publicKey)
      if (!isValid) {
        return createActivationStatus('invalid', {
          message: '授权校验失败，请重新导入授权文件',
          deviceCode: currentDeviceCode
        })
      }
    } catch {
      return createActivationStatus('invalid', {
        message: '授权校验失败，请重新导入授权文件',
        deviceCode: currentDeviceCode
      })
    }

    if (normalizedRecord.deviceCode !== currentDeviceCode) {
      return createActivationStatus('mismatch', {
        customerName: normalizedRecord.customerName,
        deviceCode: currentDeviceCode,
        activatedAt: normalizedRecord.activatedAt,
        message: '当前设备与授权不匹配'
      })
    }

    return createActivationStatus('activated', {
      customerName: normalizedRecord.customerName,
      deviceCode: currentDeviceCode,
      activatedAt: normalizedRecord.activatedAt,
      message: ''
    })
  }

  async function getActivationStatus() {
    try {
      const licenseRecord = await readStoredLicense()
      return validateLicenseRecord(licenseRecord)
    } catch (error) {
      if (error && (error.code === 'ENOENT' || /no such file/i.test(String(error.message || '')))) {
        return createActivationStatus('not_found', {
          deviceCode: await getDeviceCode(),
          message: '未检测到授权文件'
        })
      }

      if (error instanceof SyntaxError) {
        return createActivationStatus('invalid', {
          deviceCode: await getDeviceCode(),
          message: '授权文件已损坏或格式无效'
        })
      }

      return createActivationStatus('invalid', {
        deviceCode: await getDeviceCode(),
        message: '授权校验失败，请重新导入授权文件'
      })
    }
  }

  async function importLicenseFromFile({ filePath }) {
    if (!filePath) {
      throw new Error('License file path is required.')
    }

    const licenseRecord = await readStoredLicense(filePath)
    const activationStatus = await validateLicenseRecord(licenseRecord)

    if (activationStatus.status !== 'activated') {
      return activationStatus
    }

    await ensureDirectory(licenseDirectoryPath)
    await writeFile(licenseFilePath, JSON.stringify(licenseRecord, null, 2), 'utf8')

    return {
      ...activationStatus,
      message: '导入授权成功'
    }
  }

  async function getDeviceCodePayload() {
    return {
      deviceCode: await getDeviceCode()
    }
  }

  return {
    getActivationStatus,
    getDeviceCodePayload,
    importLicenseFromFile,
    licenseDirectoryPath,
    licenseFilePath
  }
}

module.exports = {
  createLicenseService,
  createSignedLicenseRecord,
  getLicensePayload,
  getLicenseStoragePaths,
  normalizeLicenseRecord,
  verifySignedLicenseRecord
}
