# Permanent Device Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanent Windows single-device activation gate to QiuAi using a local signed license file.

**Architecture:** The main process will compute a Windows device code, validate a locally stored signed `license.qai`, and expose activation state over IPC. The renderer will show a lightweight activation screen until the license is valid, and all task creation entry points will reject execution when the app is not activated.

**Tech Stack:** Electron, Vue 3, Node.js `crypto`, `electron-store`, Vitest

---

### Task 1: Add Main-Process Device and License Services

**Files:**
- Create: `main/src/services/deviceFingerprintService.js`
- Create: `main/src/services/licenseService.js`
- Test: `tests/backend/test_device_fingerprint_service.test.js`
- Test: `tests/backend/test_license_service.test.js`

- [ ] **Step 1: Write the failing device fingerprint tests**

```js
const { describe, expect, it } = require('vitest')
const { createDeviceFingerprintService } = require('../../main/src/services/deviceFingerprintService')

describe('createDeviceFingerprintService', () => {
  it('builds a stable device code from machine guid and volume serial', async () => {
    const service = createDeviceFingerprintService({
      readMachineGuid: async () => 'guid-123',
      readSystemDriveSerial: async () => 'abcd-0001'
    })

    await expect(service.getDeviceCode()).resolves.toMatch(/^QAI-[A-F0-9-]+$/)
    await expect(service.getDeviceCode()).resolves.toBe(await service.getDeviceCode())
  })

  it('uses placeholders when a source field is missing', async () => {
    const service = createDeviceFingerprintService({
      readMachineGuid: async () => '',
      readSystemDriveSerial: async () => ''
    })

    await expect(service.getDeviceCode()).resolves.toMatch(/^QAI-[A-F0-9-]+$/)
  })
})
```

- [ ] **Step 2: Run the device fingerprint tests to verify RED**

Run: `npx vitest run tests/backend/test_device_fingerprint_service.test.js`  
Expected: FAIL because `deviceFingerprintService` does not exist yet.

- [ ] **Step 3: Write the failing license validation tests**

```js
const { describe, expect, it } = require('vitest')
const crypto = require('node:crypto')
const { createLicenseService } = require('../../main/src/services/licenseService')

describe('createLicenseService', () => {
  it('accepts a valid signed license bound to the current device', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const service = createLicenseService({
      publicKey: publicKey.export({ type: 'pkcs1', format: 'pem' }),
      getDeviceCode: async () => 'QAI-TEST-CODE',
      readFile: async () => JSON.stringify(signLicense(privateKey, {
        version: 1,
        customerName: 'Demo',
        deviceCode: 'QAI-TEST-CODE',
        activatedAt: '2026-04-29T12:00:00.000Z'
      }))
    })

    const result = await service.getActivationStatus()
    expect(result.status).toBe('activated')
    expect(result.customerName).toBe('Demo')
  })

  it('rejects a tampered license', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const signed = signLicense(privateKey, {
      version: 1,
      customerName: 'Demo',
      deviceCode: 'QAI-TEST-CODE',
      activatedAt: '2026-04-29T12:00:00.000Z'
    })
    signed.customerName = 'Tampered'

    const service = createLicenseService({
      publicKey: publicKey.export({ type: 'pkcs1', format: 'pem' }),
      getDeviceCode: async () => 'QAI-TEST-CODE',
      readFile: async () => JSON.stringify(signed)
    })

    const result = await service.getActivationStatus()
    expect(result.status).toBe('invalid')
  })
})
```

- [ ] **Step 4: Run the license tests to verify RED**

Run: `npx vitest run tests/backend/test_license_service.test.js`  
Expected: FAIL because `licenseService` does not exist yet.

- [ ] **Step 5: Write minimal service implementations**

```js
// deviceFingerprintService.js
function createDeviceFingerprintService ({ readMachineGuid, readSystemDriveSerial, createHash = crypto.createHash } = {}) {
  async function getDeviceCode () {
    const machineGuid = String(await readMachineGuid()).trim().toUpperCase() || 'UNKNOWN'
    const volumeSerial = String(await readSystemDriveSerial()).trim().toUpperCase() || 'UNKNOWN'
    const rawValue = `${machineGuid}::${volumeSerial}`
    const digest = createHash('sha256').update(rawValue).digest('hex').toUpperCase()
    return `QAI-${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}`
  }

  return { getDeviceCode }
}
```

