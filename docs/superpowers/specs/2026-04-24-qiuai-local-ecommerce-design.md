# QiuAi Local Ecommerce Task Modes Design

**Date:** 2026-04-24

## Summary

This design expands `QiuAi` from a single text-to-image desktop tool into a local-first ecommerce image workstation. The application remains an Electron + Vue desktop app. All settings, prompt templates, task records, imported images, exported archives, and generated results stay on the user's computer. The only network traffic is the required image-generation API call to the configured `gpt-image-2` endpoint.

The goal of this phase is to keep the scope tight and runnable. The app will support three generation modes:

1. Single generation
2. Style-consistent batch generation from a local image folder
3. Product-detail set generation from one local product image

## Constraints

- No cloud storage
- No account system
- No remote task center
- No AI chat
- Existing single-image generation flow must keep working
- Existing output saving and preview behavior must keep working
- The domestic default API host remains `https://grsai.dakka.com.cn`
- Each user keeps a separate API key locally in app settings

## Product Scope

### 1. Single Generation

The current mode stays available with minimal disruption. Users enter a prompt, choose a ratio, submit, poll, preview results, and download a saved image. This remains the simplest path and serves as the base path for the new task system.

### 2. Style-Consistent Batch Generation

Users choose a local folder containing ecommerce images. The app loads supported image files from that folder and creates one generation sub-task per source image. Each source image produces exactly one generated output.

The generation request combines:

- a user-entered style prompt or selected prompt template
- the chosen output ratio
- the local source image encoded as a `data:` URL string so the workflow remains local-first

This mode is intentionally minimal. It does not attempt cross-image dependency planning or advanced consistency scoring. The consistency comes from applying the same prompt template and style instructions to each image in the batch.

### 3. Product Detail Set Generation

Users choose one local product image. The app generates a fixed set of ecommerce detail scenes from that one source image. Phase one includes four built-in templates:

- White background main image
- Lifestyle scene image
- Selling point composition image
- Detail close-up image

Each template creates one sub-task. The user can optionally start from a saved prompt template, but the built-in detail types define the first runnable version.

### 4. Prompt Template Management

Prompt templates are stored locally and managed inside the desktop app. A template includes:

- `id`
- `name`
- `category`
- `prompt`

Categories are plain strings. The first UI ships with ecommerce-oriented defaults such as `主图`, `场景图`, `卖点图`, `细节图`, and `风格统一`. Users can create, edit, and delete templates locally.

### 5. Task Management

The app introduces a local task model. A task represents one user-submitted generation batch and contains:

- task metadata
- generation mode
- timestamps
- source file references
- status summary
- child item list
- output directory path

Each task item represents one API sub-task and stores:

- item id
- label
- source image path
- resolved prompt
- remote draw task id
- status
- progress
- saved result list
- failure fields

Tasks are persisted locally so the user can return to them after navigation and after app restart.

### 6. Batch Download

Completed tasks can be exported as a local zip archive. The export packages the task output directory. This is task-level export, not cloud sharing.

## Architecture

### Main Process

The main process remains the owner of desktop-native behaviors and data persistence.

Responsibilities:

- read and save settings
- manage prompt-template persistence
- open file and folder pickers
- create local task records
- submit draw requests
- poll draw results
- save generated images into task output folders
- export a task folder as a zip archive

New services should stay small and focused:

- `promptTemplateStoreService`
- `localTaskStoreService`
- `localInputAssetService`
- `taskModeService`
- `taskExportService`

The existing draw services stay in place and should be extended rather than replaced.

### Renderer Process

The renderer remains a lightweight UI shell. It should render task mode controls, bind local state, and call the preload bridge. Heavy work stays in the main process.

The main generation page becomes a task workspace with:

- mode switcher
- prompt/template controls
- file or folder selection controls
- task submission action
- active task detail view
- recent local task list
- result preview grid

Prompt management can live on the same page or as a small secondary panel. It should remain local and simple.

## Data Model

### Settings

Existing settings remain and gain no cloud-related fields.

```js
{
  apiBaseUrl: 'https://grsai.dakka.com.cn',
  apiKey: '',
  defaultSize: '1:1',
  downloadDirectory: ''
}
```

