# Prompt Library Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为桌面工作区新增“提示词库”页面，并让套图设计/套图生成的图片类型按钮提示词与模板库联动，同时支持把自定义模板补充导入到当前输入提示词。

**Architecture:** 扩展现有 `promptTemplateStoreService`，把模板拆成固定按钮提示词与自定义提示词两类；`studioImageGenerationService` 不再硬编码图片类型提示词，而是通过模板服务按 key 读取；前端新增独立提示词库页面和局部导入弹层，复用当前工作区表单草稿更新链。

**Tech Stack:** Electron IPC、Vue 3 `<script setup>`、Vitest、Electron Store

---

### Task 1: 先写失败测试锁定新行为

**Files:**
- Modify: `tests/backend/test_prompt_template_store_service.test.js`
- Modify: `tests/backend/test_studio_image_generation_service.test.js`
- Modify: `tests/renderer/appSource.test.js`
- Modify: `tests/renderer/componentSource.test.js`

- [ ] **Step 1: 写模板服务失败测试**
- [ ] **Step 2: 跑模板服务测试，确认失败**
- [ ] **Step 3: 写工作区/生图服务失败测试**
- [ ] **Step 4: 跑相关测试，确认失败**
- [ ] **Step 5: 写前端源码失败测试**
- [ ] **Step 6: 跑前端源码测试，确认失败**

### Task 2: 扩展模板存储模型

**Files:**
- Modify: `main/src/services/promptTemplateStoreService.js`
- Modify: `main/src/ipc/promptIpc.js`
- Modify: `main/src/bootstrap/registerIpc.js`
- Modify: `renderer/src/services/desktopBridge.js`

- [ ] **Step 1: 给默认模板增加固定 key/type/source 元数据**
- [ ] **Step 2: 增加只读固定模板与可编辑自定义模板的保存/删除约束**
- [ ] **Step 3: 扩展 IPC/bridge，支持提示词模板在工作区读取和保存**
- [ ] **Step 4: 跑模板相关测试，确认通过**

### Task 3: 让套图设计/生成从模板库动态取按钮提示词

**Files:**
- Modify: `main/src/services/studioImageGenerationService.js`
- Modify: `main/src/services/studioWorkspaceService.js`
- Modify: `tests/backend/test_studio_image_generation_service.test.js`

- [ ] **Step 1: 把图片类型到模板 key 的映射抽成稳定配置**
- [ ] **Step 2: 从模板服务读取固定按钮提示词替代硬编码**
- [ ] **Step 3: 保持现有命名与导出逻辑不回退**
- [ ] **Step 4: 跑后端测试，确认通过**

### Task 4: 新增提示词库页面

**Files:**
- Modify: `renderer/src/App.vue`
- Modify: `renderer/src/components/WorkspaceSidebar.vue`
- Modify: `renderer/src/components/DesignWorkspace.vue`
- Create: `renderer/src/components/PromptLibraryPanel.vue`
- Modify: `renderer/src/assets/styles.css`
- Modify: `tests/renderer/appSource.test.js`
- Modify: `tests/renderer/componentSource.test.js`
- Modify: `tests/renderer/stylesSource.test.js`

- [ ] **Step 1: 增加侧边栏“提示词库”菜单**
- [ ] **Step 2: 新建双栏提示词库页面，左侧固定按钮提示词，右侧自定义提示词**
- [ ] **Step 3: 接入列表、保存、删除和消息反馈**
- [ ] **Step 4: 跑前端源码测试，确认通过**

### Task 5: 给套图设计/生成增加“导入”补充交互

**Files:**
- Modify: `renderer/src/components/ParameterSettingsPanel.vue`
- Modify: `renderer/src/App.vue`
- Modify: `renderer/src/assets/styles.css`
- Modify: `tests/renderer/componentSource.test.js`

- [ ] **Step 1: 在图片类型边上增加“导入”按钮**
- [ ] **Step 2: 新增模板选择弹层，只展示自定义模板**
- [ ] **Step 3: 选中模板后把内容追加到当前提示词末尾**
- [ ] **Step 4: 跑相关前端测试，确认通过**

### Task 6: 全量验证

**Files:**
- Modify: `docs/superpowers/plans/2026-04-28-prompt-library-integration.md`

- [ ] **Step 1: 运行 `npm test`**
- [ ] **Step 2: 运行 `npm run lint`**
- [ ] **Step 3: 运行 `npm run build:renderer`**
- [ ] **Step 4: 记录结果并关闭计划**
