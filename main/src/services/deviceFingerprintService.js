const crypto = require('node:crypto')
const os = require('node:os')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)

function normalizeFingerprintValue(value) {
  const normalizedValue = String(value || '').trim().toUpperCase()
  return normalizedValue || 'UNKNOWN'
}

async function readMachineGuidFromWindows() {
  if (process.platform !== 'win32') {
    return ''
  }

  const { stdout = '' } = await execFileAsync('reg', [
    'query',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography',
    '/v',
    'MachineGuid'
  ], {
    windowsHide: true
  })
  const match = stdout.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i)
  return match ? match[1].trim() : ''
}

async function readSystemDriveSerialFromWindows() {
  if (process.platform !== 'win32') {
    return ''
  }

  const systemDrive = String(process.env.SystemDrive || 'C:').trim() || 'C:'
  const { stdout = '' } = await execFileAsync('cmd.exe', [
    '/d',
    '/c',
    `vol ${systemDrive}`
  ], {
    windowsHide: true
  })
  const match = stdout.match(/([A-F0-9]{4}-[A-F0-9]{4})/i)
  return match ? match[1].trim() : ''
}

function formatDeviceCodeFromDigest(digest) {
  const groups = String(digest || '')
    .toUpperCase()
    .slice(0, 32)
    .match(/.{1,4}/g) || []

  return `QAI-${groups.join('-')}`
}

function createDeviceFingerprintService({
  readMachineGuid = readMachineGuidFromWindows,
  readSystemDriveSerial = readSystemDriveSerialFromWindows,
  createHash = crypto.createHash,
  platform = process.platform,
  hostname = os.hostname
} = {}) {
  async function getDeviceCode() {
    const [machineGuid, volumeSerial] = await Promise.all([
      readMachineGuid(),
      readSystemDriveSerial()
    ])
    const rawFingerprint = [
      platform,
      normalizeFingerprintValue(machineGuid),
      normalizeFingerprintValue(volumeSerial),
      normalizeFingerprintValue(hostname())
    ].join('::')
    const digest = createHash('sha256')
      .update(rawFingerprint)
      .digest('hex')

    return formatDeviceCodeFromDigest(digest)
  }

  return {
    getDeviceCode
  }
}

module.exports = {
  createDeviceFingerprintService,
  formatDeviceCodeFromDigest,
  normalizeFingerprintValue,
  readMachineGuidFromWindows,
  readSystemDriveSerialFromWindows
}
