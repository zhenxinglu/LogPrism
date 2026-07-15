# LogPrism

<p align="center">
  <strong>LogPrism</strong> - A professional, elegant, and efficient local log analysis viewer designed for developers.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-Latest-blue?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/React-18-blue?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Ant_Design-5.x-red?logo=antdesign" alt="Ant Design">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## 📖 Introduction

**LogPrism** is a cross-platform desktop log viewer designed to tackle common developer pain points: large log files, slow search/retrieval, and uninspired UI designs. Built on Electron, LogPrism offers real-time file change detection, multi-dimensional search filters, and a highly polished user experience.

---

## 🛠️ Tech Stack

Built with a modern, industry-standard desktop development ecosystem:

*   **Core Desktop Framework**: [Electron](https://www.electronjs.org/) (for native cross-platform window management and OS APIs)
*   **UI Architecture**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (for type safety and component-driven view layers)
*   **Design System**: [Ant Design (v5)](https://ant.design/) (for seamless Dark/Light theme transitions and premium component aesthetics)
*   **Build System**: [electron-vite](https://electron-vite.org/) (providing fast HMR during development and highly optimized production builds)

---

## 🏗️ Architecture

LogPrism implements Electron's classic **multi-process architecture** for security and speed:

```
my-log-viewer/
├── src/
│   ├── main/          # Main Process
│   │                  #  - Handles local file I/O and file watchers (fs.watch)
│   │                  #  - Manages window state, native dialogs, and configuration persistence (config.json)
│   │                  #  - Responds to IPC calls from the renderer
│   │
│   ├── preload/       # Preload Script
│   │                  #  - Exposes safe IPC bridge APIs to the renderer via contextBridge
│   │                  #  - Acts as a secure gateway between Main and Renderer
│   │
│   └── renderer/      # Renderer Process
│                      #  - React UI layout and app views
│                      #  - LogViewer.tsx handles parsing, filtering computation, and virtualized list styling
│                      #  - Global theme syncing via LocalStorage and Ant Design Providers
└── resources/         # Static Assets (app icons, etc.)
```

---

## ✨ Core Features

### 📂 1. Log Loading & File System Watcher
*   **Fast Loading**: Effortlessly load `.log`, `.txt`, and other text-based log files.
*   **Session Restore**: Automatically records the last-opened file path and position, auto-restoring it upon application launch.
*   **Real-time Tail/Watch**: Built-in monitoring (`fs.watch`) watches for changes; when new lines are appended by external systems, the viewer automatically refreshes.
*   **Dynamic Title**: The window title updates automatically to reflect the file path (`LogPrism - [File Path]`).

### 🔍 2. Real-time Multi-Dimensional Filters
*   **Include Keywords**: Filter for lines matching specific keywords (supports space-delimited words, exact phrase matching using double quotes `"abc def"`, and Case-Sensitivity toggle).
*   **Exclude Keywords**: Drop noise instantly. Works with the same grouping syntax as inclusion.
*   **Time-Range Filter**: Extract and filter log lines within specific timeframes. Instantly recognizes milliseconds (`HH:mm:ss.SSS`) from the start of log lines.
*   **Instant Updates**: Filters calculate in real-time as you type—no manual search button required.

### 🎨 3. Premium Interactive UI/UX
*   **Dual Themes**: Seamless switching between **Dark Mode** and **Light Mode**, persisted locally.
*   **Smart Tail Mode**: Automatically auto-scrolls to the bottom when new logs stream in. If you scroll up to inspect code, Tail mode is suspended and a dynamic floating badge alerts you of incoming logs. Clicking the badge instantly snaps you to the bottom and resumes tracking.
*   **Ctrl + Scroll Zooming**: Press `Ctrl` and scroll your mouse wheel to adjust the log font-size dynamically between `10px` and `40px` (persisted on close).
*   **Row-Level Actions**: Right-click context menus allow developers to bookmark a line's time as the start/end filter range or apply custom colors (Red, Blue, Green, Orange, Purple highlights).
*   **Speed Navigation**: Dynamic, blurred glassmorphic "Scroll to Top / Bottom" floating buttons fade in when needed and support keyboard shortcuts.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended) and a package manager of your choice.

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/zhenxinglu/LogPrism.git
cd LogPrism
npm install
```

### 2. Run Local Development Server

Launches the application with Hot Module Replacement (HMR) and dev tools:

```bash
npm run dev
```

### 3. Build & Package for Production

Build production installers for target platforms:

```bash
# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux
```

Packaging artifacts will be outputted directly into the root level `dist/` directory.

---

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  **Submit Issues**: Found a bug or have a suggestion? Please file a [New Issue](https://github.com/zhenxinglu/LogPrism/issues).
2.  **Pull Requests**:
    *   Fork the Project.
    *   Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
    *   Commit your changes (`git commit -m 'feat: add some AmazingFeature'`).
    *   Push to the Branch (`git push origin feature/AmazingFeature`).
    *   Open a **Pull Request**.

### Guidelines
*   Keep code clean and formatted according to ESLint and Prettier.
*   Document any major feature additions in `feature.md`.
*   Ensure that compilation passes locally (`npm run build:*`) before requesting reviews.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
