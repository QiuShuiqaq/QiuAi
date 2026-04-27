# QiuAi Local Ecommerce Task Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build local-first ecommerce task modes for QiuAi, including style-batch generation, product-detail set generation, local prompt template management, and task-level export while preserving the existing single-generation workflow.

**Architecture:** Keep Electron main as the owner of local persistence, file-system access, IPC, API submission, polling, and export. Expand the Vue renderer into a task workspace that switches between single generation, style batch, and detail-set flows, while using small focused services for prompt templates, local input assets, and task records.

**Tech Stack:** Electron, Vue 3, Vitest, ESLint, electron-store, axios, Node fs/path, one zip dependency for local task export

---

### Task 1: Extend shared IPC surface

**Files:**
- Modify: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\shared\ipcChannels.js`
- Modify: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\main\preload.js`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\backend\test_preload_source.test.js`

- [ ] **Step 1: Write the failing test**

```js
expect(source).toContain("PROMPTS_LIST: 'prompts:list'")
expect(source).toContain("TASKS_CREATE_LOCAL: 'tasks:create-local'")
expect(source).toContain("TASKS_EXPORT: 'tasks:export'")
expect(source).toContain('channels')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/backend/test_preload_source.test.js`
Expected: FAIL because the new channels are missing from shared IPC or preload exposure.

- [ ] **Step 3: Write minimal implementation**

```js
module.exports = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  DRAW_CREATE_TASK: 'draw:create-task',
  DRAW_GET_RESULT: 'draw:get-result',
  DRAW_DOWNLOAD_IMAGE: 'draw:download-image',
  INPUT_PICK_FOLDER: 'input:pick-folder',
  INPUT_PICK_FILE: 'input:pick-file',
  PROMPTS_LIST: 'prompts:list',
  PROMPTS_SAVE: 'prompts:save',
  PROMPTS_REMOVE: 'prompts:remove',
  TASKS_CREATE_LOCAL: 'tasks:create-local',
  TASKS_LIST: 'tasks:list',
  TASKS_RUN: 'tasks:run',
  TASKS_GET: 'tasks:get',
  TASKS_EXPORT: 'tasks:export'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/backend/test_preload_source.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/ipcChannels.js main/preload.js tests/backend/test_preload_source.test.js
git commit -m "test: add ipc coverage for local task modes"
```

### Task 2: Add local prompt-template persistence

**Files:**
- Create: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\main\src\services\promptTemplateStoreService.js`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\backend\test_prompt_template_store_service.test.js`

- [ ] **Step 1: Write the failing test**

```js
const templates = service.listTemplates()
expect(templates.length).toBeGreaterThan(0)

const saved = await service.saveTemplate({
  name: '统一场景图',
  category: '风格统一',
  prompt: '统一暖色电商场景'
})

expect(saved.name).toBe('统一场景图')
expect(service.listTemplates().some((item) => item.id === saved.id)).toBe(true)

await service.removeTemplate(saved.id)
expect(service.listTemplates().some((item) => item.id === saved.id)).toBe(false)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/backend/test_prompt_template_store_service.test.js`
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
const TEMPLATE_KEY = 'promptTemplates'

function createPromptTemplateStoreService ({ store, createId = () => crypto.randomUUID() }) {
  function listTemplates () {
    const templates = store.get(TEMPLATE_KEY)
    return Array.isArray(templates) && templates.length ? templates : defaultTemplates
  }

  async function saveTemplate (payload = {}) {
    const templates = listTemplates()
    const nextTemplate = {
      id: payload.id || createId(),
      name: payload.name || '',
      category: payload.category || '',
      prompt: payload.prompt || ''
    }
    const nextTemplates = [...templates.filter((item) => item.id !== nextTemplate.id), nextTemplate]
    store.set(TEMPLATE_KEY, nextTemplates)
    return nextTemplate
  }

  async function removeTemplate (id) {
    store.set(TEMPLATE_KEY, listTemplates().filter((item) => item.id !== id))
  }

  return { listTemplates, saveTemplate, removeTemplate }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/backend/test_prompt_template_store_service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add main/src/services/promptTemplateStoreService.js tests/backend/test_prompt_template_store_service.test.js
git commit -m "feat: add local prompt template store"
```

