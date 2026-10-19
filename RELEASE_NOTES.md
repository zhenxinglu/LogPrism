# LogPrism Release Notes

All notable changes to **LogPrism** will be documented in this file.

---

## [1.3.0] - 2026-10-07

### 🚀 New Features & Enhancements

- **Embedded JSON & XML Payload Inspector**:
  - Smart automatic detection of embedded JSON objects/arrays and XML blocks in log messages.
  - Interactive inline `{ } JSON` and `< > XML` badges with accordion-style inline pretty printing.
  - Full-featured side drawer inspector (`Alt + J`) with hierarchical tree view, node depth folding, in-drawer text search, and one-click formatted/raw copying.
- **Remote SSH Log Streaming & Remote File Browser**:
  - Live log streaming via SSH with password and private key authentication.
  - Remote file browser modal (`RemoteFileBrowserModal`) with file extension filtering (`.log`, `.txt`, `.gz`, `*.*`).
- **IntelliJ IDEA Integration**:
  - Automatic detection of stack traces and source file references.
  - Context menu action "Open in IntelliJ IDEA" via `idea://open` deep-linking with direct file and line number positioning.
- **Keyboard Shortcuts Guide**:
  - Interactive keyboard shortcuts guide modal (`Ctrl + /`) covering navigation, filtering, drawer toggles, and shortcuts.

### 🐛 Bug Fixes & Reliability

- **Worker Filtering & Memory Optimization**: Offloaded filtering logic to Web Workers and optimized memory retention to prevent OOM on large log files.
- **UI Responsiveness**: Enhanced virtual scrolling and layout calculation efficiency.

---

## [1.2.0] - 2026-08-19

### 🐛 Bug Fixes & Improvements

- **Highlight Copy Issue**: Fixed an issue where copying text with highlighted keywords included unwanted artifacts.
- **Recent Files Management**: Improved persistent history management for recent log files.

---

## [1.1.0] - 2026-07-24

### 🚀 New Features & Enhancements

- **Auto-Update Support**: Integrated automatic application update check powered by `electron-updater`.
- **Version & Update Dialog**: Added version indicator in the status footer and interactive update check modal.
- **Multi-Line Exception Handling**: Upgraded log parsing logic to properly group and filter multi-line log entries (e.g. Java/Node exception stack traces).
- **Row Context Menu**: Added right-click menu on log rows with convenient actions:
  - **Set Time Range**: Instantly set the selected row's timestamp as Start Time or End Time for time range filtering.
  - **Color Highlighting**: Apply row-level background highlights (Blue, Red, Green, Orange, Purple) for key entry tracking.
- **Tail Mode (Auto-Scroll)**: Real-time log tracking with floating visual indicator when scrolling away from the bottom.
- **Floating Quick Scroll**: Added scroll-to-top and scroll-to-bottom floating buttons with keyboard shortcuts (`Ctrl + Home` / `Ctrl + End`).
- **Dynamic Font Scaling**: Support `Ctrl + Mouse Wheel` log font size adjustment (10px - 40px) with automatic user settings persistence.
- **UI Internationalization**: Full English user interface across controls, dialogs, status bar, and tooltips.

### 🐛 Bug Fixes & Reliability

- Resolved an issue where multi-line log stack traces were stripped during keyword filtering.
- Improved real-time `fs.watch` file monitoring efficiency for large log files.
- Persisted active open file, zoom level, word wrap, and theme preferences across application restarts.

---

## [1.0.0] - 2026-07-18

### 🎉 Initial Release

- Core Electron + React + TypeScript + Ant Design architecture.
- Local log file opening and automatic file watching.
- Keyword include/exclude filtering with case sensitivity toggle.
- Time range filtering (`HH:mm:ss` / `HH:mm:ss.SSS`).
- Dark mode and Light mode UI theme switcher.
- Flexible word wrap toggles and line rendering.
