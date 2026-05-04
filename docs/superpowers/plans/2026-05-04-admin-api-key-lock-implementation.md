# QiuAi API-Key 用户锁定与管理员隐藏维护 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock API-Key management away from normal users, require hidden admin password verification before any API-Key editing, and keep current image-generation behavior working with a single maintained key.

**Architecture:** Keep the existing settings store and generation services intact, but split API-Key writes into a new admin-only path. The renderer removes all normal API-Key editing UI, adds a hidden Logo-triggered admin unlock flow, and uses dedicated dialogs plus a dedicated IPC route for saving the single maintained API-Key.

**Tech Stack:** Electron, Vue 3, Vite, Vitest

---

## File Structure

### Existing files to modify

- `main/src/services/settingsStoreService.js`
  - Add sensitive field blocking in normal `saveSettings()`
  - Add `saveAdminApiKey()` helper with password validation and single-key persistence
- `main/src/ipc/settingsIpc.js`
  - Register new admin API-Key save IPC handler
- `renderer/src/services/desktopBridge.js`
  - Expose new admin API-Key save bridge function
- `renderer/src/App.vue`
  - Remove normal API-Key edit flow
  - Add hidden Logo click counter, password dialog state, admin dialog state, and new save flow
- `renderer/src/components/AppTopBar.vue`
  - Ensure brand click event remains available for hidden admin trigger wiring
- `renderer/src/components/WorkspaceDashboard.vue`
  - Replace editable API-Key panel with static service configuration status content
- `renderer/src/assets/styles.css`
  - Add dialog styles if new admin modal classes are introduced
- `tests/backend/test_settings_store_service.test.js`
  - Add permission and admin-save coverage
- `tests/renderer/appSource.test.js`
  - Add source assertions for hidden admin flow and removal of normal API-Key editing
- `tests/renderer/componentSource.test.js`
  - Add source assertions for dashboard replacement and admin dialogs
- `tests/renderer/desktopBridge.test.js`
  - Add bridge test for new admin save IPC

### New files to create

- `renderer/src/components/AdminPasswordDialog.vue`
  - Password verification dialog
- `renderer/src/components/AdminApiKeyDialog.vue`
  - Admin-only single API-Key edit dialog

---

### Task 1: Lock normal settings writes away from API-Key fields

**Files:**
- Modify: `main/src/services/settingsStoreService.js`
- Test: `tests/backend/test_settings_store_service.test.js`

- [ ] **Step 1: Write the failing backend tests**

Add tests like:

```js
  it('rejects normal settings saves that try to modify api key fields', async () => {
    const memory = new Map()
    const store = {
      get (key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set (key, value) {
        memory.set(key, value)
      }
    }

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    await expect(service.saveSettings({
      apiKey: 'sk-blocked'
    })).rejects.toThrow('当前版本不允许用户修改 API-Key')

    await expect(service.saveSettings({
      apiKeys: ['sk-blocked', '']
    })).rejects.toThrow('当前版本不允许用户修改 API-Key')

    await expect(service.saveSettings({
      activeApiKeyIndex: 1
    })).rejects.toThrow('当前版本不允许用户修改 API-Key')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/backend/test_settings_store_service.test.js
```

Expected: FAIL because `saveSettings()` still accepts API-Key fields.

- [ ] **Step 3: Write the minimal implementation**

In `main/src/services/settingsStoreService.js`, add a small guard near the start of `saveSettings()`:

```js
    const hasSensitiveApiKeyFields = ['apiKeys', 'apiKey', 'activeApiKeyIndex'].some((field) => {
      return Object.prototype.hasOwnProperty.call(payload || {}, field)
    })

    if (hasSensitiveApiKeyFields) {
      throw new Error('当前版本不允许用户修改 API-Key')
    }
```

