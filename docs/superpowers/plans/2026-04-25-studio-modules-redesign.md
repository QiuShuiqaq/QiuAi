# Studio Modules Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the four design modules so their parameter forms, result views, export views, and task queue metadata match the approved local desktop workflows.

**Architecture:** Keep the existing Electron + Vue shell and evolve the studio snapshot model so each module stores its own draft fields and returns module-specific result shapes. Update the renderer panels to render per-module forms and grouped result/export cards while the task sidebar consumes richer task summaries.

**Tech Stack:** Electron, Vue 3, Vitest, ESLint, Vite

---

### Task 1: Lock the new behavior with tests

**Files:**
- Modify: `tests/backend/test_studio_workspace_service.test.js`
- Modify: `tests/renderer/componentSource.test.js`
- Modify: `tests/renderer/appSource.test.js`

- [ ] Add failing backend expectations for grouped batch task summaries and module-specific result structures.
- [ ] Add failing renderer expectations for the new parameter labels, grouped result blocks, and task metadata fields.
- [ ] Run the targeted tests and confirm they fail for the expected missing behavior.

### Task 2: Update studio workspace data structures

**Files:**
- Modify: `main/src/services/studioWorkspaceService.js`

- [ ] Extend default drafts so copywriting, single-image, series-design, and series-generate each carry the fields required by the approved workflows.
- [ ] Update draft normalization so image references, batch rows, compare models, and grouped generation settings persist cleanly.
- [ ] Update task creation to produce richer task summaries plus grouped text/image results and export items.
- [ ] Run the backend tests and confirm they pass.

### Task 3: Redesign the renderer panels

**Files:**
- Modify: `renderer/src/App.vue`
- Modify: `renderer/src/components/ParameterSettingsPanel.vue`
- Modify: `renderer/src/components/ResultDisplayPanel.vue`
- Modify: `renderer/src/components/ResultExportPanel.vue`
- Modify: `renderer/src/components/TaskManagerSidebar.vue`
- Modify: `renderer/src/assets/styles.css`

- [ ] Wire the new draft fields and task summary data through the app shell.
- [ ] Replace the generic parameter form with module-specific sections for copywriting, single-image comparison, series-design row matching, and series-generate grouped expansion.
- [ ] Replace the generic result/export rendering with text blocks, four-model comparison cards, grouped source-image outputs, and grouped batch outputs.
- [ ] Update task cards and styling to surface the new task metadata without breaking the fixed layout.
- [ ] Run the renderer tests and adjust until they pass.

### Task 4: Verify the integrated desktop build

**Files:**
- Verify only

- [ ] Run `npm test`
- [ ] Run `npm run lint`
- [ ] Run `npm run build:renderer`
- [ ] Review the outputs before making any completion claim.
