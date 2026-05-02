# QiuAi 技术文档

## 1. 项目定位

QiuAi 是一个面向普通用户的本地桌面生图工具，核心目标是把“批量图片生成、批量套图处理、结果导出、任务队列、积分管理、设备授权”等能力收敛到一个 Electron 桌面应用中。

从工程视角看，QiuAi 不是单纯的前端壳应用，而是一个带有明确本地状态管理、任务编排、本地数据落盘、授权校验和 API 代理能力的桌面端系统。

项目当前版本重点强调：

- 本地操作体验
- 面向非技术用户的界面封装
- 批量任务编排
- 结果文件夹化导出
- 本地状态可恢复
- 单机授权控制

## 2. 技术栈

### 2.1 桌面端

- Electron 30
- Vue 3
- Vite 5

### 2.2 本地持久化与工具链

- electron-store
- axios
- archiver
- electron-builder

### 2.3 测试与质量

- Vitest
- ESLint

## 3. 总体架构

QiuAi 采用典型的 Electron 三层结构：

1. `main/`
主进程，负责窗口、IPC 注册、本地文件系统、授权、任务执行、API 调用、日志与数据落盘。

2. `renderer/src/`
渲染层，负责桌面 UI、表单交互、任务提交、结果展示、结果导出、工作台统计和用户反馈。

3. `shared/`
共享常量层，当前主要是 IPC channel 定义，用于主进程和渲染进程之间的协议对齐。

## 4. 目录结构说明

### 4.1 核心源代码目录

- `main/main.js`
  Electron 启动入口。

- `main/preload.js`
  桥接渲染进程与主进程 IPC。

- `main/src/bootstrap/`
  主进程初始化，包括窗口创建、应用生命周期注册、IPC 注册。

- `main/src/ipc/`
  各类 IPC Handler。

- `main/src/services/`
  项目最核心的业务实现层。

- `renderer/src/App.vue`
  渲染层总入口与页面状态编排中心。

- `renderer/src/components/`
  工作台、参数面板、结果展示、结果导出、提示词库、顶部栏、侧边栏等核心组件。

- `shared/ipcChannels.js`
  IPC 通道常量。

### 4.2 本地数据目录

项目通过 `main/src/services/dataPathsService.js` 统一约定数据布局。

默认数据目录：

- 开发环境：`QiuAi/DATA`
- 打包环境：`%APPDATA%/QiuAi/DATA`

主要文件与目录：

- `DATA/input/`
  各功能模块的输入素材存储目录。

- `DATA/output/`
  模型返回结果存储目录，按功能与任务拆分。

- `DATA/message.txt`
  API 请求与返回消息记录。

- `DATA/log.txt`
  运行日志与错误日志。

- `DATA/taskmanager.json`
  工作室任务队列持久化文件。

## 5. 主进程架构

### 5.1 启动入口

`main/main.js` 完成以下职责：

- 在打包环境下重定向 `QIUAI_DATA_ROOT`
- 等待 Electron `app.whenReady()`
- 注册 IPC
- 创建主窗口
- 注册退出时的持久化回调

### 5.2 IPC 注册中心

`main/src/bootstrap/registerIpc.js` 是主进程的装配入口，负责初始化并组装：

- `settingsService`
- `licenseService`
- `activationGuard`
- `promptTemplateService`
- `studioTaskManagerService`
- `studioWorkspaceService`
- `taskModeService`
- `taskRunnerService`
- `dataTraceService`

然后分别注册：

- `settingsIpc`
- `licenseIpc`
- `drawIpc`
- `promptIpc`
- `taskIpc`
- `studioIpc`

这使主进程具备明显的“服务装配层 + IPC 接口层”结构，而不是把逻辑堆在 Electron 入口文件中。

## 6. 渲染层架构

### 6.1 总控组件

`renderer/src/App.vue` 是渲染层的状态中枢，主要职责：

- 维护当前菜单与主题状态
- 拉取工作室快照
- 管理本地表单草稿
- 管理任务列表
- 管理导出项选择
- 管理顶部消息反馈
- 调用 desktop bridge 发起 IPC 请求

它本质上承担了桌面端“页面编排器”的角色。

### 6.2 主要 UI 组件

- `AppTopBar.vue`
  顶栏、激活状态、一键清理、微信/企业微信入口。

- `WorkspaceSidebar.vue`
  左侧菜单导航。

- `DesignWorkspace.vue`
  主工作区编排，根据菜单切换不同中区内容。

- `ParameterSettingsPanel.vue`
  参数输入区，负责四个核心生图模块的表单。

- `ResultDisplayPanel.vue`
  效果展示区，负责任务进度、预览、批次结果展示。

- `ResultExportPanel.vue`
  结果导出区，负责分页、选择、打开目录、删除、批量下载。

