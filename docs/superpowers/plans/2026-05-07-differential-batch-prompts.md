# Differential Batch Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-image differential prompt mode for `套图设计` and `套图生成`, so each batch can use `专属提示词1/2/3...` while leaving the old single-prompt flow unchanged when differential mode is off.

**Architecture:** Extend both renderer and main-process draft normalization with two new fields, `differentialEnabled` and `batchPrompts`, then update parameter-panel rendering and generation prompt composition to switch between the old single prompt and the new per-batch prompts. Keep this as a backwards-compatible extension with explicit TDD coverage for normalization, UI source markers, and batch-specific prompt composition.

**Tech Stack:** Vue 3, Electron, Node.js, Vitest, ESLint

---

## File Structure

### Files to Modify

- `renderer/src/App.vue`
  - Normalize renderer drafts for `series-design` and `series-generate`
  - Keep `batchPrompts` aligned with `batchCount` and `generateCount`
  - Extend upload-created assignment objects with differential fields
  - Extend submit-time validation if differential mode is enabled
- `renderer/src/components/ParameterSettingsPanel.vue`
  - Add the `差异化` checkbox to each series card
  - Switch between single `专属提示词` and `专属提示词1/2/3...`
  - Add emit helpers for nested `batchPrompts` editing
- `main/src/services/studioWorkspaceService.js`
  - Normalize persisted drafts with `differentialEnabled` and `batchPrompts`
  - Ensure defaults are created for legacy drafts
- `main/src/services/studioImageGenerationService.js`
  - Normalize generation assignments with differential fields
  - Use per-batch prompt values when differential mode is on
  - Keep old prompt behavior when differential mode is off
- `tests/backend/test_studio_workspace_service.test.js`
  - Cover legacy-draft compatibility and normalized draft shape
- `tests/backend/test_studio_image_generation_service.test.js`
  - Cover per-batch prompt composition for both series modes
- `tests/renderer/appSource.test.js`
  - Lock in renderer source markers for new differential fields if needed
- `tests/renderer/componentSource.test.js`
  - Lock in panel source markers for `差异化` and `专属提示词1/2/3`

### Files Not to Modify

- `renderer/src/components/PromptLibraryPanel.vue`
  - This feature no longer uses tag-based differential prompts
- `main/src/services/negativePromptTemplateStoreService.js`
  - Negative prompt logic is unchanged

---

### Task 1: Add Draft Normalization for Differential Prompt Fields

**Files:**
- Modify: `main/src/services/studioWorkspaceService.js`
- Modify: `renderer/src/App.vue`
- Test: `tests/backend/test_studio_workspace_service.test.js`

- [ ] **Step 1: Write the failing backend normalization test**

Add a new test near the existing legacy draft normalization coverage in `tests/backend/test_studio_workspace_service.test.js`:

```js
  it('normalizes legacy differential prompt fields for series drafts', async () => {
    const store = createMemoryStore()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService, STUDIO_WORKSPACE_KEY } = await import('../../main/src/services/studioWorkspaceService.js')

    store.set(STUDIO_WORKSPACE_KEY, {
      formDrafts: {
        'series-design': {
          globalPrompt: '统一风格',
          imageAssignments: [
            {
              id: 'image-1',
              name: 'look-1.png',
              path: 'C:/input/look-1.png',
              selected: true,
              prompt: '主图提示词',
              imageType: '商品主图'
            }
          ],
          batchCount: 3,
          size: '1:1'
        },
        'series-generate': {
          globalPrompt: '统一风格',
          sourceImage: {
            name: 'main.png',
            path: 'C:/input/main.png'
          },
          generateCount: 2,
          promptAssignments: [
            {
              id: 'prompt-1',
              index: 1,
              prompt: '提示词-1',
              imageType: '商品主图'
            }
          ],
          batchCount: 2,
          size: '1:1'
        }
      }
    })

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      ...createEmptyOutputScanDependencies(),
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined
    })

    const snapshot = service.getSnapshot()

    expect(snapshot.formDrafts['series-design'].imageAssignments[0]).toMatchObject({
      differentialEnabled: false,
      batchPrompts: ['', '', '']
    })
    expect(snapshot.formDrafts['series-generate'].promptAssignments[0]).toMatchObject({
      differentialEnabled: false,
      batchPrompts: ['', '']
    })
    expect(snapshot.formDrafts['series-generate'].promptAssignments[1]).toMatchObject({
      differentialEnabled: false,
      batchPrompts: ['', '']
    })
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- --run tests/backend/test_studio_workspace_service.test.js
```

