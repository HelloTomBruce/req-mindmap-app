# DocMind (req-mindmap-app) - Agent 开发与协同工作规约

本项目是 **DocMind（结构化需求文档与 AI 知识工作台）** 的源码仓库。
所有参与本项目的 AI Coding Agent（包括 Antigravity、Claude Code、Cursor 等）必须严格遵守以下技术架构规范与 **DocMind 产品文档协同维护规约**。

---

## 1. 技术栈与系统全景

- **桌面底座**：Tauri v2 (`@tauri-apps/api` v2 + Rust 1.80+)
- **前端视图**：React 19.1 + TypeScript 5.8 + Vite 7 + Tailwind CSS
- **导图与画布**：`@xyflow/react` (React Flow 12) + `dagre` (自动有向图排版引擎)
- **文档与编辑**：`@uiw/react-md-editor` + CodeMirror + Mermaid 图表渲染
- **内置 MCP 服务**：Rust 原生 `axum` + `tokio`（端点：`http://127.0.0.1:6001/sse`，常驻端口 6001）
- **数据存储模式**：Local-First 纯文本规范（`.requirements.json` + `modules/*.md`）

---

## 2. 常用开发与构建命令

```bash
npm run dev           # 启动纯前端 Vite 开发服务 (http://localhost:1420)
npm run tauri dev     # 启动 Tauri 桌面客户端调试环境
npm run build         # 前端 TypeScript 检查与 Vite 打包
npm run lint          # ESLint 代码规范检查
npm run format        # Prettier 代码格式化
```

---

## 3. DocMind PRD 协同开发规约 (Pure MCP 驱动)

本项目自身的产品需求全景已使用 DocMind 维护在 **doc-mind** 项目中。
在任何功能开发、Bug 修复、界面优化或 MCP 工具扩展过程中，**代码与 DocMind 中的产品文档必须通过 MCP 保持双向同步**。

### 3.1 DocMind 基础设施与上下文
- **MCP 服务**：`DocMind`（SSE: `http://127.0.0.1:6001/sse`）
- **项目定位**：完全通过 MCP 接口操作维护，**无需关心本地物理路径**。操作前直接调用：
  ```json
  activate_project({ "name": "doc-mind" })
  ```
- **核心需求模块树（10 大主模块 + 44 个精细化子模块，共 55 篇规格文档）**：
  - `01 产品概述与定位`：
    - `1.1 业务背景与传统 PRD 痛点困局`、`1.2 目标用户画像与核心作业场景`、`1.3 三大核心支柱 (图文双轨/Local-First/MCP-First)`
  - `02 双轨画布与可视化思维导图引擎`：
    - `2.1 Dagre 拓扑自动排版算法与画布控制`、`2.2 节点全生命周期模型与视觉渲染`、`2.3 子树完成度进度条与 P0 紧急告警机制`、`2.4 跨分支依赖拓扑连线 (MindEdge) 与阻塞检测`、`2.5 节点快速编辑交互与快捷键流`
  - `03 沉浸式 Markdown 抽屉与双向链接`：
    - `3.1 抽屉滑出交互与全屏沉浸模式`、`3.2 GFM 规范与暗色水墨 Mermaid 原生渲染`、`3.3 本地资产智能解析与图片内存缓存`、`3.4 [[WikiLink]] 双向链接与实时悬浮自动补全`、`3.5 反向链接 (Backlinks) 拓扑与被引用溯源`、`3.6 MCP 并发写入指示器与热重载`
  - `04 敏捷看板与工作流视图`：
    - `4.1 导图与看板多维视图一键切换`、`4.2 状态分组与优先级分组多维泳道`、`4.3 节点面包屑链路与子树进度统计`、`4.4 拖拽卡片状态流转与持久化`
  - `05 原生 Rust MCP 协议服务层`：
    - `5.1 Axum + Tokio 轻量原生服务架构`、`5.2 Streamable HTTP / SSE 与 JSON-RPC 双协议`、`5.3 13 大全生命周期 AI 工具集接口规格`、`5.4 MCP 控制中心面板与实时日志追踪`、`5.5 多客户端一键配置生成器`
  - `06 长文聚合导出与智能导入引擎`：
    - `6.1 树形深度优先 DFS 遍历与长篇 PRD 汇编`、`6.2 动态 TOC 锚点目录与依赖矩阵生成`、`6.3 离线自包含 HTML 与 PDF 打印导出`、`6.4 外部长篇 Markdown / Word 逆向智能切分`、`6.5 导入预览与本地图片资产自动搬运`
  - `07 多项目管理与预设模板库`：
    - `7.1 本地多项目索引与最近打开历史`、`7.2 新建项目向导与三大开箱即用预设`、`7.3 需求文档模板库 (Feature/Bug/ADR/Story)`、`7.4 用户自定义模板持久化与管理`
  - `08 本地优先存储与 Git 协同`：
    - `8.1 纯文本文件存储规范与数据 Schema`、`8.2 文件系统原子写入与写冲突预防`、`8.3 Git 仓库状态感知与变更监听`、`8.4 可视化代码 Diff 对比与行内差异`、`8.5 一键 Git Commit 暂存与提交工作流`
  - `09 全局命令面板与桌面原生体验`：
    - `9.1 ⌘K 全局悬浮命令面板与模糊搜索`、`9.2 全场景键盘快捷键映射与导航`、`9.3 Tauri v2 原生桌面架构与极速启动`、`9.4 Minisign 数字签名验证与静默自动升级`
  - `10 技术架构与工程实现规范`：
    - `10.1 前后端分层架构与 IPC 桥接`、`10.2 状态流转模型与 React 19 渲染优化`、`10.3 异常捕获边界与容灾降级策略`

### 3.2 迭代协同标准工作流 (AI 必须严格执行)

#### 阶段一：任务开始（需求对齐与状态流转）
1. **激活项目并查阅规格**：
   - 接收任务后，先调用 `activate_project({ "name": "doc-mind" })`；
   - 调用 `search_requirements` 或 `get_requirement_detail` 查阅目标模块的产品定义与技术约定（例如修改导图画布查阅模块 02，修改 Markdown 抽屉查阅模块 03，修改 MCP 逻辑查阅模块 05，修改导入导出查阅模块 06）；
   - 若用户提出新功能或新增模块，调用 `add_node` 在对应模块下创建子需求并补充规格草案。
2. **状态流转**：
   - 调用 `update_requirement_status(node_id, "in_progress")`。

#### 阶段二：代码实现
- 前端组件与样式修改遵循 React 19 与 Tailwind CSS 规范；
- Rust 逻辑（`src-tauri/`）改动确保线程安全与锁正确释放；
- 执行 `npm run lint` 验证无代码规范告警。

#### 阶段三：交付闭环（文档同步与状态闭环）
1. **同步更新产品文档**：
   - 编码完成后，若涉及**新增功能、组件交互改动、MCP 工具集扩充、存储 Schema 变更或模板扩展**，必须同时调用 `update_node` 同步更新 DocMind 对应模块的 Markdown 需求规格；
   - 严禁“只改代码不改 PRD”导致文档漂移。
2. **状态闭环**：
   - 调用 `update_requirement_status(node_id, "completed")`。
3. **交付报告输出**：
   - 汇报时向用户清晰列出代码修改文件清单，以及同步更新的 DocMind PRD 模块名称与变更点。
