# Credit Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local credit ledger with freeze, settle, and refund behavior, then surface it in the workspace dashboard with a manual adjustment control.

**Architecture:** Persist credit state in settings for live snapshot access and keep a dedicated local ledger file for audit history. Studio task creation freezes credits up front, queued task completion settles them, and failures refund them. The workspace dashboard reads the derived credit summary from the backend snapshot and provides a local adjustment entry for operator use.

**Tech Stack:** Electron, Vue 3, Vitest, local JSON-backed settings and DATA files

---

### Task 1: Backend credit state model

**Files:**
- Modify: `main/src/services/settingsStoreService.js`
- Modify: `main/src/services/dataPathsService.js`
- Test: `tests/backend/test_settings_store_service.test.js`

- [ ] Add normalized credit state defaults and persistence coverage.
- [ ] Verify settings save/load preserves credit state and rejects invalid values.

### Task 2: Credit accounting in studio tasks

**Files:**
- Modify: `main/src/services/studioWorkspaceService.js`
- Test: `tests/backend/test_studio_workspace_service.test.js`

- [ ] Add failing tests for task freeze, success settlement, and failure refund.
- [ ] Implement per-menu credit estimation and attach credit info to task records.
- [ ] Update workspace snapshot to include credit dashboard data.

### Task 3: Frontend dashboard wiring

**Files:**
- Modify: `renderer/src/App.vue`
- Modify: `renderer/src/components/DesignWorkspace.vue`
- Modify: `renderer/src/components/WorkspaceDashboard.vue`
- Modify: `renderer/src/services/desktopBridge.js`
- Test: `tests/renderer/componentSource.test.js`
- Test: `tests/renderer/appSource.test.js`

- [ ] Add credit summary state and manual adjustment handlers.
- [ ] Render a dedicated credit dashboard card in the workspace.
- [ ] Save local manual adjustments through existing settings flow.

### Task 4: Verification

**Files:**
- Test: `tests/backend/test_settings_store_service.test.js`
- Test: `tests/backend/test_studio_workspace_service.test.js`
- Test: `tests/renderer/componentSource.test.js`
- Test: `tests/renderer/appSource.test.js`

- [ ] Run targeted backend and renderer tests.
- [ ] Fix regressions and rerun until green.
