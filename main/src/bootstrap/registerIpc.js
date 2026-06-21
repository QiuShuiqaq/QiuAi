const Store = require('electron-store')
const registerSettingsIpc = require('../ipc/settingsIpc')
const registerDrawIpc = require('../ipc/drawIpc')
const registerLicenseIpc = require('../ipc/licenseIpc')
const registerPromptIpc = require('../ipc/promptIpc')
const registerNegativePromptTemplateIpc = require('../ipc/negativePromptTemplateIpc')
const registerStudioIpc = require('../ipc/studioIpc')
const { createDeviceFingerprintService } = require('../services/deviceFingerprintService')
const { createLicenseService } = require('../services/licenseService')
const { LICENSE_PUBLIC_KEY } = require('../services/licensePublicKey')
const { createActivationGuardService } = require('../services/activationGuardService')
const { createSettingsStoreService } = require('../services/settingsStoreService')
const { createApiKeyCreditService } = require('../services/apiKeyCreditService')
const { createPromptTemplateStoreService } = require('../services/promptTemplateStoreService')
const { createNegativePromptTemplateStoreService } = require('../services/negativePromptTemplateStoreService')
const { createStudioWorkspaceService } = require('../services/studioWorkspaceService')
const { createStudioTaskManagerService } = require('../services/studioTaskManagerService')
const { createDataTraceService } = require('../services/dataTraceService')
const { attachConsoleCapture } = require('../services/consoleCaptureService')
const { ensureDataLayout } = require('../services/dataPathsService')

function registerIpc () {
  ensureDataLayout().catch(() => {})
  const settingsStore = new Store({ name: 'qiuai-settings' })
  const promptStore = new Store({ name: 'qiuai-prompts' })
  const negativePromptStore = new Store({ name: 'qiuai-negative-prompts' })
  const studioStore = new Store({ name: 'qiuai-studio' })
  const dataTraceService = createDataTraceService()
  attachConsoleCapture({
    runtimeLogger: dataTraceService
  })
  const deviceFingerprintService = createDeviceFingerprintService()
  const settingsService = createSettingsStoreService({ store: settingsStore })
  const apiKeyCreditService = createApiKeyCreditService({
    settingsService,
    messageRecorder: dataTraceService,
    requestMetricRecorder: async () => {}
  })
  const licenseService = createLicenseService({
    publicKey: LICENSE_PUBLIC_KEY,
    getDeviceCode: () => deviceFingerprintService.getDeviceCode()
  })
  const activationGuard = createActivationGuardService({
    licenseService
  })
  const promptTemplateService = createPromptTemplateStoreService({ store: promptStore })
  const negativePromptTemplateService = createNegativePromptTemplateStoreService({ store: negativePromptStore })
  const studioTaskManagerService = createStudioTaskManagerService()
  const studioWorkspaceService = createStudioWorkspaceService({
    store: studioStore,
    settingsService,
    apiKeyCreditService,
    promptTemplateService,
    messageRecorder: dataTraceService,
    runtimeLogger: dataTraceService,
    taskManagerService: studioTaskManagerService
  })

  registerSettingsIpc({ settingsService })
  registerLicenseIpc({ licenseService })
  registerDrawIpc({
    settingsService,
    messageRecorder: dataTraceService,
    runtimeLogger: dataTraceService,
    activationGuard
  })
  registerPromptIpc({ promptTemplateService })
  registerNegativePromptTemplateIpc({ negativePromptTemplateService })
  registerStudioIpc({
    studioWorkspaceService,
    settingsService,
    dataTraceService,
    activationGuard
  })

  return {
    licenseService,
    studioTaskManagerService,
    studioWorkspaceService
  }
}

module.exports = registerIpc
