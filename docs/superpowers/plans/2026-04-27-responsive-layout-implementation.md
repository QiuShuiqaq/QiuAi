# Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `单图设计` to `单图测试` and make the desktop workspace, image result grids, and side panels resize smoothly with the window instead of collapsing through rigid fixed columns.

**Architecture:** Keep the existing Electron + Vue desktop shell and current business component boundaries. Implement the behavior through focused source/test updates: rename UI labels in menu and dashboard, then replace rigid grid sizing in the renderer CSS with fluid `minmax(...)`, `auto-fit`, `clamp(...)`, and safer container constraints so the parameter panel, display panel, export panel, and task sidebar all shrink gracefully.

**Tech Stack:** Electron, Vue 3 SFCs, Vite, Vitest, CSS Grid/Flexbox

---

### Task 1: Lock In Renderer Expectations

**Files:**
- Modify: `tests/renderer/appSource.test.js`
- Modify: `tests/renderer/componentSource.test.js`
- Modify: `tests/renderer/stylesSource.test.js`

- [ ] **Step 1: Write the failing test**

```js
expect(source).toContain('单图测试')
expect(source).not.toContain('单图设计')
expect(stylesSource).toContain('repeat(auto-fit, minmax(')
expect(stylesSource).toContain('clamp(')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/renderer/appSource.test.js tests/renderer/componentSource.test.js tests/renderer/stylesSource.test.js`
Expected: FAIL because source still contains `单图设计` and old fixed grid strings.

- [ ] **Step 3: Keep assertions focused on the intended behavior**

```js
expect(source).toContain("label: '单图测试'")
expect(componentSource).toContain('单图测试统计')
expect(stylesSource).toContain('.comparison-grid')
expect(stylesSource).toContain('grid-template-columns: repeat(auto-fit, minmax(')
expect(stylesSource).toContain('.workspace-panels--focus-display')
expect(stylesSource).toContain('grid-template-columns: minmax(280px, 1fr) minmax(0, 1.8fr);')
```

- [ ] **Step 4: Re-run the renderer tests and keep them red**

Run: `npm test -- tests/renderer/appSource.test.js tests/renderer/componentSource.test.js tests/renderer/stylesSource.test.js`
Expected: FAIL only because implementation has not been updated yet.

### Task 2: Rename Single-Image UI Copy To Single-Image Test

**Files:**
- Modify: `renderer/src/App.vue`
- Modify: `renderer/src/components/WorkspaceSidebar.vue`
- Modify: `renderer/src/components/TaskManagerSidebar.vue`
- Modify: `renderer/src/components/DesignWorkspace.vue`
- Test: `tests/renderer/appSource.test.js`
- Test: `tests/renderer/componentSource.test.js`

- [ ] **Step 1: Implement the minimum source changes**

```js
const menuItems = [
  { key: 'single-image', label: '单图测试' }
]

createEmptyWorkspaceDashboard() {
  return {
    singleImageStats: createEmptyStatsCard('单图测试统计')
  }
}
```

- [ ] **Step 2: Update comment placeholders that are asserted by source tests**

```vue
// 单图测试
// 单图测试统计
```

- [ ] **Step 3: Run the renderer source tests**

Run: `npm test -- tests/renderer/appSource.test.js tests/renderer/componentSource.test.js`
Expected: PASS for label/placeholder coverage, with styles test still pending if CSS has not been updated yet.

### Task 3: Replace Rigid Workspace And Result Grids With Fluid Responsive Layout

**Files:**
- Modify: `renderer/src/assets/styles.css`
- Modify: `renderer/src/components/ResultDisplayPanel.vue`
- Modify: `renderer/src/components/ResultExportPanel.vue`
- Modify: `renderer/src/components/TaskManagerSidebar.vue`
- Test: `tests/renderer/stylesSource.test.js`

- [ ] **Step 1: Change the main focus workspace columns from rigid fractions to shrink-safe fluid columns**

```css
.workspace-panels--focus-display {
  grid-template-columns: minmax(280px, 1fr) minmax(0, 1.8fr);
}
```

- [ ] **Step 2: Convert result grids to fluid auto-fit columns**

```css
.comparison-grid,
.group-output-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: clamp(10px, 1vw, 14px);
}

.model-price-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
```

- [ ] **Step 3: Shrink card spacing and media sizing continuously instead of through abrupt collapse**

```css
.comparison-card,
.image-result-card,
.export-item,
.task-card--compact {
  padding: clamp(8px, 0.9vw, 12px);
}

.comparison-card img,
.image-result-card img {
  aspect-ratio: 1 / 1;
  object-fit: cover;
}
```

- [ ] **Step 4: Keep only narrow-window fallback stacking**

```css
@media (max-width: 1360px) {
  .workspace-panels--focus-display {
    grid-template-columns: minmax(240px, 0.95fr) minmax(0, 1.45fr);
  }
}

@media (max-width: 1080px) {
  .workspace-panels--focus-display {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

- [ ] **Step 5: Run the renderer style tests**

Run: `npm test -- tests/renderer/stylesSource.test.js`
Expected: PASS with the new responsive strings asserted.

### Task 4: Run Full Regression Verification

**Files:**
- No source changes expected

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS, all renderer/backend tests green.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS with 0 errors.

- [ ] **Step 3: Run renderer build**

Run: `npm run build:renderer`
Expected: PASS with Vite production build output.

- [ ] **Step 4: Sanity check for old label leftovers**

Run: `rg -n "单图设计" renderer/src tests`
Expected: either no remaining renderer-facing occurrences or only intentional historical/backend references.