Expected: FAIL because `differentialEnabled` and `batchPrompts` do not exist in normalized drafts.

- [ ] **Step 3: Implement minimal normalization in `studioWorkspaceService.js`**

Add focused helpers in `main/src/services/studioWorkspaceService.js` near the existing series normalization helpers:

```js
function normalizeBatchPrompts(batchPrompts = [], batchCount = 1) {
  const normalizedCount = Math.max(1, Number(batchCount) || 1)
  const sourcePrompts = Array.isArray(batchPrompts) ? batchPrompts : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    return String(sourcePrompts[index] || '')
  })
}
```

Extend `normalizeImageAssignments`:

```js
function normalizeImageAssignments(assignments = [], batchCount = 1) {
  return Array.isArray(assignments)
    ? assignments
      .map((item, index) => {
        const normalizedAsset = normalizeImageAsset(item)
        if (!normalizedAsset) {
          return null
        }

        return {
          ...normalizedAsset,
          id: item.id || `series-design-${index + 1}`,
          selected: item.selected !== false,
          prompt: item.prompt || '',
          imageType: item.imageType || '',
          size: item.size || '1:1',
          model: item.model || '',
          differentialEnabled: item.differentialEnabled === true,
          batchPrompts: normalizeBatchPrompts(item.batchPrompts, batchCount),
          tagIds: Array.isArray(item.tagIds) ? item.tagIds.filter((tagId) => typeof tagId === 'string' && tagId.trim()) : [],
          tagNames: Array.isArray(item.tagNames) ? item.tagNames.filter((tagName) => typeof tagName === 'string' && tagName.trim()) : []
        }
      })
      .filter(Boolean)
    : []
}
```

Extend `normalizePromptAssignments`:

```js
function normalizePromptAssignments(promptAssignments = [], count = 1, batchCount = 1) {
  const normalizedCount = Math.max(1, Math.min(MAX_SERIES_GENERATE_GROUP_SIZE, Number(count) || 1))
  const sourceAssignments = Array.isArray(promptAssignments) ? promptAssignments : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    const currentAssignment = sourceAssignments[index] || {}

    return {
      id: currentAssignment.id || `series-generate-${index + 1}`,
      index: index + 1,
      prompt: currentAssignment.prompt || '',
      imageType: currentAssignment.imageType || '',
      differentialEnabled: currentAssignment.differentialEnabled === true,
      batchPrompts: normalizeBatchPrompts(currentAssignment.batchPrompts, batchCount)
    }
  })
}
```

Update `normalizeDraftForMenu` calls:

```js
      imageAssignments: normalizeImageAssignments(
        draft.imageAssignments,
        Math.max(1, Number(draft.batchCount) || defaultDraft.batchCount || 1)
      ),
```

```js
      promptAssignments: normalizePromptAssignments(draft.promptAssignments, generateCount, Math.max(1, Number(draft.batchCount) || defaultDraft.batchCount || 1)),
```

Mirror the same normalization in `renderer/src/App.vue`:

```js
function normalizeBatchPrompts(batchPrompts = [], batchCount = 1) {
  const normalizedCount = Math.max(1, Number(batchCount) || 1)
  const sourcePrompts = Array.isArray(batchPrompts) ? batchPrompts : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    return String(sourcePrompts[index] || '')
  })
}
```

And extend:

```js
function createSeriesGeneratePromptAssignments(count, existingAssignments = [], batchCount = 1) {
```

```js
      differentialEnabled: currentAssignment.differentialEnabled === true,
      batchPrompts: normalizeBatchPrompts(currentAssignment.batchPrompts, batchCount)
```

Inside `normalizeStoredDraft` for `series-generate`:

```js
    normalizedDraft.promptAssignments = createSeriesGeneratePromptAssignments(
      generateCount,
      normalizedDraft.promptAssignments,
      Math.max(1, Number(normalizedDraft.batchCount) || 1)
    )
```