- `TaskManagerSidebar.vue`
  工作台下的任务队列展示，以及其他页右侧的导出面板承载。

- `WorkspaceDashboard.vue`
  工作台总览，包括统计、积分仪表盘、API Key、主机信息、网络监控。

- `PromptLibraryPanel.vue`
  提示词库管理页。

## 7. 核心业务模块

### 7.1 工作台

工作台不是任务编辑页，而是总览中心。包含三类信息：

- 四个模块的统计数据
- 积分状态与积分消息记录
- API-Key 配置与主机环境
- 网络请求监控
- 右侧任务队列

其主要价值是把“任务状态、额度状态、设备环境、系统运行情况”集中展示。

### 7.2 单图测试

目标：同一张图、同一套提示词，用四个模型做对比测试。

特征：

- 其中两个模型固定
- 另外两个模型可配置
- 重点是效果对比和预览
- 输出以对比结果为主

### 7.3 单图设计

目标：单模型模式下做文生图或图生图设计。

特征：

- 只选一个模型
- 支持参考图上传
- 重点是单模型定向出图

### 7.4 套图设计

目标：基于一组已有商品图，选择其中若干张进行替换生成，输出仍然以“完整套图”为单位。

特征：

- 一组图上限 30 张
- 用户只对选中的图发起替换生图
- 每张图可独立设置提示词与图片类型
- 输出按组归档，未替换图片保持原样

### 7.5 套图生成

目标：基于一张商品主图扩展出一整套商品图。

特征：

- 单组生成数量建议值为 20，可扩展到 100
- 每一张输出图都必须有对应提示词位
- 支持“商品主图、详情图、细节图、尺寸图、白底图、颜色图”等图片类型
- 图片类型会影响最终拼接提示词
- 保留批次概念，适合批量生产组图

### 7.6 模型价格

模型价格页是展示页，不承载任务。

包含：

- 积分充值档位
- 模型积分消耗卡片

### 7.7 提示词库

提示词库由两部分构成：

- 固定按钮提示词
- 自定义提示词模板

固定模板与“商品主图 / 详情图 / 细节图 / 尺寸图 / 白底图 / 颜色图”一一对应，修改后会直接影响业务表单中的图片类型语义拼接。

## 8. 任务系统设计

### 8.1 两套任务体系

项目实际上存在两条任务线：

1. `studioWorkspaceService`
面向当前主产品界面，负责生图工作室任务。

2. `taskRunnerService / taskModeService`
保留了更通用的任务模式能力。

当前正式主流程主要依赖 `studioWorkspaceService`。

### 8.2 工作室任务的核心职责

`main/src/services/studioWorkspaceService.js` 是项目最关键的服务之一，负责：

- 草稿归一化
- 菜单配置
- 任务创建
- 任务入队
- 任务执行
- 进度回传
- 结果归档
- 工作台统计
- 导出项构建
- 积分冻结 / 结算 / 返还
- 僵尸任务恢复
- 一键清理

### 8.3 任务标识

每次任务提交会生成：

- 唯一任务 `id`
- 用户可见 `taskNumber`

任务会同步写入：

- 应用状态存储
- `taskmanager.json`

### 8.4 队列执行

工作室任务采用顺序队列机制，并在组内任务层面做有限并发。

关键变量：

- `queuedTaskExecutions`
- `activeTaskControllers`
- `isTaskQueueRunning`

这使系统具备：

- 任务顺序可控
- 组内并发可控
- 任务可手动结束
- 进程恢复后可识别残留任务

## 9. 图片生成链路

### 9.1 API 接入层

图片生成逻辑集中在 `studioImageGenerationService.js`。

主要职责：

- 解析模型差异
- 组装 prompt
- 组装参考图
- 选择图片比例与尺寸
- 发起远程任务
- 轮询 / 接收进度
- 下载结果图片
- 保存到本地输出目录

### 9.2 模型策略

项目当前保留的图像模型主要包括：

- `gpt-image-2`
- `nano-banana-fast`
- `nano-banana-2`
- `nano-banana-2-cl`
- `nano-banana-pro`
- `nano-banana-pro-vt`
- `nano-banana-pro-cl`
- `nano-banana-pro-vip`
- `nano-banana-2-4k-cl`
- `nano-banana-pro-4k-vip`
- `nano-banana`

### 9.3 比例映射

渲染层对用户暴露的是常见比例与印刷尺寸名称。
主进程最终通过 `ASPECT_RATIO_PRESET_MAP` 映射到模型接口可识别的比例值，例如：

- `A4 竖版 -> 3:4`
- `A4 横版 -> 4:3`
- `8K 横版 -> 16:9`

### 9.4 套图生成语义增强

`SERIES_GENERATE_IMAGE_TYPE_CONFIG` 为不同图片类型配置了：

