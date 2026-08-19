# LogPrism 开发指南 (Development Tips)

本文档记录 LogPrism 项目的日常开发、版本管理、本地运行及打包分发相关指南。

---

## 1. 软件版本号提升 (Version Bump)

LogPrism 的应用版本号由 Electron 主进程通过 `app.getVersion()` 动态获取（读取 `package.json` 中的 `version` 字段），并同步给渲染进程与 `electron-builder` 打包配置。

### 1.1 升级版本号步骤

从 `1.1.0` 升级到 `1.2.0`（或任意新版本）：

#### 方式一：使用 npm 命令自动更新（推荐）

```bash
# 升级 Minor 版本 (例如: 1.1.0 -> 1.2.0)
npm version minor --no-git-tag-version

# 升级 Patch 修复版本 (例如: 1.1.0 -> 1.1.1)
npm version patch --no-git-tag-version

# 升级 Major 主版本 (例如: 1.1.0 -> 2.0.0)
npm version major --no-git-tag-version

# 或者指定具体版本号
npm version 1.2.0 --no-git-tag-version
```

> **说明**：加上 `--no-git-tag-version` 可以仅修改 `package.json` 和 `package-lock.json` / `bun.lock`，而不会自动创建 git commit 和 tag。

#### 方式二：手动修改

1. 打开 `package.json`，修改 `"version"` 字段：
   ```json
   {
     "name": "log-prism",
     "version": "1.2.0",
     ...
   }
   ```
2. 运行依赖同步命令以更新 lockfile：
   ```bash
   npm install
   # 或
   bun install
   ```

### 1.2 更新发版日志 (Release Notes)

修改版本号后，建议在 `RELEASE_NOTES.md` 中记录该版本的改动：

```markdown
## [1.2.0] - YYYY-MM-DD

### 🚀 New Features & Enhancements
- Feature description...

### 🐛 Bug Fixes & Reliability
- Bug fix description...
```

### 1.3 自动生效范围

- **应用界面**：状态栏与关于弹窗自动显示新版本号 `v1.2.0`。
- **打包命名**：`electron-builder.yml` 中已配置 `${name}-${version}-setup.${ext}`，打包输出文件将自动命名为 `log-prism-1.2.0-setup.exe`。
- **自动更新**：配合 `electron-updater` 发布至 GitHub Release 时自动作为更新检测基准。

---

## 2. 运行程序 (Run Application)

### 2.1 环境准备

- **Node.js**: >= 18.0.0
- **包管理器**: `npm` 或 `bun`

### 2.2 安装依赖

首次拉取代码或更新依赖后执行：

```bash
# 使用 npm
npm install

# 或使用 bun
bun install
```

### 2.3 启动本地开发环境

```bash
# 使用 npm
npm run dev

# 或使用 bun
bun run dev
```

- 该命令启动 `electron-vite dev` 开发服务器。
- 支持渲染进程 React 组件的热重载 (HMR)。
- 默认开启开发者工具 (DevTools) 辅助调试。

### 2.4 本地预览构建模式

在不完整打包的情况下预览生产构建效果：

```bash
npm run start
# 或
bun run start
```

---

## 3. 打包程序 (Package & Build)

打包流程会自动先执行 TypeScript 类型检查 (`npm run typecheck`)，接着通过 `electron-vite build` 编译代码，最后调用 `electron-builder` 生成安装包或可执行文件。

### 3.1 常用打包命令

#### Windows 平台打包（生成安装包与便携版）

```bash
# 使用 npm
npm run build:win

# 或使用 bun
bun run build:win
```

**产物输出位置**：`dist/` 目录
- `dist/log-prism-1.2.0-setup.exe`：NSIS 安装向导程序（自动创建桌面快捷方式与卸载入口）
- `dist/LogPrism 1.2.0.exe`：绿色便携版 (Portable)，双击即可直接运行
- `dist/win-unpacked/`：解包后的可执行目录（包含 `LogPrism.exe` 及依赖 dll）

#### 快速解包测试 (Unpack Directory)

仅生成未压缩的程序目录，不生成 exe 安装包，打包速度极快，适合本地快速验证：

```bash
npm run build:unpack
```
产物位于 `dist/win-unpacked/`。

#### macOS / Linux 平台打包

```bash
# macOS (DMG / Zip)
npm run build:mac

# Linux (AppImage / Snap / Deb)
npm run build:linux
```

---

## 4. 辅助开发命令与实用技巧

| 命令 | 说明 |
| :--- | :--- |
| `npm run typecheck` | 执行主进程与渲染进程的 TypeScript 静态类型校验 |
| `npm run lint` | 运行 ESLint 检查代码规范 |
| `npm run format` | 使用 Prettier 自动格式化项目代码 |

### 4.1 镜像源加速提示
`electron-builder.yml` 中已配置国内 Electron 下载镜像源：
```yaml
electronDownload:
  mirror: https://npmmirror.com/mirrors/electron/
```
若打包时下载 Electron 依赖缓慢，可确保网络能正常访问 npmmirror。

### 4.2 本地自动更新测试
开发环境下如需模拟更新检测，可使用根目录下的 `dev-app-update.yml` 进行配置。