Inside `applySeriesDesignSelection` creation:

```js
    differentialEnabled: false,
    batchPrompts: Array.from({ length: Math.max(1, Number(formDrafts.value['series-design']?.batchCount) || 1) }, () => ''),
```

Inside `createDraftForm('series-design')` and `createDraftForm('series-generate')`, keep existing defaults but rely on normalization for nested fields.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- --run tests/backend/test_studio_workspace_service.test.js
```

Expected: PASS with the new normalization test green.

- [ ] **Step 5: Commit**

```bash
git add main/src/services/studioWorkspaceService.js renderer/src/App.vue tests/backend/test_studio_workspace_service.test.js
git commit -m "feat: normalize differential batch prompt drafts"
```

---

### Task 2: Add Parameter Panel Differential Prompt UI

**Files:**
- Modify: `renderer/src/components/ParameterSettingsPanel.vue`
- Modify: `renderer/src/App.vue`
- Test: `tests/renderer/componentSource.test.js`
- Test: `tests/renderer/appSource.test.js`

- [ ] **Step 1: Write the failing renderer source tests**

Update `tests/renderer/componentSource.test.js` by adding assertions around the series card areas:

```js
    expect(parameterSource).toContain('差异化')
    expect(parameterSource).toContain('专属提示词1')
    expect(parameterSource).toContain('assignment.differentialEnabled === true')
    expect(parameterSource).toContain("updateAssignment(index, 'differentialEnabled', $event.target.checked)")
    expect(parameterSource).toContain("updateSeriesGenerateAssignment(index, 'differentialEnabled', $event.target.checked)")
    expect(parameterSource).toContain('updateAssignmentBatchPrompt')
    expect(parameterSource).toContain('updateSeriesGenerateBatchPrompt')
```

Add one guard in `tests/renderer/appSource.test.js`:

```js
    expect(source).toContain('normalizeBatchPrompts')
    expect(source).toContain('differentialEnabled')
    expect(source).toContain('batchPrompts')
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm test -- --run tests/renderer/componentSource.test.js tests/renderer/appSource.test.js
```

Expected: FAIL because the panel does not yet contain differential prompt UI markers.

- [ ] **Step 3: Implement minimal UI in `ParameterSettingsPanel.vue`**

Add helpers under the existing assignment update helpers:

```js
function updateAssignmentBatchPrompt(index, batchPromptIndex, value) {
  const nextAssignments = seriesAssignments.value.map((item, currentIndex) => {
    if (currentIndex !== index) {
      return item
    }

    const nextBatchPrompts = Array.isArray(item.batchPrompts) ? [...item.batchPrompts] : []
    nextBatchPrompts[batchPromptIndex] = value

    return {
      ...item,
      batchPrompts: nextBatchPrompts
    }
  })

  emitField('imageAssignments', nextAssignments)
}
```

```js
function updateSeriesGenerateBatchPrompt(index, batchPromptIndex, value) {
  const nextAssignments = seriesGeneratePromptAssignments.value.map((item, currentIndex) => {
    if (currentIndex !== index) {
      return item
    }

    const nextBatchPrompts = Array.isArray(item.batchPrompts) ? [...item.batchPrompts] : []
    nextBatchPrompts[batchPromptIndex] = value

    return {
      ...item,
      batchPrompts: nextBatchPrompts
    }
  })

  emitField('promptAssignments', nextAssignments)
}
```

In the series-design assignment card head, replace the current toggle with:

```vue
            <div class="assignment-card__toggle-row">
              <label class="assignment-card__toggle">
                <input
                  :checked="assignment.selected !== false"
                  type="checkbox"
                  @change="updateAssignment(index, 'selected', $event.target.checked)"
                />
                <span>参与本次生成</span>
              </label>
              <label class="assignment-card__toggle">
                <input
                  :checked="assignment.differentialEnabled === true"
                  type="checkbox"
                  @change="updateAssignment(index, 'differentialEnabled', $event.target.checked)"
                />
                <span>差异化</span>
              </label>
            </div>