### Prompt Template

```js
{
  id: 'template-uuid',
  name: '电商白底主图',
  category: '主图',
  prompt: '...'
}
```

### Local Task

```js
{
  id: 'local-task-uuid',
  mode: 'single' | 'style-batch' | 'detail-set',
  name: '任务名称',
  createdAt: '2026-04-24T12:00:00.000Z',
  status: 'draft' | 'running' | 'succeeded' | 'failed' | 'partial',
  progress: 0,
  size: '1:1',
  outputDirectory: '.../output/local-task-uuid',
  templateId: 'template-uuid',
  prompt: 'resolved prompt',
  sourcePaths: ['C:/input/a.png'],
  items: []
}
```

### Local Task Item

```js
{
  id: 'item-uuid',
  label: '白底主图',
  sourcePath: 'C:/input/a.png',
  prompt: 'resolved prompt',
  remoteTaskId: 'api-task-id',
  status: 'pending' | 'submitting' | 'running' | 'succeeded' | 'failed',
  progress: 0,
  failureReason: '',
  error: '',
  results: []
}
```

## Local File Handling

Users work with local images. The app must not upload files to an app-owned cloud location. For generation requests that need reference images, the main process reads the local file and converts it to a base64 `data:` URL. That payload is inserted into the request `urls` array so the renderer never handles raw file buffers and the workflow stays local.

Supported file types in phase one:

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`

Folder import ignores non-image files.

## Request Flow

### Single Generation

1. Renderer submits prompt and size.
2. Main process creates one remote draw task.
3. Main process polls until completion when asked by renderer.
4. Generated result is written into `output/<task-id>/`.
5. Renderer shows preview and download link.

### Style Batch

1. User selects a folder.
2. Main process enumerates image files.
3. Renderer creates one local batch task.
4. Main process submits child tasks one by one.
5. Each child task sends the same style prompt and one source image data URL.
6. Each completed child result is saved into `output/<local-task-id>/`.
7. Task status updates as items finish.

### Detail Set

1. User selects one product image.
2. Main process generates four prompt variants from built-in detail presets.
3. One child task is created per preset.
4. Results save into `output/<local-task-id>/`.

## Error Handling

- Missing API key blocks task submission with a clear local error
- Empty prompt blocks single and style-batch submission
- Empty folder selection blocks style-batch submission
- Missing product image blocks detail-set submission
- Unsupported file types are skipped during folder import
- Remote `code: -22` during polling continues to be treated as a transient running state
- Per-item failures should not discard successful items already saved
- Batch status becomes:
  - `succeeded` when all items succeed
  - `failed` when all items fail
  - `partial` when there is a mix of success and failure

## UI Design

The generation page becomes a practical workbench instead of a single form.

Sections:

1. Hero and current mode
2. Mode switcher
3. Prompt/template controls
4. Input selector area
5. Active task summary
6. Child task list with per-item statuses
7. Result preview grid
8. Prompt template manager

The settings panel remains on the same screen for now so the app stays simple.

## Testing Strategy

Implementation follows TDD. New behavior requires failing tests first.

Backend coverage:

- prompt-template persistence
- local image file discovery
- local file to base64 data URL conversion
- batch task creation and status aggregation
- draw task request payloads with reference image `urls`
- task export zip creation

Renderer coverage:

- app store defaults for task mode and prompt templates
- generation page source tests for mode labels and batch controls
- prompt manager source tests
- bridge methods for new IPC channels

Verification:

- `npm test`
- `npm run lint`
- `npm run build:renderer`

## Non-Goals

- No cloud sync
- No user login
- No multi-user collaboration
- No AI chat
- No advanced prompt workflow automation
- No distributed queueing
- No remote asset hosting

## Implementation Notes

- Keep file boundaries focused; avoid putting batch orchestration into `App.vue`
- Reuse existing result-saving logic for both single and batch tasks
- Prefer local persistence via `electron-store`
- Default to sequential item processing first; concurrency can be added later if needed
- Save every task under a dedicated subdirectory in `output/`
