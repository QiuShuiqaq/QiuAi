# Export Auto Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent export preference in QiuAi so selected result folders are automatically deleted after a successful batch download, with the preference enabled by default.

**Architecture:** Persist a new boolean setting in the existing settings store, expose it through the existing settings IPC and desktop bridge flow, render the toggle inside the export panel, and keep export/delete responsibilities decoupled by letting the renderer trigger post-export cleanup through the existing delete IPC.

**Tech Stack:** Electron, Vue 3, electron-store, Vitest

---

### Task 1: Persist export auto-cleanup preference

**Files:**
- Modify: `main/src/services/settingsStoreService.js`
- Modify: `renderer/src/services/desktopBridge.js`
- Test: `tests/backend/test_settings_store_service.test.js`

- [ ] Add a failing backend test asserting `downloadCleanupEnabled` defaults to `true` and survives save/load normalization.
- [ ] Run: `npm test -- tests/backend/test_settings_store_service.test.js`
- [ ] Implement the minimal settings-store changes to add and normalize `downloadCleanupEnabled`.
- [ ] Re-run: `npm test -- tests/backend/test_settings_store_service.test.js`

### Task 2: Render and persist the export toggle

**Files:**
- Modify: `renderer/src/components/ResultExportPanel.vue`
- Modify: `renderer/src/components/TaskManagerSidebar.vue`
- Modify: `renderer/src/components/DesignWorkspace.vue`
- Modify: `renderer/src/App.vue`
- Test: `tests/renderer/componentSource.test.js`
- Test: `tests/renderer/appSource.test.js`

- [ ] Add failing renderer source tests for the export toggle label, prop drilling, and persisted state handling in `App.vue`.
- [ ] Run: `npm test -- tests/renderer/componentSource.test.js tests/renderer/appSource.test.js`
- [ ] Implement the toggle UI and state propagation using the existing settings save flow.
- [ ] Re-run: `npm test -- tests/renderer/componentSource.test.js tests/renderer/appSource.test.js`

### Task 3: Auto-delete selected export folders after successful download

**Files:**
- Modify: `renderer/src/App.vue`
- Test: `tests/renderer/appSource.test.js`

- [ ] Add a failing renderer source test asserting batch download success path checks `downloadCleanupEnabled` and triggers delete calls for selected export ids.
- [ ] Run: `npm test -- tests/renderer/appSource.test.js`
- [ ] Implement the minimal post-export cleanup flow using existing `deleteStudioExportItem`, refresh snapshot, and selection reset logic.
- [ ] Re-run: `npm test -- tests/renderer/appSource.test.js`

### Task 4: Verify success and partial-failure feedback

**Files:**
- Modify: `renderer/src/App.vue`
- Test: `tests/renderer/appSource.test.js`

- [ ] Add a failing source test for new success / partial cleanup feedback messages.
- [ ] Run: `npm test -- tests/renderer/appSource.test.js`
- [ ] Implement the minimal feedback branching for:
  - download success without cleanup
  - download success with cleanup success
  - download success with partial cleanup failure
- [ ] Re-run: `npm test -- tests/renderer/appSource.test.js`

### Task 5: Final verification

**Files:**
- No code changes expected

- [ ] Run: `npm test -- tests/backend/test_settings_store_service.test.js tests/renderer/appSource.test.js tests/renderer/componentSource.test.js`
- [ ] Run: `npm run build:renderer`
- [ ] Review `git diff --stat` to ensure changes are limited to the feature scope.

