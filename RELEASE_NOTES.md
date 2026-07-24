# LogPrism Release Notes

All notable changes to **LogPrism** will be documented in this file.

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