```js
// licenseService.js
function createLicenseService ({ publicKey, getDeviceCode, readFile, writeFile, ensureDirectory, licenseFilePath }) {
  async function getActivationStatus () { /* validate json, signature, device match */ }
  async function importLicenseFromPath (sourcePath) { /* read + validate + persist */ }
  return { getActivationStatus, importLicenseFromPath, licenseFilePath }
}
```

- [ ] **Step 6: Run the new backend tests to verify GREEN**

Run: `npx vitest run tests/backend/test_device_fingerprint_service.test.js tests/backend/test_license_service.test.js`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add main/src/services/deviceFingerprintService.js main/src/services/licenseService.js tests/backend/test_device_fingerprint_service.test.js tests/backend/test_license_service.test.js
git commit -m "feat: add device lock backend services"
```

### Task 2: Expose Activation Over IPC and Block Main Task Entry Points

**Files:**
- Create: `main/src/ipc/licenseIpc.js`
- Modify: `shared/ipcChannels.js`
- Modify: `main/preload.js`
- Modify: `main/src/bootstrap/registerIpc.js`
- Modify: `main/src/ipc/studioIpc.js`
- Test: `tests/backend/test_license_ipc_source.test.js`
- Test: `tests/backend/test_studio_activation_guard.test.js`
- Test: `tests/backend/test_preload_source.test.js`

- [ ] **Step 1: Write failing IPC surface tests**

```js
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('license IPC source', () => {
  it('registers activation IPC channels and preload bridge methods', () => {
    const channelsSource = fs.readFileSync('shared/ipcChannels.js', 'utf8')
    const preloadSource = fs.readFileSync('main/preload.js', 'utf8')
    const registerSource = fs.readFileSync('main/src/bootstrap/registerIpc.js', 'utf8')

    expect(channelsSource).toContain('LICENSE_GET_STATUS')
    expect(channelsSource).toContain('LICENSE_IMPORT_FILE')
    expect(preloadSource).toContain('LICENSE_GET_STATUS')
    expect(registerSource).toContain('registerLicenseIpc')
  })
})
```

- [ ] **Step 2: Write failing activation guard tests**

```js
const { describe, expect, it, vi } = require('vitest')
const registerStudioIpc = require('../../main/src/ipc/studioIpc')

describe('registerStudioIpc activation guard', () => {
  it('refuses studio task creation when activation is invalid', async () => {
    const handlers = new Map()
    registerStudioIpc({
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
      studioWorkspaceService: { createTask: vi.fn() },
      activationGuard: { assertActivated: () => { throw new Error('未检测到授权文件') } }
    })

    await expect(handlers.get('studio:create-task')({}, {})).rejects.toThrow('未检测到授权文件')
  })
})
```

- [ ] **Step 3: Run focused tests to verify RED**

Run: `npx vitest run tests/backend/test_license_ipc_source.test.js tests/backend/test_preload_source.test.js tests/backend/test_studio_activation_guard.test.js`  
Expected: FAIL because the IPC surface and guard do not exist yet.

- [ ] **Step 4: Implement IPC channels and the activation guard**

```js
// shared/ipcChannels.js
LICENSE_GET_STATUS: 'license:get-status',
LICENSE_GET_DEVICE_CODE: 'license:get-device-code',
LICENSE_IMPORT_FILE: 'license:import-file',
LICENSE_REFRESH: 'license:refresh'
```

```js
// licenseIpc.js
ipcMain.handle(ipcChannels.LICENSE_GET_STATUS, () => licenseService.getActivationStatus())
ipcMain.handle(ipcChannels.LICENSE_GET_DEVICE_CODE, () => licenseService.getDeviceCodePayload())
ipcMain.handle(ipcChannels.LICENSE_IMPORT_FILE, (_event, payload = {}) => licenseService.importLicenseFromPath(payload.filePath))
ipcMain.handle(ipcChannels.LICENSE_REFRESH, () => licenseService.getActivationStatus())
```

```js
// studioIpc.js
await activationGuard.assertActivated()
return studioWorkspaceService.createTask(payload)
```

- [ ] **Step 5: Run focused tests to verify GREEN**

Run: `npx vitest run tests/backend/test_license_ipc_source.test.js tests/backend/test_preload_source.test.js tests/backend/test_studio_activation_guard.test.js`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add shared/ipcChannels.js main/preload.js main/src/bootstrap/registerIpc.js main/src/ipc/licenseIpc.js main/src/ipc/studioIpc.js tests/backend/test_license_ipc_source.test.js tests/backend/test_studio_activation_guard.test.js tests/backend/test_preload_source.test.js
git commit -m "feat: expose activation state over ipc"
```