```

Then replace the single prompt field block with:

```vue
              <template v-if="assignment.differentialEnabled === true">
                <label
                  v-for="(batchPrompt, batchPromptIndex) in assignment.batchPrompts || []"
                  :key="`${assignment.id || index}-batch-${batchPromptIndex}`"
                  class="form-field assignment-card__prompt-field--flush"
                >
                  <span>{{ `专属提示词${batchPromptIndex + 1}` }}</span>
                  <textarea
                    :value="batchPrompt"
                    rows="3"
                    :placeholder="`输入当前图片第 ${batchPromptIndex + 1} 组的专属提示词`"
                    @input="updateAssignmentBatchPrompt(index, batchPromptIndex, $event.target.value)"
                  ></textarea>
                </label>
              </template>
              <label v-else class="form-field assignment-card__prompt-field--flush">
                <span>图片专属提示词</span>
                <textarea
                  :value="assignment.prompt"
                  rows="3"
                  placeholder="输入当前图片的专属提示词"
                  @input="updateAssignment(index, 'prompt', $event.target.value)"
                ></textarea>
              </label>
```

In the series-generate card body, add the toggle row after the type selector:

```vue
                  <label class="assignment-card__toggle assignment-card__toggle--inline">
                    <input
                      :checked="assignment.differentialEnabled === true"
                      type="checkbox"
                      @change="updateSeriesGenerateAssignment(index, 'differentialEnabled', $event.target.checked)"
                    />
                    <span>差异化</span>
                  </label>
```

And replace the single textarea with:

```vue
                  <template v-if="assignment.differentialEnabled === true">
                    <label
                      v-for="(batchPrompt, batchPromptIndex) in assignment.batchPrompts || []"
                      :key="`${assignment.id || index}-generate-batch-${batchPromptIndex}`"
                      class="form-field assignment-card__prompt-field--flush"
                    >
                      <span>{{ `专属提示词${batchPromptIndex + 1}` }}</span>
                      <textarea
                        :value="batchPrompt"
                        rows="3"
                        :placeholder="`输入第 ${index + 1} 张第 ${batchPromptIndex + 1} 组的专属提示词`"
                        @input="updateSeriesGenerateBatchPrompt(index, batchPromptIndex, $event.target.value)"
                      ></textarea>
                    </label>
                  </template>
                  <label v-else class="form-field assignment-card__prompt-field--flush">
                    <textarea
                      :value="assignment.prompt"
                      rows="3"
                      :placeholder="`输入第 ${index + 1} 张要生成的具体画面要求`"
                      @input="updateSeriesGenerateAssignment(index, 'prompt', $event.target.value)"
                    ></textarea>
                  </label>
```

If the stylesheet class is needed but already exists in shared CSS, reuse existing assignment-card spacing classes and only add minimal class names in markup here.

- [ ] **Step 4: Keep prompt arrays aligned in `App.vue`**

Update `createSeriesGeneratePromptAssignments` in `renderer/src/App.vue`:

```js
function createSeriesGeneratePromptAssignments(count, existingAssignments = [], batchCount = 1) {
  const normalizedCount = Math.max(1, Math.min(500, Number(count) || 1))
  const normalizedBatchCount = Math.max(1, Number(batchCount) || 1)
  const sourceAssignments = Array.isArray(existingAssignments) ? existingAssignments : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    const currentAssignment = sourceAssignments[index] || {}

    return {
      id: currentAssignment.id || `series-generate-${index + 1}`,
      index: index + 1,
      prompt: currentAssignment.prompt || '',
      imageType: currentAssignment.imageType || '',
      differentialEnabled: currentAssignment.differentialEnabled === true,
      batchPrompts: normalizeBatchPrompts(currentAssignment.batchPrompts, normalizedBatchCount)
    }
  })
}
```

Update `handleFieldUpdate` for `series-generate`:

```js
  if (activeMenu.value === 'series-generate' && field === 'generateCount') {
    const generateCount = Math.max(1, Math.min(500, Number(value) || 1))
    const batchCount = Math.max(1, Number(currentDraft.batchCount) || 1)
    nextDraft = {
      ...currentDraft,
      generateCount,
      promptAssignments: createSeriesGeneratePromptAssignments(generateCount, currentDraft.promptAssignments, batchCount)
    }
  }
