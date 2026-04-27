# Export Icon Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace upload/save/delete text buttons with local icon buttons and add confirmed local folder deletion for exported result groups.

**Architecture:** Keep the current Electron + Vue structure. Reuse the existing studio export/result directory model, add one new studio IPC delete action, and wire the renderer to show a confirmation prompt before invoking deletion and then refresh local export state.

**Tech Stack:** Electron IPC, Vue 3, Vitest, local filesystem services

---

### Task 1: Lock Red Tests For UI And IPC Surface

**Files:**
- Modify: `tests/renderer/componentSource.test.js`
- Modify: `tests/backend/test_studio_ipc_source.test.js`
- Modify: `tests/backend/test_preload_source.test.js`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run targeted tests and confirm they fail**
- [ ] **Step 3: Implement the minimal surface changes**
- [ ] **Step 4: Run targeted tests and confirm they pass**

### Task 2: Add Studio Export Folder Delete Service

**Files:**
- Modify: `shared/ipcChannels.js`
- Modify: `main/preload.js`
- Modify: `main/src/ipc/studioIpc.js`
- Modify: `main/src/services/studioWorkspaceService.js`
- Modify: `renderer/src/services/desktopBridge.js`
- Modify: `tests/backend/test_studio_workspace_service.test.js`

- [ ] **Step 1: Write failing backend tests for deleting an export folder and refreshing snapshot state**
- [ ] **Step 2: Run the targeted backend tests and confirm they fail**
- [ ] **Step 3: Implement the new delete IPC + workspace service method with output-directory safety checks**
- [ ] **Step 4: Run the targeted backend tests and confirm they pass**

### Task 3: Wire Icon Buttons And Confirmed Delete Flow In Renderer

**Files:**
- Modify: `renderer/src/components/ParameterSettingsPanel.vue`
- Modify: `renderer/src/components/ResultExportPanel.vue`
- Modify: `renderer/src/components/TaskManagerSidebar.vue`
- Modify: `renderer/src/App.vue`
- Modify: `renderer/src/assets/styles.css`

- [ ] **Step 1: Write or extend source tests for icon assets and delete event wiring**
- [ ] **Step 2: Run the targeted renderer tests and confirm they fail**
- [ ] **Step 3: Implement icon-only buttons, confirmation prompt, delete action feedback, and selection cleanup**
- [ ] **Step 4: Run the targeted renderer tests and confirm they pass**

### Task 4: Full Verification

**Files:**
- Modify: `dev-session.log` (runtime output only if app is started)

- [ ] **Step 1: Run `npm test`**
- [ ] **Step 2: Run `npm run lint`**
- [ ] **Step 3: Run `npm run build:renderer`**
- [ ] **Step 4: Start the application with `npm run dev` and verify it launches**
