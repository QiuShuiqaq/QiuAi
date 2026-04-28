# Group Queue Concurrency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement grouped image-generation execution with fixed in-group concurrency of 5, serial group output ordering, default 20 images per group, maximum 100 images per group, unlimited user-facing batch count, and real grouped progress for `套图设计` and `套图生成`.

**Architecture:** Keep the existing single top-level studio queue in `studioWorkspaceService`, but change series image generation to execute one group at a time with an internal wave executor capped at 5 concurrent remote jobs. Extend task/result metadata so the renderer can show current group progress, long-running warnings, and grouped output status without flattening the user-visible result model.

**Tech Stack:** Electron, Vue 3, CommonJS services, Vitest, ESLint

---

## File Map

### Existing files to modify

- `main/src/services/studioImageGenerationService.js`
  - Owns image-generation orchestration for `single-image`, `single-design`, `series-design`, and `series-generate`
  - Will own the new group-serial / wave-concurrent execution model
- `main/src/services/studioWorkspaceService.js`
  - Owns drafts, task state, progress, result persistence, export indexing, and snapshot shaping
  - Will be extended with richer series task metadata and grouped progress fields
- `renderer/src/components/ParameterSettingsPanel.vue`
  - Owns form controls for `套图设计` and `套图生成`
  - Will raise group size limits, remove current low caps, and add long-running warnings
- `renderer/src/components/ResultDisplayPanel.vue`
  - Owns latest-task progress and grouped result display
  - Will show current group metadata and group-level progress details
- `renderer/src/App.vue`
  - Owns validation, client-side normalization, and task submit flow
  - Will align client-side validation with the new group-count and batch rules
- `tests/backend/test_studio_image_generation_service.test.js`
  - Regression tests for orchestration behavior
- `tests/backend/test_studio_workspace_service.test.js`
  - Regression tests for task metadata, progress, and grouped persistence
- `tests/renderer/componentSource.test.js`
  - Source-level renderer assertions for component structure
- `tests/renderer/appSource.test.js`
  - Source-level renderer assertions for application flow

### New files to create

- None required for the implementation itself

## Task 1: Lock the new grouped execution behavior with failing backend tests

**Files:**
- Modify: `tests/backend/test_studio_image_generation_service.test.js`
- Modify: `tests/backend/test_studio_workspace_service.test.js`

- [ ] **Step 1: Write failing tests for serial group execution and 5-wide in-group concurrency**

Add a new `vitest` case to `tests/backend/test_studio_image_generation_service.test.js` that verifies:

- `series-generate` processes groups in order
- no more than 5 remote jobs run concurrently
- later groups do not start until the current group finishes

Use a pattern like:

```js
it('runs series-generate groups serially with at most 5 concurrent jobs per group', async () => {
  const activeJobs = new Set()
  const startedJobs = []
  const finishedJobs = []
  let maxConcurrent = 0

  const generateDrawResult = vi.fn(async ({ jobLabel }) => {
    startedJobs.push(jobLabel)
    activeJobs.add(jobLabel)
    maxConcurrent = Math.max(maxConcurrent, activeJobs.size)
    await new Promise((resolve) => setTimeout(resolve, 5))
    activeJobs.delete(jobLabel)
    finishedJobs.push(jobLabel)

    return {
      status: 'succeeded',
      progress: 100,
      results: [{ url: 'https://example.com/result.png' }]
    }
  })

  const service = createStudioImageGenerationService({
    settingsService,
    generatedImageSaveService: { saveGeneratedImages: async () => [{ savedPath: 'C:/output/a.png', previewUrl: 'data:image/png;base64,AAA' }] },
    drawTaskService: { createImageTask: generateDrawResult }
  })

  const result = await service.generateImageResults({
    menuKey: 'series-generate',
    draft: {
      taskName: 'BAG-A',
      model: 'gpt-image-2',
      batchCount: 3,
      generateCount: 20,
      globalPrompt: '统一风格',
      sourceImage: { name: 'source.png', storedPath: 'C:/input/source.png' },
      promptAssignments: Array.from({ length: 20 }, (_unused, index) => ({
        id: `slot-${index + 1}`,
        index: index + 1,
        prompt: `prompt-${index + 1}`,
        imageType: '商品主图'
      }))
    },
    taskId: 'task-series-generate',
    outputDirectory: 'C:/output',
    onProgress: async () => {}
  })

  expect(maxConcurrent).toBeLessThanOrEqual(5)
  expect(result.groupedResults).toHaveLength(3)
  expect(startedJobs[0]).toContain('series-generate-1-1')
  expect(startedJobs.some((label) => label.includes('series-generate-2-1'))).toBe(true)
  expect(finishedJobs.findIndex((label) => label.includes('series-generate-1-20'))).toBeLessThan(
    finishedJobs.findIndex((label) => label.includes('series-generate-2-1'))
  )
})
```

