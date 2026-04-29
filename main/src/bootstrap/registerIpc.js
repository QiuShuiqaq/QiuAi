const Store = require('electron-store')
const registerSettingsIpc = require('../ipc/settingsIpc')
const registerDrawIpc = require('../ipc/drawIpc')
const registerLicenseIpc = require('../ipc/licenseIpc')
const registerPromptIpc = require('../ipc/promptIpc')
const registerTaskIpc = require('../ipc/taskIpc')
const registerStudioIpc = require('../ipc/studioIpc')
const { createDeviceFingerprintService } = require('../services/deviceFingerprintService')
const { createLicenseService } = require('../services/licenseService')
const { LICENSE_PUBLIC_KEY } = require('../services/licensePublicKey')
const { createActivationGuardService } = require('../services/activationGuardService')
const { createSettingsStoreService } = require('../services/settingsStoreService')
const { createPromptTemplateStoreService } = require('../services/promptTemplateStoreService')
const { createLocalTaskStoreService } = require('../services/localTaskStoreService')
const { createStudioWorkspaceService } = require('../services/studioWorkspaceService')
const { createStudioTaskManagerService } = require('../services/studioTaskManagerService')
const { createTaskModeService } = require('../services/taskModeService')
const { createTaskRunnerService } = require('../services/taskRunnerService')
const { exportTaskDirectory } = require('../services/taskExportService')
const { createDataTraceService } = require('../services/dataTraceService')
const { attachConsoleCapture } = require('../services/consoleCaptureService')
const { ensureDataLayout } = require('../services/dataPathsService')

function registerIpc () {
  ensureDataLayout().catch(() => {})
  const settingsStore = new Store({ name: 'qiuai-settings' })
  const promptStore = new Store({ name: 'qiuai-prompts' })
  const taskStore = new Store({ name: 'qiuai-tasks' })
  const studioStore = new Store({ name: 'qiuai-studio' })
  const dataTraceService = createDataTraceService()
  attachConsoleCapture({
    runtimeLogger: dataTraceService
  })
  const deviceFingerprintService = createDeviceFingerprintService()
  const settingsService = createSettingsStoreService({ store: settingsStore })
  const licenseService = createLicenseService({
    publicKey: LICENSE_PUBLIC_KEY,
    getDeviceCode: () => deviceFingerprintService.getDeviceCode()
  })
  const activationGuard = createActivationGuardService({
    licenseService
  })
  const promptTemplateService = createPromptTemplateStoreService({ store: promptStore })
  const localTaskStoreService = createLocalTaskStoreService({ store: taskStore })
  const studioTaskManagerService = createStudioTaskManagerService()
  const studioWorkspaceService = createStudioWorkspaceService({
    store: studioStore,
    settingsService,
    promptTemplateService,
    messageRecorder: dataTraceService,
    runtimeLogger: dataTraceService,
    taskManagerService: studioTaskManagerService
  })
  const taskModeService = createTaskModeService()
  const taskRunnerService = createTaskRunnerService({
    localTaskStoreService,
    runtimeLogger: dataTraceService
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
  registerTaskIpc({
    settingsService,
    promptTemplateService,
    localTaskStoreService,
    taskModeService,
    taskRunnerService,
    exportTaskDirectory,
    messageRecorder: dataTraceService,
    runtimeLogger: dataTraceService,
    activationGuard
  })
  registerStudioIpc({
    studioWorkspaceService,
    settingsService,
    dataTraceService,
    activationGuard
  })

  return {
    licenseService,
    studioTaskManagerService,
    studioWorkspaceService,
    taskRunnerService
  }
}

module.exports = registerIpc