### Task 3: Add local asset selection and base64 reference encoding

**Files:**
- Create: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\main\src\services\localInputAssetService.js`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\backend\test_local_input_asset_service.test.js`

- [ ] **Step 1: Write the failing test**

```js
expect(listSupportedImageFiles(['a.png', 'b.txt', 'c.jpg'])).toEqual(['a.png', 'c.jpg'])

const dataUrl = await toDataUrl({
  filePath: fixturePath,
  mimeType: 'image/png'
}, {
  readFile: async () => Buffer.from('hello')
})

expect(dataUrl).toBe(`data:image/png;base64,${Buffer.from('hello').toString('base64')}`)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/backend/test_local_input_asset_service.test.js`
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
const supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp'])

function listSupportedImageFiles (filePaths = []) {
  return filePaths.filter((filePath) => supportedExtensions.has(path.extname(filePath).toLowerCase()))
}

async function toDataUrl ({ filePath, mimeType }, { readFile = fs.readFile } = {}) {
  const buffer = await readFile(filePath)
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/backend/test_local_input_asset_service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add main/src/services/localInputAssetService.js tests/backend/test_local_input_asset_service.test.js
git commit -m "feat: add local input asset helpers"
```

### Task 4: Extend draw task submission to support reference images

**Files:**
- Modify: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\main\src\services\drawTaskService.js`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\backend\test_draw_task_service.test.js`

- [ ] **Step 1: Write the failing test**

```js
await createDrawTask({
  prompt: '统一白底电商产品图',
  size: '1:1',
  urls: ['data:image/png;base64,AAA']
}, {
  httpClient: { post }
})

expect(post).toHaveBeenCalledWith('/v1/draw/completions', {
  model: 'gpt-image-2',
  prompt: '统一白底电商产品图',
  size: '1:1',
  urls: ['data:image/png;base64,AAA'],
  webHook: '-1',
  shutProgress: false
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/backend/test_draw_task_service.test.js`
Expected: FAIL because `urls` is not included in the payload.

- [ ] **Step 3: Write minimal implementation**

```js
async function createDrawTask ({ prompt, size, urls = [] }, { httpClient }) {
  const response = await httpClient.post('/v1/draw/completions', {
    model: 'gpt-image-2',
    prompt,
    size,
    urls,
    webHook: '-1',
    shutProgress: false
  })
  // existing success check remains
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/backend/test_draw_task_service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add main/src/services/drawTaskService.js tests/backend/test_draw_task_service.test.js
git commit -m "feat: support reference image payloads"
```

### Task 5: Add local task persistence and status aggregation

**Files:**
- Create: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\main\src\services\localTaskStoreService.js`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\backend\test_local_task_store_service.test.js`

- [ ] **Step 1: Write the failing test**

```js
const task = await service.createTask({
  mode: 'style-batch',
  name: '春夏女装风格统一',
  items: [{ id: '1', status: 'pending' }, { id: '2', status: 'pending' }]
})

expect(task.status).toBe('draft')

await service.updateTaskItem(task.id, '1', { status: 'succeeded', progress: 100 })
await service.updateTaskItem(task.id, '2', { status: 'failed', progress: 100 })

const nextTask = service.getTask(task.id)
expect(nextTask.status).toBe('partial')
expect(nextTask.progress).toBe(100)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/backend/test_local_task_store_service.test.js`
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
function summarizeTask (task) {
  const items = task.items || []
  const succeeded = items.filter((item) => item.status === 'succeeded').length
  const failed = items.filter((item) => item.status === 'failed').length
  const done = items.filter((item) => ['succeeded', 'failed'].includes(item.status)).length
  const progress = items.length ? Math.round((done / items.length) * 100) : 0
  let status = 'running'
  if (!items.length) status = 'draft'
  else if (succeeded === items.length) status = 'succeeded'
  else if (failed === items.length) status = 'failed'
  else if (succeeded > 0 && failed > 0 && done === items.length) status = 'partial'
  else if (done === 0) status = 'draft'
  return { ...task, status, progress }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/backend/test_local_task_store_service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add main/src/services/localTaskStoreService.js tests/backend/test_local_task_store_service.test.js
git commit -m "feat: add local task store"
```

### Task 6: Add task-mode orchestration service

**Files:**
- Create: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\main\src\services\taskModeService.js`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\backend\test_task_mode_service.test.js`

- [ ] **Step 1: Write the failing test**

```js
const task = await service.createStyleBatchTask({
  folderPath: 'C:/input',
  prompt: '统一极简白底服饰摄影',
  size: '1:1',
  sourcePaths: ['C:/input/a.png', 'C:/input/b.png']
})

expect(task.mode).toBe('style-batch')
expect(task.items).toHaveLength(2)

const detailTask = await service.createDetailSetTask({
  sourcePath: 'C:/input/product.png',
  basePrompt: '高级电商详情页'
})

expect(detailTask.items.map((item) => item.label)).toEqual([
  '白底主图',
  '场景图',
  '卖点图',
  '细节图'
])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/backend/test_task_mode_service.test.js`
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
const DETAIL_PRESETS = [
  { label: '白底主图', suffix: '白底主图，突出主体，电商产品摄影' },
  { label: '场景图', suffix: '电商生活方式场景图，风格统一' },
  { label: '卖点图', suffix: '卖点构图图，突出核心优势' },
  { label: '细节图', suffix: '细节特写图，强调材质和工艺' }
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/backend/test_task_mode_service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add main/src/services/taskModeService.js tests/backend/test_task_mode_service.test.js
git commit -m "feat: add local ecommerce task modes"
```

### Task 7: Add IPC handlers for prompts, local inputs, tasks, and export

**Files:**
- Modify: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\main\src\bootstrap\registerIpc.js`
- Create: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\main\src\ipc\promptIpc.js`
- Create: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\main\src\ipc\taskIpc.js`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\backend\test_register_ipc_source.test.js`

- [ ] **Step 1: Write the failing test**

```js
expect(source).toContain("require('../ipc/promptIpc')")
expect(source).toContain("require('../ipc/taskIpc')")
expect(source).toContain('registerPromptIpc')
expect(source).toContain('registerTaskIpc')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/backend/test_register_ipc_source.test.js`
Expected: FAIL because the new IPC registration code is missing.

- [ ] **Step 3: Write minimal implementation**

```js
registerPromptIpc({ promptTemplateService })
registerTaskIpc({
  settingsService,
  promptTemplateService,
  localTaskStoreService,
  taskModeService
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/backend/test_register_ipc_source.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add main/src/bootstrap/registerIpc.js main/src/ipc/promptIpc.js main/src/ipc/taskIpc.js tests/backend/test_register_ipc_source.test.js
git commit -m "feat: add ipc handlers for local task workflow"
```

### Task 8: Add task export service

**Files:**
- Create: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\main\src\services\taskExportService.js`
- Modify: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\package.json`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\backend\test_task_export_service.test.js`

- [ ] **Step 1: Write the failing test**

```js
const result = await exportTaskDirectory({
  sourceDirectory: 'C:/QiuAi/output/task-1',
  targetZipPath: 'C:/QiuAi/output/task-1.zip'
}, {
  createWriteStream,
  createArchive
})

expect(result.targetZipPath).toBe('C:/QiuAi/output/task-1.zip')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/backend/test_task_export_service.test.js`
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
async function exportTaskDirectory ({ sourceDirectory, targetZipPath }, deps = {}) {
  const archive = deps.createArchive ? deps.createArchive() : archiver('zip', { zlib: { level: 9 } })
  // pipe archive to write stream, directory(sourceDirectory, false), finalize()
  return { targetZipPath }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/backend/test_task_export_service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json main/src/services/taskExportService.js tests/backend/test_task_export_service.test.js
git commit -m "feat: add task archive export"
```

### Task 9: Extend renderer bridge and app store for local task modes

**Files:**
- Modify: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\renderer\src\services\desktopBridge.js`
- Modify: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\renderer\src\stores\appStore.js`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\renderer\appStore.test.js`

- [ ] **Step 1: Write the failing test**

```js
expect(state.generation.mode).toBe('single')
expect(Array.isArray(state.promptTemplates)).toBe(true)
expect(Array.isArray(state.localTasks)).toBe(true)
expect(state.generation.styleSourceFolder).toBe('')
expect(state.generation.detailSourceImage).toBe('')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/renderer/appStore.test.js`
Expected: FAIL because the state fields do not exist.

- [ ] **Step 3: Write minimal implementation**

```js
generation: {
  mode: 'single',
  prompt: '',
  size: '1:1',
  templateId: '',
  styleSourceFolder: '',
  styleSourceFiles: [],
  detailSourceImage: '',
  isSubmitting: false
},
promptTemplates: [],
localTasks: [],
selectedTaskId: ''
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/renderer/appStore.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add renderer/src/services/desktopBridge.js renderer/src/stores/appStore.js tests/renderer/appStore.test.js
git commit -m "feat: add renderer state for local task modes"
```

### Task 10: Replace the generation page with a local task workspace

**Files:**
- Modify: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\renderer\src\pages\GenerationPage.vue`
- Modify: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\renderer\src\App.vue`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\renderer\generationPageSource.test.js`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\renderer\appSource.test.js`

- [ ] **Step 1: Write the failing tests**

```js
expect(source).toContain('single')
expect(source).toContain('style-batch')
expect(source).toContain('detail-set')
expect(source).toContain('提示词模板')
expect(source).toContain('选择文件夹')
expect(source).toContain('选择商品图')
expect(source).toContain('导出任务')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/renderer/generationPageSource.test.js tests/renderer/appSource.test.js`
Expected: FAIL because the new UI strings and handlers are missing.

- [ ] **Step 3: Write minimal implementation**

```vue
<button @click="pickStyleFolder">选择文件夹</button>
<button @click="pickDetailImage">选择商品图</button>
<button @click="submitHandler">开始任务</button>
<button @click="exportHandler">导出任务</button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/renderer/generationPageSource.test.js tests/renderer/appSource.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add renderer/src/pages/GenerationPage.vue renderer/src/App.vue tests/renderer/generationPageSource.test.js tests/renderer/appSource.test.js
git commit -m "feat: build local task workspace ui"
```

### Task 11: Add prompt-template manager UI

**Files:**
- Create: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\renderer\src\components\PromptTemplateManager.vue`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\renderer\promptTemplateManagerSource.test.js`

- [ ] **Step 1: Write the failing test**

```js
expect(source).toContain('新建模板')
expect(source).toContain('保存模板')
expect(source).toContain('删除模板')
expect(source).toContain('category')
expect(source).toContain('prompt')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/renderer/promptTemplateManagerSource.test.js`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Write minimal implementation**

```vue
<label><span>模板名称</span><input v-model="draft.name" /></label>
<label><span>分类</span><input v-model="draft.category" /></label>
<label><span>提示词</span><textarea v-model="draft.prompt" /></label>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/renderer/promptTemplateManagerSource.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add renderer/src/components/PromptTemplateManager.vue tests/renderer/promptTemplateManagerSource.test.js
git commit -m "feat: add local prompt template manager"
```

### Task 12: Verify the full implementation

**Files:**
- Modify: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\renderer\src\assets\styles.css`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\backend\*.test.js`
- Test: `F:\ProgramDevelopment\VSCODE\vscode\VSCode2026.4\workspace\QiuAi\tests\renderer\*.test.js`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS with zero failing tests.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS with zero lint errors.

- [ ] **Step 3: Run renderer build**

Run: `npm run build:renderer`
Expected: PASS and emit `renderer/dist`.

- [ ] **Step 4: Do a local smoke pass**

Run: `npm run dev`
Expected: Electron opens, mode switch works, folder picker works, image picker works, prompt templates save locally, task results preview, and task export writes a local zip file.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add local ecommerce task workflow"
```