- [ ] **Step 2: Add failing tests for richer grouped task metadata**

In `tests/backend/test_studio_workspace_service.test.js`, add a new case that expects snapshot task records to include:

- `groupImageCount`
- `totalSubtaskCount`
- `completedSubtaskCount`
- `failedSubtaskCount`
- `currentGroupIndex`
- `currentGroupCompletedCount`
- `currentGroupTotalCount`

Use a case shape like:

```js
it('stores grouped task progress metadata for series tasks', async () => {
  const service = createStudioWorkspaceService({
    store,
    settingsService,
    generateImageResults: async () => ({
      textResults: [],
      comparisonResults: [],
      groupedResults: [
        {
          id: 'group-1',
          groupIndex: 0,
          groupTitle: 'BAG-A0',
          status: 'succeeded',
          completedCount: 20,
          failedCount: 0,
          outputs: Array.from({ length: 20 }, (_unused, index) => ({
            id: `output-${index + 1}`,
            title: `主图${index}`,
            model: 'gpt-image-2',
            preview: createPreviewDataUrl(`group-${index + 1}`)
          }))
        }
      ],
      summary: { title: '套图生成 1 组 x 20 张' }
    })
  })

  await service.saveDraft({
    menuKey: 'series-generate',
    patch: {
      taskName: 'BAG-A',
      model: 'gpt-image-2',
      generateCount: 20,
      batchCount: 1,
      globalPrompt: '统一风格',
      sourceImage: { name: 'source.png', path: 'C:/input/source.png' },
      promptAssignments: Array.from({ length: 20 }, (_unused, index) => ({
        id: `slot-${index + 1}`,
        index: index + 1,
        prompt: `prompt-${index + 1}`,
        imageType: '商品主图'
      }))
    }
  })

  await service.createTask({ menuKey: 'series-generate' })
  await service.waitForIdle()

  const task = service.getSnapshot().tasks[0]
  expect(task.groupImageCount).toBe(20)
  expect(task.totalSubtaskCount).toBe(20)
  expect(task.completedSubtaskCount).toBe(20)
  expect(task.failedSubtaskCount).toBe(0)
  expect(task.currentGroupIndex).toBe(0)
  expect(task.currentGroupCompletedCount).toBe(20)
  expect(task.currentGroupTotalCount).toBe(20)
})
```

- [ ] **Step 3: Run the new backend tests to verify they fail**

Run:

```bash
npm test -- tests/backend/test_studio_image_generation_service.test.js tests/backend/test_studio_workspace_service.test.js
```

Expected:

- FAIL because current implementation still flattens series execution by batch loop
- FAIL because current task summary does not expose the new grouped progress fields

- [ ] **Step 4: Commit the failing tests**

```bash
git add tests/backend/test_studio_image_generation_service.test.js tests/backend/test_studio_workspace_service.test.js
git commit -m "test: lock grouped queue concurrency behavior"
```

## Task 2: Implement a 5-wide wave executor and serial group processing for series generation

**Files:**
- Modify: `main/src/services/studioImageGenerationService.js`
- Test: `tests/backend/test_studio_image_generation_service.test.js`

