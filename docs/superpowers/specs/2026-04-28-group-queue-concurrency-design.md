# QiuAi Group Queue Concurrency Design

Date: 2026-04-28

## Goal

Define a stable execution model for large grouped image-generation tasks in QiuAi.

The design must satisfy these confirmed product rules:

- User-visible output stays group-oriented, not flat task-oriented.
- Backend execution prioritizes stability over peak throughput.
- Concurrency is fixed at `5`.
- Groups execute serially.
- Images inside one group execute in waves with up to `5` concurrent remote jobs.
- Default images per group is `20`.
- Maximum images per group is `100`.
- Batch count has no user-facing hard limit.
- All top-level tasks respect global queue order.

This design applies primarily to:

- `套图设计`
- `套图生成`

## Product Rules

### User-Facing Rules

- A user submits one main task at a time from a design module.
- A main task contains:
  - task name
  - per-group image count
  - batch count
  - prompts and image-type metadata required by the module
- The user sees results only as complete groups:
  - `任务名0`
  - `任务名1`
  - `任务名2`
- Users do not need to understand internal subtask splitting.

### Execution Rules

- Global queue order is strict:
  - the next main task does not begin until the current main task fully finishes or reaches a terminal state
- Inside one main task:
  - group `0` completes before group `1` starts
  - group `1` completes before group `2` starts
- Inside one group:
  - up to `5` remote image jobs run concurrently
  - when one finishes, the next pending image job in the same group starts

## Recommended Execution Model

### Main Task

A main task is one user submission from `套图设计` or `套图生成`.

Examples:

- `BAG-A`, 20 images per group, 8 batches
- `SHOES-B`, 40 images per group, 3 batches

### Group Task

Each batch is converted into a group task.

Example:

- `BAG-A0`
- `BAG-A1`
- `BAG-A2`

Each group task is the unit of ordered output.

### Image Subtask

Each generated or replaced image inside one group is one remote image subtask.

Examples:

- `套图生成`: one target image slot = one subtask
- `套图设计`: one selected replacement slot = one subtask

### Wave Executor

Each group uses a fixed-width executor:

- max parallel width: `5`
- scheduler type: refill-on-complete
- retry policy: applied per subtask

This keeps remote pressure bounded and makes progress reporting more accurate.

## Module-Specific Interpretation

### 套图设计

User behavior:

- Upload one source set
- Choose which image positions should be replaced
- Configure prompt and image type for each selected position
- Choose batch count

Backend behavior:

- Only selected positions generate remote subtasks
- Non-selected positions are copied through unchanged
- One batch produces one full result group
- Output remains a complete set for every group

Example:

- source set size: `20`
- selected replacement positions: `3`
- batches: `5`
- remote subtasks: `15`
- delivered output: `5` complete groups, each containing `20` images

### 套图生成

User behavior:

- Upload one reference image
- Set group image count
- Provide one image type and one prompt for every target slot
- Choose batch count

Backend behavior:

- Every target slot becomes one remote subtask
- One batch produces one full result group
- Group output is stored only after the whole group reaches a terminal state

Example:

- images per group: `20`
- batches: `10`
- remote subtasks: `200`
- execution mode:
  - group 0: 20 images in 4 waves
  - group 1: 20 images in 4 waves
  - continue until group 9

## Queue and Ordering

### Global Queue

One shared queue is recommended for all heavy studio generation tasks.

Benefits:

- user expectations stay simple
- resource contention stays bounded
- progress reporting remains understandable
- failure recovery is easier than multi-queue interleaving

Recommended ordering:

1. task creation time ascending
2. same task: group index ascending
3. same group: image slot index ascending

### Why Group-Serial Is Preferred

`组内并行 5，组间串行` is preferred because:

- results arrive in a user-friendly order
- storage layout is straightforward
- progress can be computed from completed subtasks
- retries stay local to one group
- one bad group does not corrupt output ordering for later groups

## Progress Model

### Main Task Progress

Main task progress should be based on completed image subtasks, not synthetic percentage jumps.

Formula:

`progress = completed_subtasks / total_subtasks`

Where:

- `total_subtasks`
  - `套图生成` = `images_per_group * batch_count`
  - `套图设计` = `selected_slots * batch_count`
- `completed_subtasks`
  - successful subtasks + terminal failed subtasks

### Group Progress

Each group should expose:

- total subtasks in current group
- completed subtasks in current group
- running subtasks in current group
- failed subtasks in current group

### UI Recommendation

`工作台` queue:

- show main task overall progress
- show creation time
- show current group index if available