### Task 3: Add Renderer Activation Screen and Status Wiring

**Files:**
- Create: `renderer/src/components/ActivationGate.vue`
- Modify: `renderer/src/services/desktopBridge.js`
- Modify: `renderer/src/App.vue`
- Test: `tests/renderer/desktopBridge.test.js`
- Test: `tests/renderer/appSource.test.js`
- Test: `tests/renderer/componentSource.test.js`

- [ ] **Step 1: Write failing renderer source tests**

```js
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('activation renderer source', () => {
  it('renders an activation gate before the workspace', () => {
    const appSource = fs.readFileSync('renderer/src/App.vue', 'utf8')
    const bridgeSource = fs.readFileSync('renderer/src/services/desktopBridge.js', 'utf8')

    expect(appSource).toContain('ActivationGate')
    expect(appSource).toContain('activationState')
    expect(bridgeSource).toContain('getActivationStatus')
    expect(bridgeSource).toContain('importLicenseFile')
  })
})
```

- [ ] **Step 2: Run focused renderer tests to verify RED**

Run: `npx vitest run tests/renderer/appSource.test.js tests/renderer/componentSource.test.js tests/renderer/desktopBridge.test.js`  
Expected: FAIL because activation renderer code does not exist yet.

- [ ] **Step 3: Implement the minimal activation UI**

```vue
<ActivationGate
  v-if="!isActivated"
  :activation-state="activationState"
  @copy-device-code="handleCopyDeviceCode"
  @import-license="handleImportLicense"
  @refresh-license="refreshActivationState"
/>
<template v-else>
  <!-- existing app layout -->
</template>
```

```js
export function getActivationStatus () {
  return invoke(getChannel('LICENSE_GET_STATUS'))
}

export function importLicenseFile (payload) {
  return invoke(getChannel('LICENSE_IMPORT_FILE'), payload)
}
```

- [ ] **Step 4: Run focused renderer tests to verify GREEN**

Run: `npx vitest run tests/renderer/appSource.test.js tests/renderer/componentSource.test.js tests/renderer/desktopBridge.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add renderer/src/components/ActivationGate.vue renderer/src/services/desktopBridge.js renderer/src/App.vue tests/renderer/appSource.test.js tests/renderer/componentSource.test.js tests/renderer/desktopBridge.test.js
git commit -m "feat: add activation gate ui"
```

### Task 4: Add Operator License Generator and Final Verification

**Files:**
- Create: `scripts/generate-license.js`
- Test: `tests/setup/test_license_generator_source.test.js`
- Modify: `START.txt`

- [ ] **Step 1: Write the failing generator source test**

```js
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('license generator source', () => {
  it('documents a local script for generating signed license files', () => {
    const source = fs.readFileSync('scripts/generate-license.js', 'utf8')
    expect(source).toContain('customerName')
    expect(source).toContain('deviceCode')
    expect(source).toContain('license.qai')
  })
})
```

- [ ] **Step 2: Run the test to verify RED**

Run: `npx vitest run tests/setup/test_license_generator_source.test.js`  
Expected: FAIL because the script does not exist yet.

- [ ] **Step 3: Implement the generator and update startup docs**

```js
#!/usr/bin/env node
const fs = require('node:fs')
const crypto = require('node:crypto')

// read customerName and deviceCode from argv
// sign payload with local private key
// write ./license.qai or target path
```

```txt
授权生成:
node scripts/generate-license.js --customer "客户" --device "QAI-XXXX" --out ./license.qai
```

- [ ] **Step 4: Run the test to verify GREEN**

Run: `npx vitest run tests/setup/test_license_generator_source.test.js`  
Expected: PASS

- [ ] **Step 5: Run full verification**

Run:
- `npm test`
- `npm run lint`

Expected:
- all tests pass
- lint passes

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-license.js tests/setup/test_license_generator_source.test.js START.txt
git commit -m "feat: add local license generator"
```
