# Copywriting Form Simplify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the copywriting parameter form by moving reference images directly below task name and removing unused copy type and batch input mode logic from the stack.

**Architecture:** Update the renderer form layout first, then remove the associated draft state fields and unused import flow from the renderer and studio workspace normalization so the UI and persisted state stay aligned.

**Tech Stack:** Vue 3, Electron renderer bridge, Node service layer, Vitest

---

### Task 1: Lock Failing Tests For The New Copywriting Form

**Files:**
- Modify: `tests/renderer/componentSource.test.js`
- Modify: `tests/renderer/appSource.test.js`
- Modify: `tests/backend/test_studio_workspace_service.test.js`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run the targeted tests and confirm they fail**
- [ ] **Step 3: Implement the minimal UI/state changes**
- [ ] **Step 4: Run the targeted tests and confirm they pass**

### Task 2: Remove Redundant Copywriting Draft Fields And Import Flow

**Files:**
- Modify: `renderer/src/components/ParameterSettingsPanel.vue`
- Modify: `renderer/src/components/DesignWorkspace.vue`
- Modify: `renderer/src/App.vue`
- Modify: `main/src/services/studioWorkspaceService.js`

- [ ] **Step 1: Remove copywriting form blocks for copy type and batch input mode**
- [ ] **Step 2: Move the reference images block directly under task name**
- [ ] **Step 3: Remove renderer draft fields and unused import file handlers**
- [ ] **Step 4: Remove backend normalization defaults for deleted fields**

### Task 3: Verify

**Files:**
- Modify: `dev-session.log` (runtime output only if app is started)

- [ ] **Step 1: Run `npm test`**
- [ ] **Step 2: Run `npm run lint`**
- [ ] **Step 3: Run `npm run build:renderer`**
