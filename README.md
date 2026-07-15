# LogPrism

<p align="center">
  <strong>LogPrism</strong> - 专为开发者打造的专业、优雅且高效的本地日志分析与查看器。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-Latest-blue?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/React-18-blue?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Ant_Design-5.x-red?logo=antdesign" alt="Ant Design">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## 📖 项目简介

**LogPrism** 是一款跨平台的本地日志查看器，旨在解决开发与运维排查中遇到的“日志体量大、检索效率低、视觉体验差”等痛点。基于 Electron 桌面端技术，LogPrism 提供了极速的文件变动感知、多维度实时过滤机制以及精心打磨的现代 UI 体验，让排查日志变得轻松高效。

---

## 🛠️ 技术栈 (Tech Stack)

项目基于主流的现代前端与桌面端技术链构建：

*   **核心框架**：[Electron](https://www.electronjs.org/) (提供跨平台桌面端底层支持及原生系统 API 调用)
*   **前端框架**：[React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (保障 UI 逻辑的高可维护性与类型安全)
*   **UI 库**：[Ant Design (v5)](https://ant.design/) (提供深色/明亮模式无缝切换的高级组件及精致的主题配置)
*   **构建工具**：[electron-vite](https://electron-vite.org/) (快速的 HMR 开发体验与优化的分包构建)

---

## 🏗️ 项目架构 (Architecture)

LogPrism 遵循 Electron 的经典**多进程架构**设计，保障了应用的高安全性与高性能：

```
my-log-viewer/
├── src/
│   ├── main/          # 主进程 (Main Process)
│   │                  #  - 处理本地文件系统读写及底层监控 (fs.watch)
│   │                  #  - 管理应用窗口状态、系统菜单和配置持久化 (config.json)
│   │                  #  - 响应渲染进程 of IPC 请求
│   │
│   ├── preload/       # 预加载脚本 (Preload Script)
│   │                  #  - 通过 contextBridge 安全地向渲染进程暴露受限制的 API 
│   │                  #  - 作为主进程与渲染进程之间的安全通信桥梁
│   │
│   └── renderer/      # 渲染进程 (Renderer Process)
│                      #  - 基于 React 构建的视图层
│                      #  - 核心组件 LogViewer.tsx 处理日志解析、过滤计算与高级渲染
│                      #  - 结合 LocalStorage 与全局样式实现深/浅色主题适配
└── resources/         # 静态资源 (图标等)
```

---

## ✨ 核心功能特性 (Features)

### 📂 1. 日志文件加载与变动监控
*   **极速加载**：支持打开 `.log`、`.txt` 等任意本地文本日志。
*   **自动记忆与恢复**：重启应用时，自动恢复上次打开的文件及之前的查看位置。
*   **热刷新（实时监控）**：基于 `fs.watch` 监控。外部文件若追加了新日志，应用会自动刷新并实时显示最新内容。
*   **窗口标题同步**：应用标题动态显示为 `LogPrism - [当前文件绝对路径]`。

### 🔍 2. 多维度实时智能过滤
*   **包含关键词过滤**：支持输入多个关键词（以空格分隔；带空格词组可用双引号 `""` 包裹），支持大小写敏感切换。
*   **排除关键词过滤**：快速隐藏不需要的日志行，支持多词排除。
*   **时间区间过滤**：支持指定开始/结束时间（精确到毫秒 `HH:mm:ss.SSS`），自动解析行首时间戳并进行区间过滤。
*   **实时响应**：所有过滤器、开关的变更均实时生效，无需手动点击“过滤”按钮。

### 🎨 3. 精致的交互与 UI 体验
*   **双色模式一键切换**：支持**暗黑模式 (Dark Mode)** 和 **明亮模式 (Light Mode)**，状态本地持久化。
*   **Tail 追踪模式**：开启时，新日志追加会自动滚动到底部。向上滚动时自动挂起，并通过气泡动态提示有新日志到来，点击可一键触底。
*   **自由缩放字体**：支持 `Ctrl + 鼠标滚轮` 在 `10px` 到 `40px` 之间自由缩放日志字体，自动记忆大小。
*   **行级自定义标记**：支持右键菜单，可为某一行标记高亮背景色（红、蓝、绿、橙、紫），或将其一键设为时间区间的起点/终点。
*   **快捷定位与换行**：右下角提供悬浮的“一键置顶/置底”按钮；状态栏提供自动换行 (Word Wrap) 切换。

---

## 🚀 快速开始 (Getting Started)

### 开发环境准备

确保本地已安装 [Node.js](https://nodejs.org/) (建议 v18+ 或最新 LTS) 以及包管理工具。

### 1. 克隆仓库与安装依赖

```bash
git clone https://github.com/zhenxinglu/LogPrism.git
cd LogPrism
npm install
```

### 2. 启动本地开发服务器

启动热更新开发环境，将拉起调试窗口：

```bash
npm run dev
```

### 3. 项目打包构建 (Production Build)

打包对应平台的安装包：

```bash
# 构建 Windows 版本
npm run build:win

# 构建 macOS 版本
npm run build:mac

# 构建 Linux 版本
npm run build:linux
```

打包完成后，输出的安装文件将会生成在根目录下的 `dist/` 文件夹中。

---

## 🤝 参与贡献 (Contributing)

我们非常欢迎并感谢任何形式的贡献！无论是一起修 bug、新增特性，还是完善文档。您可以：

1.  **提交 Issue**：发现 Bug 或有好的 Feature 创意？请随时提交 [New Issue](https://github.com/zhenxinglu/LogPrism/issues)。
2.  **Pull Request**：
    *   Fork 本仓库。
    *   创建您的特性分支：`git checkout -b feature/amazing-feature`。
    *   提交您的更改：`git commit -m 'feat: add some amazing feature'`。
    *   推送至分支：`git push origin feature/amazing-feature`。
    *   在 GitHub 上发起一个 **Pull Request**。

### 💡 贡献原则
*   代码结构清晰，遵循 ESLint 规范与 Prettier 格式标准。
*   新增复杂逻辑请同步在 `feature.md` 中进行功能记录。
*   合并 PR 前请确保本地能够正常打包通过 (`npm run build:*`)。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 许可开源。