```

```js
  if (activeMenu.value === 'series-generate' && field === 'batchCount') {
    const batchCount = Math.max(1, Number(value) || 1)
    nextDraft = {
      ...currentDraft,
      batchCount,
      promptAssignments: createSeriesGeneratePromptAssignments(currentDraft.generateCount, currentDraft.promptAssignments, batchCount)
    }
  }
```

```js
  if (activeMenu.value === 'series-generate' && field === 'promptAssignments') {
    nextDraft = {
      ...currentDraft,
      promptAssignments: createSeriesGeneratePromptAssignments(
        currentDraft.generateCount,
        value,
        Math.max(1, Number(currentDraft.batchCount) || 1)
      )
    }
  }
```

For `series-design`, add a helper near `applySeriesDesignSelection`:

```js
function normalizeSeriesDesignAssignments(assignments = [], batchCount = 1) {
  const normalizedBatchCount = Math.max(1, Number(batchCount) || 1)
  return (Array.isArray(assignments) ? assignments : []).map((assignment) => {
    return {
      ...assignment,
      differentialEnabled: assignment.differentialEnabled === true,
      batchPrompts: normalizeBatchPrompts(assignment.batchPrompts, normalizedBatchCount)
    }
  })
}
```

Use it in `handleFieldUpdate` when `activeMenu.value === 'series-design'` and `field === 'batchCount'`:

```js
  if (activeMenu.value === 'series-design' && field === 'batchCount') {
    const batchCount = Math.max(1, Number(value) || 1)
    nextDraft = {
      ...currentDraft,
      batchCount,
      imageAssignments: normalizeSeriesDesignAssignments(currentDraft.imageAssignments, batchCount)
    }
  }
```

And when `field === 'imageAssignments'`:

```js
  if (activeMenu.value === 'series-design' && field === 'imageAssignments') {
    nextDraft = {
      ...currentDraft,
      imageAssignments: normalizeSeriesDesignAssignments(value, Math.max(1, Number(currentDraft.batchCount) || 1))
    }
  }
```

- [ ] **Step 5: Run the renderer tests to verify they pass**

Run:

```bash
npm test -- --run tests/renderer/componentSource.test.js tests/renderer/appSource.test.js
```

Expected: PASS with the new source assertions green.

- [ ] **Step 6: Commit**

```bash
git add renderer/src/components/ParameterSettingsPanel.vue renderer/src/App.vue tests/renderer/componentSource.test.js tests/renderer/appSource.test.js
git commit -m "feat: add differential prompt controls"
```

---

### Task 3: Switch Series Prompt Composition by Batch

**Files:**
- Modify: `main/src/services/studioImageGenerationService.js`
- Test: `tests/backend/test_studio_image_generation_service.test.js`

- [ ] **Step 1: Write the failing generation tests**

Add one test for `series-design` and one for `series-generate` in `tests/backend/test_studio_image_generation_service.test.js`:

```js
  it('uses batch-specific prompts for series-design when differential mode is enabled', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    await service.generateImageResults({
      menuKey: 'series-design',
      taskId: 'task-series-design-differential',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        globalPrompt: '统一高级电商视觉风格',
        batchCount: 2,
        size: '1:1',
        imageAssignments: [
          {
            id: 'image-1',
            name: 'look-1.png',
            path: 'C:/input/look-1.png',
            selected: true,
            prompt: '默认专属提示词',
            imageType: '商品主图',
            differentialEnabled: true,
            batchPrompts: ['第一组专属提示词', '第二组专属提示词']
          }
        ]
      }
    })

    expect(createDrawTaskDependency.mock.calls.map((call) => call[0].prompt)).toEqual([
      '统一高级电商视觉风格\n第一组专属提示词',
      '统一高级电商视觉风格\n第二组专属提示词'
    ])
  })