`效果展示` latest task card:

- show latest task name
- show current group
- show completed count in current group
- show total progress percent

This avoids the current “stuck at 5% then jump to 100%” behavior.

## Failure Handling

### Retry Policy

Recommended:

- automatic retries per image subtask: `2`
- retry only the failed subtask
- do not restart a successful subtask

### Group Terminal State

A group may finish in one of these internal states:

- `succeeded`
- `partial_failed`
- `failed`

User-facing text can remain simplified, but backend must track the distinction.

### Main Task Terminal State

A main task may finish in:

- `succeeded`
- `partial_failed`
- `failed`

The recommended rule is:

- if at least one group succeeds and some image subtasks fail permanently:
  - main task = `partial_failed`
- if every required subtask fails:
  - main task = `failed`

### Recovery

Support a future action:

- `重跑失败项`

This action should:

- rebuild only failed image subtasks
- keep successful outputs untouched
- preserve original group numbering

## Storage Layout

### Output Root

Keep existing feature-based storage and strengthen group-level organization.

Recommended structure:

`DATA/output/<feature>/<task-id>/<group-folder>/`

Examples:

- `DATA/output/series-generate/<task-id>/BAG-A0/`
- `DATA/output/series-generate/<task-id>/BAG-A1/`
- `DATA/output/series-design/<task-id>/BAG-A0/`

### File Naming

Use image type plus auto-incremented index inside the group.

Examples:

- `主图0.png`
- `主图1.png`
- `详情图0.png`
- `细节图0.png`
- `尺寸图0.png`
- `白底图0.png`
- `颜色图0.png`

This keeps exported groups readable for non-technical users.

### Export Panel

The export panel should remain group-folder oriented:

- each group folder is one export item
- users select folders, not individual files
- prior generated folders must remain discoverable from real disk state

## Capacity and Protection Strategy

### User-Facing Limits

- default images per group: `20`
- maximum images per group: `100`
- batch count: no hard user-facing limit

### Internal Protection

Even without a user-facing batch cap, the backend must protect itself.

Recommended protections:

- always enforce concurrency `5`
- never flatten all groups into one giant concurrent batch
- compute expected total subtasks before execution
- if total subtasks are large:
  - accept the task
  - mark it as long-running
  - keep it queued instead of rejecting it

Recommended long-running hint threshold:

- show warning when total subtasks exceed `100`
- show stronger warning when total subtasks exceed `300`

This is an experience safeguard, not a submission blocker.

## Data Model Additions

The current task record should be extended with these fields:

- `groupImageCount`
- `batchCount`
- `totalSubtaskCount`
- `completedSubtaskCount`
- `failedSubtaskCount`
- `currentGroupIndex`
- `currentGroupCompletedCount`
- `currentGroupTotalCount`
- `resultMode: grouped`

Each group result should track:

- `groupIndex`
- `groupTitle`
- `status`
- `completedCount`
- `failedCount`
- `outputs`

Each image output should track:

- `slotIndex`
- `imageType`
- `prompt`
- `model`
- `savedPath`
- `attemptCount`
- `status`

## Error Handling

The backend should distinguish:

- transient remote error
- moderation failure
- invalid prompt or invalid input
- local save failure
- local queue interruption

Recommended handling:

- transient remote error:
  - retry up to 2 times
- moderation or invalid input:
  - mark subtask failed immediately
- local save failure:
  - fail current subtask and log exact path context
- queue interruption:
  - preserve current completed outputs and task state

All task API requests and remote responses should continue to be recorded to:

- `DATA/message.txt`

All runtime status and errors should continue to be recorded to:

- `DATA/log.txt`

## Implementation Boundaries

This design does not require the user-facing layout to change first.

The implementation focus should be:

1. queue execution model
2. task progress accounting
3. grouped persistence behavior
4. failure retry and recovery state
5. export linkage to real grouped storage

## Testing Strategy

### Backend

Add tests for:

- group-serial execution ordering
- max concurrency width of 5
- correct progress accounting from subtask completion
- partial failure behavior
- retry count behavior
- grouped output folder naming
- restart or refresh preserving task/group state

### Renderer

Add tests for:

- latest task progress showing current group metadata
- export panel continuing to show grouped folder entries
- long-running warning text for large total subtask counts

## Recommendation

Proceed with this design as the default execution model for heavy grouped image generation.

It is not the fastest theoretical model, but it is the best fit for:

- non-technical users
- grouped result expectations
- queue clarity
- predictable storage
- lower operational failure rate