Keep this guard inside normal `saveSettings()` only. Do not change generation read paths.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/backend/test_settings_store_service.test.js
```

Expected: PASS for the new rejection coverage.

- [ ] **Step 5: Commit**

```bash
git add main/src/services/settingsStoreService.js tests/backend/test_settings_store_service.test.js
git commit -m "feat: block normal api key setting updates"
```

### Task 2: Add admin-only API-Key save service and IPC route

**Files:**
- Modify: `main/src/services/settingsStoreService.js`
- Modify: `main/src/ipc/settingsIpc.js`
- Test: `tests/backend/test_settings_store_service.test.js`

- [ ] **Step 1: Write the failing backend tests for admin save**

Add tests like:

```js
  it('rejects admin api key save when password is incorrect', async () => {
    const memory = new Map()
    const store = {
      get (key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set (key, value) {
        memory.set(key, value)
      }
    }

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    await expect(service.saveAdminApiKey({
      apiKey: 'sk-admin',
      password: 'wrong'
    })).rejects.toThrow('管理员验证失败：密码错误')
  })

  it('saves a single admin api key into slot 0 and fixes the active index', async () => {
    const memory = new Map()
    const store = {
      get (key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set (key, value) {
        memory.set(key, value)
      }
    }

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    const saved = await service.saveAdminApiKey({
      apiKey: 'sk-admin-real',
      password: 'qiuai@123'
    })

    expect(saved.apiKeys[0]).toBe('sk-admin-real')
    expect(saved.activeApiKeyIndex).toBe(0)
    expect(saved.apiKey).toBe('sk-admin-real')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/backend/test_settings_store_service.test.js
```

Expected: FAIL because `saveAdminApiKey()` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

In `main/src/services/settingsStoreService.js`, add:

```js
const ADMIN_API_KEY_PASSWORD = 'qiuai@123'
```

and:

```js
  async function saveAdminApiKey ({ apiKey = '', password = '' } = {}) {
    if (password !== ADMIN_API_KEY_PASSWORD) {
      throw new Error('管理员验证失败：密码错误')
    }

    const normalizedApiKey = typeof apiKey === 'string' ? apiKey.trim() : ''
    if (!normalizedApiKey) {
      throw new Error('API-Key 不能为空')
    }

    const currentSettings = getSettings()
    const nextApiKeys = normalizeApiKeys([normalizedApiKey, ''])

    const nextSettings = normalizeSettings({
      ...currentSettings,
      apiKeys: nextApiKeys,
      activeApiKeyIndex: 0,
      apiKey: normalizedApiKey
    })

    store.set(SETTINGS_KEY, nextSettings)
    return nextSettings
  }
```

Return it from the service object:

```js
  return {
    getSettings,
    saveSettings,
    saveAdminApiKey
  }
```

Then in `main/src/ipc/settingsIpc.js`, register:

```js
  ipcMain.handle(channels.SETTINGS_SAVE_ADMIN_API_KEY, async (_event, payload = {}) => {
    return settingsService.saveAdminApiKey(payload)
  })
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/backend/test_settings_store_service.test.js
```

Expected: PASS for incorrect password and successful save coverage.

- [ ] **Step 5: Commit**

```bash
git add main/src/services/settingsStoreService.js main/src/ipc/settingsIpc.js tests/backend/test_settings_store_service.test.js
git commit -m "feat: add admin-only api key save path"
```

### Task 3: Expose the admin save path through the desktop bridge

**Files:**
- Modify: `renderer/src/services/desktopBridge.js`
- Test: `tests/renderer/desktopBridge.test.js`

- [ ] **Step 1: Write the failing bridge test**

Add a test like:

```js
  it('invokes the admin api key save channel through the desktop bridge', async () => {
    const invoke = vi.fn(async () => ({ apiKey: 'sk-admin-real' }))
    global.window = {
      qiuai: {
        channels: {
          SETTINGS_SAVE_ADMIN_API_KEY: 'settings:save-admin-api-key'
        },
        invoke
      }
    }

    const { saveAdminApiKey } = await import('../../renderer/src/services/desktopBridge.js')

    await saveAdminApiKey({
      apiKey: 'sk-admin-real',
      password: 'qiuai@123'
    })

    expect(invoke).toHaveBeenCalledWith('settings:save-admin-api-key', {
      apiKey: 'sk-admin-real',
      password: 'qiuai@123'
    })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/renderer/desktopBridge.test.js
```

Expected: FAIL because `saveAdminApiKey()` and the channel mapping do not exist.

- [ ] **Step 3: Write the minimal implementation**

In `renderer/src/services/desktopBridge.js`, add channel support and export:

```js
export function saveAdminApiKey (payload) {
  if (hasBridge()) {
    return window.qiuai.invoke(window.qiuai.channels.SETTINGS_SAVE_ADMIN_API_KEY, normalizeForIpc(payload))
  }

  throw new Error('QiuAi desktop bridge is unavailable.')
}
```

If this file uses a channels constant object, add:

```js
SETTINGS_SAVE_ADMIN_API_KEY: 'settings:save-admin-api-key'
```

Do not add browser fallback write support for admin key save. It should fail without the desktop bridge.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/renderer/desktopBridge.test.js
```

Expected: PASS for the new bridge call.

- [ ] **Step 5: Commit**

```bash
git add renderer/src/services/desktopBridge.js tests/renderer/desktopBridge.test.js
git commit -m "feat: expose admin api key bridge action"
```

### Task 4: Replace the workbench API-Key editor with a static service status panel

**Files:**
- Modify: `renderer/src/components/WorkspaceDashboard.vue`
- Test: `tests/renderer/componentSource.test.js`
- Test: `tests/renderer/appSource.test.js`

- [ ] **Step 1: Write the failing source tests**

Add assertions like:

```js
    expect(dashboardSource).toContain('服务配置状态')
    expect(dashboardSource).toContain('API 已由服务方预配置')
    expect(dashboardSource).toContain('如需更换配置，请联系服务方')
    expect(dashboardSource).not.toContain('API-Key 1')
    expect(dashboardSource).not.toContain('API-Key 2')
    expect(dashboardSource).not.toContain('启用 Key 1')
    expect(dashboardSource).not.toContain('启用 Key 2')
    expect(dashboardSource).not.toContain('保存配置')
```

Also add `App.vue` assertions removing normal API key save handlers from the dashboard path.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/renderer/componentSource.test.js tests/renderer/appSource.test.js
```

Expected: FAIL because the dashboard still contains editable API-Key content.

- [ ] **Step 3: Write the minimal implementation**

In `renderer/src/components/WorkspaceDashboard.vue`:

- Remove the editable API-Key section content
- Replace it with static copy:

```vue
<section class="dashboard-card dashboard-card--api-config">
  <header class="dashboard-card__header">
    <h2>服务配置状态</h2>
  </header>
  <div class="dashboard-service-config">
    <strong>API 已由服务方预配置</strong>
    <p>如需更换配置，请联系服务方。</p>
  </div>
</section>
```

Remove unused emits and handlers related to:

- `update-api-key`
- `switch-api-key`
- `save-api-config`

Then remove the corresponding event wiring from `DesignWorkspace.vue` and `App.vue`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/renderer/componentSource.test.js tests/renderer/appSource.test.js
```

Expected: PASS for the dashboard replacement assertions.

- [ ] **Step 5: Commit**

```bash
git add renderer/src/components/WorkspaceDashboard.vue renderer/src/components/DesignWorkspace.vue renderer/src/App.vue tests/renderer/componentSource.test.js tests/renderer/appSource.test.js
git commit -m "refactor: remove normal api key editing from dashboard"
```

### Task 5: Add admin password dialog and admin API-Key dialog components

**Files:**
- Create: `renderer/src/components/AdminPasswordDialog.vue`
- Create: `renderer/src/components/AdminApiKeyDialog.vue`
- Modify: `renderer/src/assets/styles.css`
- Test: `tests/renderer/componentSource.test.js`

- [ ] **Step 1: Write the failing source tests**

Add assertions like:

```js
    const passwordDialogSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/AdminPasswordDialog.vue'), 'utf8')
    const apiKeyDialogSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/AdminApiKeyDialog.vue'), 'utf8')

    expect(passwordDialogSource).toContain('管理员验证')
    expect(passwordDialogSource).toContain('请输入管理员密码')
    expect(passwordDialogSource).toContain('qiuai@123')
    expect(passwordDialogSource).toContain('确认')
    expect(passwordDialogSource).toContain('取消')

    expect(apiKeyDialogSource).toContain('管理员 API-Key 配置')
    expect(apiKeyDialogSource).toContain('API-Key')
    expect(apiKeyDialogSource).toContain('保存')
```

And style assertions like:

```js
    expect(styleSource).toContain('.admin-password-modal')
    expect(styleSource).toContain('.admin-api-key-modal')
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/renderer/componentSource.test.js tests/renderer/stylesSource.test.js
```

Expected: FAIL because the new dialog files and styles do not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `renderer/src/components/AdminPasswordDialog.vue` with:

```vue
<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    default: ''
  },
  isSubmitting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update-password', 'confirm', 'close'])
</script>

<template>
  <div v-if="visible" class="admin-password-modal" @click.self="emit('close')">
    <div class="admin-password-modal__card">
      <header class="admin-password-modal__header">
        <strong>管理员验证</strong>
        <span>请输入管理员密码</span>
      </header>
      <input
        :value="password"
        class="admin-password-modal__input"
        type="password"
        placeholder="请输入管理员密码"
        @input="emit('update-password', $event.target.value)"
      />
      <footer class="admin-password-modal__actions">
        <button class="secondary-action" type="button" @click="emit('close')">取消</button>
        <button class="primary-action" type="button" :disabled="isSubmitting" @click="emit('confirm')">确认</button>
      </footer>
    </div>
  </div>
</template>
```

Create `renderer/src/components/AdminApiKeyDialog.vue` with:

```vue
<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  apiKey: {
    type: String,
    default: ''
  },
  isSaving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update-api-key', 'save', 'close'])
</script>

<template>
  <div v-if="visible" class="admin-api-key-modal" @click.self="emit('close')">
    <div class="admin-api-key-modal__card">
      <header class="admin-api-key-modal__header">
        <strong>管理员 API-Key 配置</strong>
      </header>
      <input
        :value="apiKey"
        class="admin-api-key-modal__input"
        type="text"
        placeholder="请输入 API-Key"
        @input="emit('update-api-key', $event.target.value)"
      />
      <footer class="admin-api-key-modal__actions">
        <button class="secondary-action" type="button" @click="emit('close')">关闭</button>
        <button class="primary-action" type="button" :disabled="isSaving" @click="emit('save')">保存</button>
      </footer>
    </div>
  </div>
</template>
```

Add matching modal styles in `renderer/src/assets/styles.css`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/renderer/componentSource.test.js tests/renderer/stylesSource.test.js
```

Expected: PASS for the new dialog and style assertions.

- [ ] **Step 5: Commit**

```bash
git add renderer/src/components/AdminPasswordDialog.vue renderer/src/components/AdminApiKeyDialog.vue renderer/src/assets/styles.css tests/renderer/componentSource.test.js tests/renderer/stylesSource.test.js
git commit -m "feat: add admin api key dialogs"
```

### Task 6: Wire hidden Logo trigger, password verification flow, and admin save flow in App.vue

**Files:**
- Modify: `renderer/src/App.vue`
- Modify: `renderer/src/components/AppTopBar.vue`
- Test: `tests/renderer/appSource.test.js`

- [ ] **Step 1: Write the failing source tests**

Add assertions like:

```js
    expect(source).toContain('AdminPasswordDialog')
    expect(source).toContain('AdminApiKeyDialog')
    expect(source).toContain('adminLogoClickCount')
    expect(source).toContain('handleBrandClick')
    expect(source).toContain('if (adminLogoClickCount.value >= 5)')
    expect(source).toContain('isAdminPasswordDialogVisible')
    expect(source).toContain('isAdminApiConfigUnlocked')
    expect(source).toContain('handleConfirmAdminPassword')
    expect(source).toContain('saveAdminApiKey')
    expect(source).toContain('管理员验证失败：密码错误')
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/renderer/appSource.test.js
```

Expected: FAIL because `App.vue` does not yet contain the new hidden admin flow.

- [ ] **Step 3: Write the minimal implementation**

In `renderer/src/App.vue`:

- Import both admin dialogs and `saveAdminApiKey`
- Add state:

```js
const adminLogoClickCount = ref(0)
const isAdminPasswordDialogVisible = ref(false)
const isAdminPasswordSubmitting = ref(false)
const adminPasswordDraft = ref('')
const isAdminApiConfigUnlocked = ref(false)
const isAdminApiKeyDialogVisible = ref(false)
const adminApiKeyDraft = ref('')
const isAdminApiKeySaving = ref(false)
```

- Update `handleBrandClick()`:

```js
function handleBrandClick() {
  activeMenu.value = 'workspace'
  adminLogoClickCount.value += 1

  if (adminLogoClickCount.value >= 5) {
    adminLogoClickCount.value = 0
    adminPasswordDraft.value = ''
    isAdminPasswordDialogVisible.value = true
  }
}
```

- Add password confirm handler:

```js
function handleConfirmAdminPassword() {
  isAdminPasswordSubmitting.value = true

  if (adminPasswordDraft.value !== 'qiuai@123') {
    isAdminPasswordSubmitting.value = false
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: '管理员验证失败：密码错误'
    })
    return
  }

  isAdminPasswordSubmitting.value = false
  isAdminPasswordDialogVisible.value = false
  isAdminApiConfigUnlocked.value = true
  isAdminApiKeyDialogVisible.value = true
}
```

- Add admin save handler:

```js
async function handleSaveAdminApiKey() {
  isAdminApiKeySaving.value = true

  try {
    const savedSettings = await saveAdminApiKey({
      apiKey: adminApiKeyDraft.value,
      password: adminPasswordDraft.value
    })

    adminApiKeyDraft.value = savedSettings.apiKey || ''
    isAdminApiConfigUnlocked.value = true
    showActionFeedback({
      type: 'success',
      title: '成功',
      message: 'API-Key 已更新'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '失败',
      message: `管理员保存 API-Key 失败：${buildErrorMessage(error, '保存未完成')}`
    })
  } finally {
    isAdminApiKeySaving.value = false
  }
}
```

- When loading settings, set:

```js
adminApiKeyDraft.value = settings.apiKey || ''
```

- Render the dialogs in the template and wire events.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/renderer/appSource.test.js
```

Expected: PASS for hidden trigger and admin flow assertions.

- [ ] **Step 5: Commit**

```bash
git add renderer/src/App.vue renderer/src/components/AppTopBar.vue tests/renderer/appSource.test.js
git commit -m "feat: add hidden admin api key unlock flow"
```

### Task 7: Update renderer source expectations for removed normal API-Key interactions

**Files:**
- Modify: `tests/renderer/componentSource.test.js`
- Modify: `tests/renderer/appSource.test.js`
- Modify: `tests/renderer/desktopBridge.test.js`

- [ ] **Step 1: Write or refine the remaining failing assertions**

Add and align assertions for:

```js
expect(appSource).not.toContain('handleSaveApiConfig')
expect(appSource).not.toContain('handleApiKeyUpdate')
expect(appSource).not.toContain('handleSwitchApiKey')
expect(dashboardSource).not.toContain('apiConfigState.apiKeys[0]')
expect(dashboardSource).not.toContain('apiConfigState.apiKeys[1]')
```

If the bridge tests currently assume normal browser fallback API-Key persistence, remove that assumption from the user flow and move API-Key editing assertions to the admin bridge path only.

- [ ] **Step 2: Run test to verify failures are now specific**

Run:

```bash
npm test -- tests/renderer/componentSource.test.js tests/renderer/appSource.test.js tests/renderer/desktopBridge.test.js
```

Expected: Any remaining failures should point only to missing cleanup in source references.

- [ ] **Step 3: Make the minimal source cleanup changes**

Remove dead code and dead props that were only used by the old dashboard API-Key editor:

- old API config emits in `DesignWorkspace.vue`
- unused API config handlers in `App.vue`
- stale references in tests

Keep only the admin dialog-driven API-Key path.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/renderer/componentSource.test.js tests/renderer/appSource.test.js tests/renderer/desktopBridge.test.js
```

Expected: PASS for all renderer source tests.

- [ ] **Step 5: Commit**

```bash
git add renderer/src/App.vue renderer/src/components/DesignWorkspace.vue tests/renderer/componentSource.test.js tests/renderer/appSource.test.js tests/renderer/desktopBridge.test.js
git commit -m "refactor: clean up removed user api key management path"
```

### Task 8: Final verification

**Files:**
- No code changes expected

- [ ] **Step 1: Run focused backend and renderer tests**

Run:

```bash
npm test -- tests/backend/test_settings_store_service.test.js tests/renderer/desktopBridge.test.js tests/renderer/appSource.test.js tests/renderer/componentSource.test.js tests/renderer/stylesSource.test.js
```

Expected: All targeted tests pass.

- [ ] **Step 2: Run renderer build**

Run:

```bash
npm run build:renderer
```

Expected: Vite build completes successfully.

- [ ] **Step 3: Review change scope**

Run:

```bash
git diff --stat
```

Expected: Changes limited to settings service, settings IPC, bridge, dashboard, app flow, admin dialogs, styles, and tests.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: lock api key management behind hidden admin flow"
```