```

```js
  it('uses batch-specific prompts for series-generate when differential mode is enabled', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    await service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-differential',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: '统一高级电商详情页风格',
        generateCount: 1,
        batchCount: 2,
        promptAssignments: [
          {
            index: 1,
            prompt: '默认提示词',
            imageType: '商品主图',
            differentialEnabled: true,
            batchPrompts: ['第一组提示词', '第二组提示词']
          }
        ],
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency.mock.calls.map((call) => call[0].prompt)).toEqual([
      '统一高级电商详情页风格\n第一组提示词',
      '统一高级电商详情页风格\n第二组提示词'
    ])
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- --run tests/backend/test_studio_image_generation_service.test.js
```

Expected: FAIL because generation still uses the old single prompt fields.

- [ ] **Step 3: Implement minimal batch-specific prompt switching**

Add helpers in `main/src/services/studioImageGenerationService.js` after `composePromptWithNegativeConstraints`:

```js
function normalizeDifferentialBatchPrompts(batchPrompts = [], batchCount = 1) {
  const normalizedCount = Math.max(1, Number(batchCount) || 1)
  const sourcePrompts = Array.isArray(batchPrompts) ? batchPrompts : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    return String(sourcePrompts[index] || '').trim()
  })
}
```

```js
function resolveBatchPromptValue({
  differentialEnabled = false,
  batchPrompts = [],
  fallbackPrompt = '',
  batchIndex = 0,
  batchCount = 1
} = {}) {
  if (differentialEnabled !== true) {
    return String(fallbackPrompt || '').trim()
  }

  const normalizedBatchPrompts = normalizeDifferentialBatchPrompts(batchPrompts, batchCount)
  return normalizedBatchPrompts[batchIndex] || ''
}
```

Extend `normalizeSeriesGeneratePromptAssignments`:

```js
      differentialEnabled: currentAssignment.differentialEnabled === true,
      batchPrompts: normalizeDifferentialBatchPrompts(currentAssignment.batchPrompts, 1)
```

Extend `buildSeriesDesignOutputDescriptors`:

```js
      differentialEnabled: assignment.differentialEnabled === true,
      batchPrompts: Array.isArray(assignment.batchPrompts) ? assignment.batchPrompts : [],
```

In `generateSeriesDesignResults`, replace:

```js
              const promptFinal = composePromptWithNegativeConstraints(
                [draft.globalPrompt, assignment.composedPrompt],
                draft.negativePrompt
              )
```

with:

```js
              const batchPrompt = resolveBatchPromptValue({
                differentialEnabled: assignment.differentialEnabled,
                batchPrompts: assignment.batchPrompts,
                fallbackPrompt: assignment.composedPrompt,
                batchIndex,
                batchCount
              })
              const promptFinal = composePromptWithNegativeConstraints(
                [draft.globalPrompt, batchPrompt],
                draft.negativePrompt
              )
```

In `generateSeriesGenerateResults`, replace:

```js
            const promptFinal = composePromptWithNegativeConstraints(
              [draft.globalPrompt, promptAssignment.composedPrompt],
              draft.negativePrompt
            )
```

with:

```js
            const batchPrompt = resolveBatchPromptValue({
              differentialEnabled: promptAssignment.differentialEnabled,
              batchPrompts: promptAssignment.batchPrompts,
              fallbackPrompt: promptAssignment.composedPrompt,
              batchIndex,
              batchCount
            })
            const promptFinal = composePromptWithNegativeConstraints(
              [draft.globalPrompt, batchPrompt],
              draft.negativePrompt
            )
```

Also normalize `batchPrompts` inside `normalizeSeriesGeneratePromptAssignments` using `Math.max(1, Number(draft.batchCount) || 1)` where needed during generation setup if the direct helper call needs the current batch count.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- --run tests/backend/test_studio_image_generation_service.test.js
```

Expected: PASS with the new differential prompt tests green and old prompt behavior still preserved.

- [ ] **Step 5: Commit**

```bash
git add main/src/services/studioImageGenerationService.js tests/backend/test_studio_image_generation_service.test.js
git commit -m "feat: use differential prompts per batch"
```

---

### Task 4: Add Validation and Final Regression Verification

**Files:**
- Modify: `renderer/src/App.vue`
- Modify: `tests/backend/test_studio_workspace_service.test.js`
- Modify: `tests/backend/test_studio_image_generation_service.test.js`

- [ ] **Step 1: Write one failing validation regression test if missing**

Add a validation-oriented test to `tests/backend/test_studio_image_generation_service.test.js`:

```js
  it('falls back to the original single prompt when differential mode is disabled even if batch prompts exist', async () => {
    const createDrawTaskDependency = vi.fn(async ({ prompt }) => ({
      id: `remote-${createDrawTaskDependency.mock.calls.length}`,
      prompt
    }))
    const service = createService({
      createDrawTaskDependency
    })

    await service.generateImageResults({
      menuKey: 'series-generate',
      taskId: 'task-series-generate-differential-disabled',
      outputDirectory: 'C:/output',
      draft: {
        model: 'gpt-image-2',
        sourceImage: {
          name: 'main.png',
          path: 'C:/input/main.png'
        },
        globalPrompt: '统一风格',
        generateCount: 1,
        batchCount: 2,
        promptAssignments: [
          {
            index: 1,
            prompt: '默认提示词',
            imageType: '商品主图',
            differentialEnabled: false,
            batchPrompts: ['第一组提示词', '第二组提示词']
          }
        ],
        size: '1:1'
      }
    })

    expect(createDrawTaskDependency.mock.calls.map((call) => call[0].prompt)).toEqual([
      '统一风格\n默认提示词',
      '统一风格\n默认提示词'
    ])
  })
```

- [ ] **Step 2: Run the focused test to verify it fails or confirms missing behavior**

Run:

```bash
npm test -- --run tests/backend/test_studio_image_generation_service.test.js
```

Expected: FAIL until fallback behavior is confirmed by implementation.

- [ ] **Step 3: Implement minimal submit-time validation in `App.vue`**

Inside `validateCurrentTaskBeforeSubmit()` in `renderer/src/App.vue`, refine the series sections.

For `series-design`, replace the prompt-empty validation block with:

```js
    const hasEmptySelectedPrompt = assignments.some((item) => {
      if (item.selected === false) {
        return false
      }

      if (item.differentialEnabled === true) {
        const batchPrompts = normalizeBatchPrompts(item.batchPrompts, Math.max(1, Number(draft.batchCount) || 1))
        return batchPrompts.some((prompt) => !String(prompt || '').trim())
      }

      return !String(item.prompt || '').trim()
    })
```

Keep the existing error message:

```js
      return '请为每一张选中图片填写单独提示词'
```

For `series-generate`, replace the prompt validation block with:

```js
    if (promptAssignments.some((item) => {
      if (item.differentialEnabled === true) {
        const batchPrompts = normalizeBatchPrompts(item.batchPrompts, Math.max(1, Number(draft.batchCount) || 1))
        return batchPrompts.some((prompt) => !String(prompt || '').trim())
      }

      return !String(item.prompt || '').trim()
    })) {
      return '请完整填写每一张图片的单独提示词'
    }
```

- [ ] **Step 4: Run full targeted verification**

Run:

```bash
npm test -- --run tests/backend/test_studio_workspace_service.test.js tests/backend/test_studio_image_generation_service.test.js tests/renderer/appSource.test.js tests/renderer/componentSource.test.js
```

Run:

```bash
npm run lint
```

Run:

```bash
npm run build:renderer
```

Expected:

- All targeted tests pass
- Lint exits 0
- Renderer build exits 0

- [ ] **Step 5: Commit**

```bash
git add renderer/src/App.vue tests/backend/test_studio_workspace_service.test.js tests/backend/test_studio_image_generation_service.test.js tests/renderer/appSource.test.js tests/renderer/componentSource.test.js
git commit -m "feat: validate differential batch prompts"
```

---

## Self-Review

### Spec coverage

- Differential checkbox per image: covered in Task 2
- Single prompt vs multiple `专属提示词1/2/3`: covered in Task 2
- `differentialEnabled` + `batchPrompts` data model: covered in Task 1
- Per-batch prompt composition: covered in Task 3
- Backward compatibility: covered in Task 1
- Submit-time validation and result replay correctness: covered in Task 4

No spec gaps remain for the agreed scope.

### Placeholder scan

- No `TODO` or `TBD`
- All code-touching steps include concrete snippets
- All test steps include actual commands
- Commit steps are explicit

### Type consistency

- Nested fields use one naming scheme throughout: `differentialEnabled`, `batchPrompts`
- Renderer and main process normalization use the same field names
- Generation logic consumes the same names defined in draft normalization

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-07-differential-batch-prompts.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