- 输出标签
- 模板 ID
- 默认指令

这使“图片类型”不仅是命名信息，也是提示词语义约束的一部分。

## 10. 本地存储设计

### 10.1 输入存储

用户上传素材不会只停留在前端内存中，会在任务执行期按模块与任务写入 `DATA/input`。

### 10.2 输出存储

模型结果按功能和任务目录写入 `DATA/output`，并与“结果导出”联动。

导出不是读取临时内存，而是读取真实文件系统目录。

### 10.3 日志与消息追踪

`dataTraceService` 负责消息和日志数据落盘：

- 请求消息记录到 `message.txt`
- 运行日志记录到 `log.txt`

`consoleCaptureService` 会把控制台日志同步收集，便于定位问题。

## 11. 配置与状态管理

### 11.1 设置存储

`settingsStoreService.js` 负责统一管理：

- API Base URL
- API Key 双槽位
- 激活使用的 Key 索引
- 默认上传目录
- 主题
- 积分状态

### 11.2 积分状态

项目内部维护一套本地积分账本，字段包括：

- `totalPurchasedCredits`
- `remainingCredits`
- `frozenCredits`
- `usedCredits`
- `adjustmentHistory`
- `activityHistory`
- `taskLedger`

用途不是支付，而是本地额度展示与任务扣减模拟。

### 11.3 草稿与运行态

工作室运行态保存在 `studioWorkspace` store 中，包含：

- 表单草稿
- 结果展示数据
- 导出项缓存
- 请求监控数据

一键清理只清运行态，不清结果产物、API Key、保存目录、提示词库。

## 12. 授权与设备锁

### 12.1 设计目标

QiuAi 当前采用单机永久授权思路，而不是在线用户系统。

### 12.2 组成

- `deviceFingerprintService`
  生成设备码。

- `licenseService`
  负责授权校验。

- `activationGuardService`
  在创建任务等关键动作前做激活拦截。

- `ActivationGate.vue`
  渲染层授权入口。

### 12.3 运行方式

未激活设备不能进入完整工作流。激活通过导入授权文件完成。

## 13. 结果导出与删除

### 13.1 导出

结果导出按“分组文件夹”组织，而不是按单张图零散导出。

用户可以：

- 勾选多个结果组
- 打开输出目录
- 批量打包下载

### 13.2 删除

删除逻辑作用于真实输出目录，并且限制必须在允许的输出目录范围内，避免误删其他位置文件。

## 14. 可靠性设计

### 14.1 僵尸任务恢复

这是当前版本一个关键成熟点。

如果程序异常退出，磁盘中可能残留 `等待中 / 进行中` 任务。项目已经补了恢复逻辑：

- 当前进程若没有对应执行控制器
- 则将这些残留任务自动置为失败
- 并返还冻结积分

这样可以避免：

- 一键清理被永久卡住
- 积分长期冻结
- 用户误以为任务仍在运行

### 14.2 手动结束任务

对等待中和进行中的任务提供“结束任务”按钮，结束后：

- 任务标记失败
- 已生成结果保留
- 冻结积分返还

## 15. 测试策略

项目已经具备较完整的自动化测试基础，覆盖：

- 主进程入口与 IPC 注册
- 设置存储
- 数据路径
- 授权逻辑
- 图片生成服务
- 工作室任务服务
- 渲染层源码结构
- 样式关键约束
- 打包配置

测试目录：

- `tests/backend/`
- `tests/renderer/`
- `tests/setup/`

## 16. 打包与发布

### 16.1 开发启动

- `npm run dev`

### 16.2 构建渲染层

- `npm run build:renderer`

### 16.3 Windows 打包

- `npm run package:win`

生成位置：

- `workspace/package/QiuAi-win`

打包目标：

- NSIS 安装包
- Portable 单文件包

## 17. 当前工程特点总结

从软件工程角度看，QiuAi 的成熟度已经明显超过“原型界面”阶段，主要体现在：

- 主进程服务拆分清晰
- IPC 分层明确
- 本地数据路径统一
- 任务系统和导出系统闭环完整
- 积分账本与任务账本挂钩
- 授权逻辑独立
- 自动化测试基础完备
- Windows 打包链路已成型

## 18. 后续可继续优化的工程点

如果把当前版本进一步推进到长期维护的正式商用版本，建议继续加强：

- 补充更多“冷启动恢复”测试
- 为任务恢复与清理增加更细致的审计日志
- 增加应用内“导出日志”功能
- 给 API 接口失败增加统一错误码映射
- 对渲染层状态编排继续做模块化拆分
- 增加版本更新与迁移策略

---

文档说明：

本文件从软件工程和代码组织视角说明 QiuAi 的当前实现，不代替用户操作手册。