- [ ] **Step 1: Add a reusable wave executor helper with fixed concurrency**

Inside `main/src/services/studioImageGenerationService.js`, add a helper near the existing progress helpers:

```js
async function runTasksWithConcurrency(taskFactories = [], concurrency = 5) {
  const normalizedFactories = Array.isArray(taskFactories) ? taskFactories : []
  const normalizedConcurrency = Math.max(1, Number(concurrency) || 1)
  const results = new Array(normalizedFactories.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < normalizedFactories.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await normalizedFactories[currentIndex]()
    }
  }

  const workers = Array.from(
    { length: Math.min(normalizedConcurrency, normalizedFactories.length) },
    () => worker()
  )

  await Promise.all(workers)
  return results
}
```

- [ ] **Step 2: Refactor `series-design` generation to build one group at a time**

Replace the current per-batch/per-selected-image nested request loop in `series-design` with:

- outer loop over `batchIndex`
- for each batch, build a stable `taskFactories` array for selected replacement slots
- run those factories through `runTasksWithConcurrency(taskFactories, 5)`
- merge generated outputs back into the full original image set in slot order

Use a structure like:

```js
for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
  const generatedOutputs = await runTasksWithConcurrency(
    selectedAssignments.map((assignment, selectedIndex) => {
      return async () => {
        const subtaskIndex = (batchIndex * selectedAssignments.length) + selectedIndex
        const completedResult = await createAndPollImageTask({
          settingsService,
          messageRecorder,
          runtimeLogger,
          taskId,
          model: draft.model,
          prompt: buildSeriesDesignPrompt({ draft, assignment }),
          size: draft.size,
          urls: [assignment.storedPath || assignment.path || ''],
          jobLabel: `series-design-${batchIndex + 1}-${selectedIndex + 1}`,
          onProgress: async ({ progress, status }) => {
            await progressReporter.reportSubtaskProgress(subtaskIndex, progress, status)
          }
        })

        return buildSeriesOutputDescriptor({
          taskId,
          batchIndex,
          selectedIndex,
          assignment,
          completedResult
        })
      }
    }),
    5
  )

  groupedResults.push(buildSeriesDesignGroupResult({
    taskId,
    batchIndex,
    originalAssignments,
    selectedAssignments,
    generatedOutputs
  }))
}
```

- [ ] **Step 3: Refactor `series-generate` generation to build one group at a time**

Change `series-generate` to:

- normalize `generateCount` up to `100`
- build one group’s prompt descriptors
- execute that group with `runTasksWithConcurrency(..., 5)`
- push grouped results only after the group finishes

Use code shaped like:

```js
const generateCount = outputDescriptors.length

for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
  const outputs = await runTasksWithConcurrency(
    outputDescriptors.map((descriptor, outputIndex) => {
      return async () => {
        const subtaskIndex = (batchIndex * generateCount) + outputIndex
        const completedResult = await createAndPollImageTask({
          settingsService,
          messageRecorder,
          runtimeLogger,
          taskId,
          model: draft.model,
          prompt: descriptor.prompt,
          size: draft.size,
          urls: descriptor.urls,
          jobLabel: `series-generate-${batchIndex + 1}-${outputIndex + 1}`,
          onProgress: async ({ progress, status }) => {
            await progressReporter.reportSubtaskProgress(subtaskIndex, progress, status)
          }
        })

        return buildSeriesGenerateOutputDescriptor({
          taskId,
          batchIndex,
          outputIndex,
          descriptor,
          completedResult
        })
      }
    }),
    5
  )

  groupedResults.push({
    id: `${taskId}-series-generate-group-${batchIndex + 1}`,
    groupIndex: batchIndex,
    groupTitle: `${taskNameBase}${batchIndex}`,
    status: 'succeeded',
    completedCount: outputs.length,
    failedCount: 0,
    outputs
  })
}
```

- [ ] **Step 4: Increase `series-generate` normalization from 20 to 100**

