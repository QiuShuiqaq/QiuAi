# Workbench Network Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为工作台新增低开销的网络监控卡片，并把左侧统计区改为上中下三等分布局。

**Architecture:** 在 HTTP 请求层记录真实远程请求耗时和状态，保存为小型滚动窗口数据，再由工作台快照统一输出给前端。前端工作台左列改为三段布局：上层统计、中层统计、下层网络监控，并用轻量 SVG 折线图展示最近请求耗时。

**Tech Stack:** Electron, Vue 3, Node.js, Vitest, CSS

---

### Task 1: 锁定网络监控需求的失败测试

**Files:**
- Modify: `tests/backend/test_http_client_service.test.js`
- Modify: `tests/backend/test_studio_workspace_service.test.js`
- Modify: `tests/renderer/componentSource.test.js`
- Modify: `tests/renderer/stylesSource.test.js`

- [ ] **Step 1: Write the failing tests**

补充以下断言：

```js
expect(messageRecorder.record).toHaveBeenCalledWith(expect.objectContaining({
  elapsedMs: expect.any(Number),
  requestStatus: 'success'
}))

expect(snapshot.workspaceDashboard.networkMonitor.title).toBe('网络监控')
expect(snapshot.workspaceDashboard.networkMonitor.items).toEqual(expect.any(Array))

expect(dashboardSource).toContain('networkMonitorCard')
expect(dashboardSource).toContain('dashboard-network-monitor')
expect(source).toContain('.dashboard-column__stack')
expect(source).toContain('.dashboard-network-monitor__chart')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests\backend\test_http_client_service.test.js tests\backend\test_studio_workspace_service.test.js tests\renderer\componentSource.test.js tests\renderer\stylesSource.test.js --exclude .worktrees/**`

Expected: FAIL because network monitor snapshot fields, component markup, and latency fields do not exist yet.

### Task 2: 记录真实请求耗时

**Files:**
- Modify: `main/src/services/httpClientService.js`

- [ ] **Step 1: Implement minimal request metric capture**

```js
const startedAt = getNowMs()
const elapsedMs = Math.max(0, getNowMs() - startedAt)
```

并在成功 / 失败时统一追加：

```js
await safeRecordMessage(messageRecorder, {
  kind: 'api',
  method: 'POST',
  apiBaseUrl,
  requestPath,
  requestPayload: payload,
  responseData,
  elapsedMs,
  requestStatus: 'success'
})
```

- [ ] **Step 2: Run focused tests**

Run: `npx vitest run tests\backend\test_http_client_service.test.js --exclude .worktrees/**`

Expected: PASS

### Task 3: 把请求耗时聚合到工作台快照

**Files:**
- Modify: `main/src/services/studioWorkspaceService.js`

- [ ] **Step 1: Build a network monitor card from recorded request messages**

新增一个小型构建函数，读取最近 API 消息，筛选带 `elapsedMs` 的记录，生成：

```js
{
  title: '网络监控',
  items: [{ id, timeLabel, elapsedMs, status, requestPath, method }],
  summary: { latestLatencyMs, averageLatencyMs, successRate }
}
```

- [ ] **Step 2: Wire the card into `buildWorkspaceDashboard`**

```js
return {
  ...workspaceStats,
  creditOverview: buildCreditOverview(settings),
  creditMessages: buildCreditMessages(settings),
  networkMonitor: buildNetworkMonitor(messageRecorder)
}
```

- [ ] **Step 3: Run focused backend tests**

Run: `npx vitest run tests\backend\test_studio_workspace_service.test.js --exclude .worktrees/**`

Expected: PASS

### Task 4: 渲染工作台网络监控与三层左列

**Files:**
- Modify: `renderer/src/components/WorkspaceDashboard.vue`
- Modify: `renderer/src/assets/styles.css`

- [ ] **Step 1: Add the new computed card and SVG chart**

增加：

```js
const networkMonitorCard = computed(() => {
  return props.workspaceDashboard.networkMonitor || {
    title: '网络监控',
    items: [],
    summary: {}
  }
})
```

并渲染轻量折线图与最近请求列表。

- [ ] **Step 2: Restructure the left column into three equal sections**

左列拆成：

```vue
<div class="dashboard-column dashboard-column--stats-stack">
  <div class="dashboard-column__stack">...</div>
  <div class="dashboard-column__stack">...</div>
  <article class="dashboard-stat-card dashboard-network-monitor">...</article>
</div>
```

- [ ] **Step 3: Add responsive, overflow-safe styles**

新增：

```css
.dashboard-column--stats-stack { grid-template-rows: repeat(3, minmax(0, 1fr)); }
.dashboard-column__stack { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.dashboard-network-monitor__chart { width: 100%; height: 100%; }
```

- [ ] **Step 4: Run focused renderer tests**

Run: `npx vitest run tests\renderer\componentSource.test.js tests\renderer\stylesSource.test.js --exclude .worktrees/**`

Expected: PASS

### Task 5: 全量验证

**Files:**
- No source changes

- [ ] **Step 1: Run regression suite**

Run: `npx vitest run tests\backend\test_settings_store_service.test.js tests\backend\test_studio_workspace_service.test.js tests\backend\test_http_client_service.test.js tests\renderer\componentSource.test.js tests\renderer\appSource.test.js tests\renderer\desktopBridge.test.js tests\renderer\stylesSource.test.js --exclude .worktrees/**`

Expected: PASS

- [ ] **Step 2: Launch the app for visual verification**

Run: 现有项目启动命令

Expected: 工作台左列为三层布局，网络监控显示最近请求折线与延迟记录，无新增重叠和全局滚动问题。