Update the existing guard:

```js
const normalizedGenerateCount = Math.max(1, Math.min(100, Number(generateCount) || 1))
```

and align every helper in this file that still uses `Math.min(20, ...)`.

- [ ] **Step 5: Run the targeted backend tests to verify they pass**

Run:

```bash
npm test -- tests/backend/test_studio_image_generation_service.test.js
```

Expected:

- PASS
- no concurrency assertion above 5 fails

- [ ] **Step 6: Commit the generation-orchestrator change**

```bash
git add main/src/services/studioImageGenerationService.js tests/backend/test_studio_image_generation_service.test.js
git commit -m "feat: add serial grouped image execution"
```

## Task 3: Extend workspace task records and persistence for grouped progress

**Files:**
- Modify: `main/src/services/studioWorkspaceService.js`
- Test: `tests/backend/test_studio_workspace_service.test.js`

- [ ] **Step 1: Extend draft normalization and default counts for series forms**

In `main/src/services/studioWorkspaceService.js`, raise `series-generate` count normalization and defaults:

```js
const generateCount = Math.max(1, Math.min(100, Number(draft.generateCount) || defaultDraft.generateCount || 1))
```

and set the default draft to:

```js
'series-generate': {
  globalPrompt: '统一商品详情图整体风格',
  model: resolveDefaultModelForMenu('series-generate'),
  taskName: '',
  sourceImage: null,
  generateCount: 20,
  promptAssignments: createSeriesGeneratePromptAssignments(20),
  batchCount: 1,
  size: '1:1'
}
```

- [ ] **Step 2: Add grouped progress fields to task records**

Extend `buildTaskRecord()` so it includes:

```js
groupImageCount,
totalSubtaskCount,
completedSubtaskCount,
failedSubtaskCount,
currentGroupIndex,
currentGroupCompletedCount,
currentGroupTotalCount
```

and update all builders (`buildQueuedTaskSummary`, `buildRunningTaskSummary`, `buildTaskSummary`, `buildFailedTaskSummary`) to provide values.

For the first pass, use:

- `groupImageCount`
  - `series-generate`: normalized `generateCount`
  - `series-design`: source set length
- `totalSubtaskCount`
  - `series-generate`: `generateCount * batchCount`
  - `series-design`: `selectedAssignments * batchCount`

- [ ] **Step 3: Compute grouped progress from final payload**

Add helpers like:

```js
function resolveGroupedProgressState(menuKey, draft = {}, resultPayload = {}) {
  if (menuKey === 'series-generate') {
    const groups = Array.isArray(resultPayload.groupedResults) ? resultPayload.groupedResults : []
    const groupImageCount = Math.max(1, Number(draft.generateCount) || 1)
    const completedSubtaskCount = groups.reduce((total, group) => total + (group.completedCount || (group.outputs || []).length), 0)
    const failedSubtaskCount = groups.reduce((total, group) => total + (group.failedCount || 0), 0)
    const currentGroupIndex = groups.length ? groups.length - 1 : 0
    const currentGroup = groups[currentGroupIndex] || null

    return {
      groupImageCount,
      totalSubtaskCount: Math.max(1, groupImageCount * Math.max(1, Number(draft.batchCount) || 1)),
      completedSubtaskCount,
      failedSubtaskCount,
      currentGroupIndex,
      currentGroupCompletedCount: currentGroup?.completedCount || currentGroup?.outputs?.length || 0,
      currentGroupTotalCount: groupImageCount
    }
  }

  return {
    groupImageCount: 0,
    totalSubtaskCount: 0,
    completedSubtaskCount: 0,
    failedSubtaskCount: 0,
    currentGroupIndex: 0,
    currentGroupCompletedCount: 0,
    currentGroupTotalCount: 0
  }
}
```

Then merge that state into `buildTaskSummary()`.

- [ ] **Step 4: Carry grouped result fields through persistence**

When persisting grouped results in `saveStudioResults()`, preserve:

- `groupIndex`
- `status`
- `completedCount`
- `failedCount`
- per-output `imageType`, `status`, and `savedPath`

Make the persisted group payload shape explicit:

```js
const persistedGroup = {
  ...group,
  groupIndex: Number.isInteger(group.groupIndex) ? group.groupIndex : groupIndex,
  status: group.status || 'succeeded',
  completedCount: Number(group.completedCount || 0),
  failedCount: Number(group.failedCount || 0),
  outputs: []
}
```

- [ ] **Step 5: Run the targeted workspace tests**

Run:

```bash
npm test -- tests/backend/test_studio_workspace_service.test.js
```

Expected:

- PASS
- new metadata fields present in task snapshots

- [ ] **Step 6: Commit the workspace-state changes**

```bash
git add main/src/services/studioWorkspaceService.js tests/backend/test_studio_workspace_service.test.js
git commit -m "feat: add grouped task progress metadata"
```

## Task 4: Align renderer limits and grouped progress display with the new backend model

**Files:**
- Modify: `renderer/src/App.vue`
- Modify: `renderer/src/components/ParameterSettingsPanel.vue`
- Modify: `renderer/src/components/ResultDisplayPanel.vue`
- Test: `tests/renderer/appSource.test.js`
- Test: `tests/renderer/componentSource.test.js`

- [ ] **Step 1: Raise client-side normalization and validation limits**

In `renderer/src/App.vue`, update `createSeriesGeneratePromptAssignments()` and every `Math.min(20, ...)` guard for `series-generate` to `100`.

Use:

```js
const normalizedCount = Math.max(1, Math.min(100, Number(count) || 1))
```

Update `createDraftForm('series-generate')` to default to `generateCount: 20`.

- [ ] **Step 2: Remove the current low batch caps from the series controls**

In `renderer/src/components/ParameterSettingsPanel.vue`, replace the current batch stepper bounds:

```vue
@click="stepField('batchCount', draftForm.batchCount, -1, 1, 6)"
@input="updateStepperField('batchCount', $event.target.value, 1, 6)"
@click="stepField('batchCount', draftForm.batchCount, 1, 1, 6)"
```

with a high internal guard that does not act as a visible business cap:

```vue
@click="stepField('batchCount', draftForm.batchCount, -1, 1, 9999)"
@input="updateStepperField('batchCount', $event.target.value, 1, 9999)"
@click="stepField('batchCount', draftForm.batchCount, 1, 1, 9999)"
```

and replace series-generate count bounds:

```vue
@click="stepField('generateCount', draftForm.generateCount, -1, 1, 100)"
@input="updateStepperField('generateCount', $event.target.value, 1, 100)"
@click="stepField('generateCount', draftForm.generateCount, 1, 1, 100)"
```

- [ ] **Step 3: Add a long-running warning block for large series tasks**

In `renderer/src/App.vue`, add a computed helper:

```js
const currentLongRunningHint = computed(() => {
  const draft = currentDraftForm.value

  if (activeMenu.value === 'series-generate') {
    const totalSubtasks = Math.max(1, Number(draft.generateCount) || 1) * Math.max(1, Number(draft.batchCount) || 1)
    if (totalSubtasks > 300) return '当前任务量很大，将进入长队列执行。'
    if (totalSubtasks > 100) return '当前任务量较大，生成时间会明显变长。'
  }

  if (activeMenu.value === 'series-design') {
    const selectedCount = Array.isArray(draft.imageAssignments)
      ? draft.imageAssignments.filter((item) => item.selected !== false).length
      : 0
    const totalSubtasks = selectedCount * Math.max(1, Number(draft.batchCount) || 1)
    if (totalSubtasks > 300) return '当前任务量很大，将进入长队列执行。'
    if (totalSubtasks > 100) return '当前任务量较大，生成时间会明显变长。'
  }

  return ''
})
```

Pass it into `ParameterSettingsPanel.vue` and render:

```vue
<p v-if="longRunningHint" class="section-copy">{{ longRunningHint }}</p>
```

- [ ] **Step 4: Expand latest-task progress display with current group metadata**

In `renderer/src/components/ResultDisplayPanel.vue`, extend `latestTaskMeta` with:

```js
{
  label: '当前组',
  value: Number.isInteger(props.latestTask.currentGroupIndex)
    ? `第 ${props.latestTask.currentGroupIndex + 1} 组`
    : '--'
},
{
  label: '组内进度',
  value: props.latestTask.currentGroupTotalCount
    ? `${props.latestTask.currentGroupCompletedCount || 0} / ${props.latestTask.currentGroupTotalCount}`
    : '--'
}
```

Keep the card compact, but replace redundant fields before adding more rows.

- [ ] **Step 5: Update source-level renderer tests**

In `tests/renderer/appSource.test.js`, assert:

```js
expect(source).toContain('Math.min(100')
expect(source).toContain('currentLongRunningHint')
expect(source).toContain('当前任务量很大，将进入长队列执行。')
```

In `tests/renderer/componentSource.test.js`, assert:

```js
expect(parameterSource).toContain("stepField('generateCount', draftForm.generateCount, -1, 1, 100)")
expect(parameterSource).toContain("stepField('batchCount', draftForm.batchCount, -1, 1, 9999)")
expect(resultSource).toContain('当前组')
expect(resultSource).toContain('组内进度')
```

- [ ] **Step 6: Run the renderer tests**

Run:

```bash
npm test -- tests/renderer/appSource.test.js tests/renderer/componentSource.test.js
```

Expected:

- PASS
- no outdated `20` or `6` limits remain for these series flows

- [ ] **Step 7: Commit the renderer updates**

```bash
git add renderer/src/App.vue renderer/src/components/ParameterSettingsPanel.vue renderer/src/components/ResultDisplayPanel.vue tests/renderer/appSource.test.js tests/renderer/componentSource.test.js
git commit -m "feat: align series ui with grouped queue execution"
```

## Task 5: Final verification and plan handoff

**Files:**
- Modify: none unless verification fails

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected:

- PASS
- all backend and renderer tests green

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected:

- PASS with zero lint errors

- [ ] **Step 3: Run renderer build**

```bash
npm run build:renderer
```

Expected:

- PASS
- Vite may still show the known CJS deprecation warning, but the build must succeed

- [ ] **Step 4: Verify the working tree**

```bash
git status --short
```

Expected:

- only intended implementation files are modified
- no temporary files remain

- [ ] **Step 5: Create the final implementation commit**

```bash
git add main/src/services/studioImageGenerationService.js main/src/services/studioWorkspaceService.js renderer/src/App.vue renderer/src/components/ParameterSettingsPanel.vue renderer/src/components/ResultDisplayPanel.vue tests/backend/test_studio_image_generation_service.test.js tests/backend/test_studio_workspace_service.test.js tests/renderer/appSource.test.js tests/renderer/componentSource.test.js
git commit -m "feat: add grouped queue concurrency for series generation"
```

## Self-Review Notes

### Spec coverage

- Fixed concurrency `5`: covered in Task 1 and Task 2
- Group-serial execution: covered in Task 1 and Task 2
- Default group size `20`: covered in Task 3 and Task 4
- Maximum group size `100`: covered in Task 2, Task 3, and Task 4
- Unlimited user-facing batch count: covered in Task 4
- Group-oriented output and progress: covered in Task 3 and Task 4
- Long-running task hinting: covered in Task 4

### Placeholder scan

- No `TODO`, `TBD`, or “similar to previous task” steps remain
- Every task includes concrete files, commands, and expected outcomes

### Type consistency

- Uses one shared grouped-progress vocabulary:
  - `groupImageCount`
  - `totalSubtaskCount`
  - `completedSubtaskCount`
  - `failedSubtaskCount`
  - `currentGroupIndex`
  - `currentGroupCompletedCount`
  - `currentGroupTotalCount`
