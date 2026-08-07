# LogPrism - 功能特性与规划路线图

本项目是一个基于 Electron + React + TypeScript + Ant Design 开发的高性能日志查看与分析软件。以下是当前已实现的功能特性与后续路线图：

## 1. 日志文件加载与管理

- [x] **打开日志文件**：支持通过系统文件选择对话框打开本地日志文件（限制扩展名为 `.log`、`.txt` 或所有文件）。
- [x] **自动记忆与恢复**：
  - [x] 应用关闭或重启时，自动将上次打开的文件路径与视图状态持久化记录在本地配置文件（`config.json`，存储在 `userData` 目录下）。
  - [x] 每次启动应用时，会自动读取并重新加载该文件内容，恢复之前的查看状态。
- [x] **窗口标题动态关联**：打开日志文件或恢复上次打开的文件时，窗口标题会动态变更为 `LogPrism - [文件路径]`。
- [x] **实时监控变动**：利用底层文件系统监控（`fs.watch`），一旦打开的日志文件在外部被修改或有新日志追加，应用会自动感知、重新读取最新内容，并自动实时刷新渲染。

## 2. 多维度日志过滤与分析

- [x] **实时自动过滤**：所有过滤条件（包含关键词、排除关键词、大小写敏感开关、日志级别、时间区间）以及日志文件本身的任何更新，都会**实时自动触发**过滤计算并刷新显示窗口，无需手动点击过滤按钮。
- [x] **包含关键词过滤（Include Keywords）**：
  - [x] 支持输入多个关键词（默认由空格分隔的连续无空格字符；若关键词内含空格，可使用双引号 `""` 括起来作为一个整体，例如 `abc "love you"`），显示包含其中任意一个（OR 逻辑）这些关键词的日志行。
  - [x] 提供 **大小写敏感（Aa）** 切换开关，满足不同检索场景。
  - [x] **历史检索词记录与删除**：类似 Google Search 自动记录历史输入关键词，聚焦输入框时弹出历史下拉列表，支持点击一键填入以及删除指定的历史记录。
- [x] **排除关键词过滤（Exclude Keywords）**：
  - [x] 支持以同样规则输入多个关键词（支持空格分隔及双引号括起来的词组），过滤掉包含其中任意一个（OR 逻辑）关键词的日志行。
  - [x] 同样提供 **大小写敏感（Aa）** 切换开关。
  - [x] **历史检索词记录与删除**：独立记录排除关键词的历史输入，支持下拉匹配与删除特定历史。
- [x] **日志级别快捷筛选（Log Level Quick Filters）**：
  - [x] 支持针对 ERROR、WARN、INFO、DEBUG、OTHER 等等级单独勾选/取消。
  - [x] 提供 **All**（开启全量）、**Errors & Warns**（一键筛选 ERROR + WARN 关键报错）、**None**（全清）快捷按钮，具有清晰的边界视觉与悬浮反馈。
- [x] **过滤条件与状态全量持久化 (Filter Settings Persistence)**：
  - [x] 所有过滤参数（包含/排除关键词、大小写敏感开关、日志级别勾选、时间范围、时间轴图表显隐状态）全量自动保存并在会话恢复或重新加载时还原。
- [x] **时间区间过滤（Time Range）**：
  - [x] 支持指定开始时间和结束时间（精确到毫秒：`HH:mm:ss.SSS`）。
  - [x] 自动匹配并提取日志行首的时间戳进行区间判定（支持多种标准与自定义日志时间格式 Badge/Tag 展示与手动切换）。
  - [x] 对于不带时间戳的日志行，默认不做时间过滤，直接保留。
- [x] **跨多行日志与异常堆栈智能解析（Multi-Line Log & Exception Handling）**：
  - [x] 自动匹配以时间戳开头的行作为日志条目的起始，并将随后的无时间戳多行日志（如 Java、Node.js 异常 Stack Trace 堆栈跟踪）归类合并为同一条独立日志记录（Log Entry）。
  - [x] 包含/排除关键词过滤与时间区间过滤均作用于包含堆栈的整个日志条目，确保过滤时不会破坏或截断多行异常堆栈。

## 3. UI 界面与交互体验

- [x] **国际化支持（Internationalization / i18n）**：基于 `i18next` 搭建多语言架构，完整支持 English 与中文界面实时无缝切换及设置持久化。
- [x] **主题风格切换（Theme Style）**：
  - [x] 支持在 **暗黑模式（Dark Theme）** 与 **明亮模式（Light Theme）** 之间自由切换。
  - [x] 主题设置通过 `localStorage` 和本地配置文件 `config.json` 自动持久化保存，保证下次启动保持相同主题状态。
- [x] **深浅色模式主题适配**：基于 Ant Design 的 `ConfigProvider` 动态切换全局样式（`darkAlgorithm` / `defaultAlgorithm`），深度适配面板背景、边框及文字颜色。
- [x] **可折叠的过滤器面板**：
  - [x] 过滤器和操作面板支持折叠与展开，可通过双击过滤器头部或点击折叠按钮收起/展开，以最大化日志显示区域。
- [x] **代码风格日志渲染**：
  - [x] 日志正文显示在带有微弱边框的背景区域，采用等宽字体（`Fira Code`, `JetBrains Mono`, `monospace`）。
  - [x] 支持自动换行（Word Wrap）与不换行切换。
- [x] **日志字体大小缩放**：按住 `Ctrl` 键并滚动鼠标中键可对日志字体大小在 10px 至 40px 范围进行实时缩放，缩放比例自动持久化记忆。
- [x] **底部状态栏控制与反馈**：
  - [x] 左侧显示版本号及当前匹配过滤的日志行数（如 `v1.1.0` / `"Found X matches"`），并在外部日志变动时展示带有呼吸灯特效的更新时间提示。
  - [x] 右侧提供 Check for Updates、Tail Mode、Word Wrap 勾选框与 Theme Style 切换控制。
- [x] **追加追踪模式（Tail Mode / Auto Scroll to Bottom）**：
  - [x] 当外部日志有新内容追加且开启 Tail 时，视图自动滚动到最底部。
  - [x] 手动向上滚动时自动挂起 Tail，并伴有弹性箭头的动态提示气泡提示新日志到达，点击可瞬间触底并恢复追踪。
- [x] **一键回到顶部/底部（Scroll to Top / Bottom Buttons）**：
  - [x] 在日志显示区域右下角提供半透明模糊悬浮导航按钮，支持快捷键（`Ctrl + Home` / `Ctrl + End`）快速触顶或触底。
- [x] **行级右键快捷菜单与标记（Row Context Menu & Mark Highlights）**：
  - [x] 支持右键菜单一键提取当前行时间为 Time Range 起始/结束时间。
  - [x] 支持通过二级菜单为当前行高亮标记颜色（Blue, Red, Green, Orange, Purple 五种预置色及 Clear Mark）。
- [x] **快捷键页内文本搜索（In-Page Search Bar / Ctrl+F / Cmd+F / F3）**：
  - [x] 支持快捷键 `Ctrl + F`（或 `Cmd + F`）唤出悬浮搜索框，实时匹配高亮，支持 `F3` / `Enter`（下一个）及 `Shift + F3` / `Shift + Enter`（上一个）定位。
- [x] **双击与划词词汇高亮（Double-Click & Selection Word Highlighting）**：
  - [x] 在日志视图中双击或划词选中任意词汇，自动高亮标注渲染视图中所有相同词汇。
- [x] **应用自动更新与版本管理（Auto-Update & Version Check）**：
  - [x] 集成 `electron-updater` 模块，支持与 GitHub Release 联动进行应用升级检测，提供交互式更新模态弹窗。
- [x] **启动窗口最大化（Maximized Window on Launch）**：
  - [x] 应用启动时在 `ready-to-show` 事件中自动调用 `mainWindow.maximize()`，使主窗口启动时处于最大化显示状态。

## 4. 高级分析与扩展能力

### 视图与导航交互优化

- [x] **行号显示（Line Numbers）**：
  - 在日志渲染面板左侧渲染原文件或过滤后的日志行号，便于精准定位。

### 数据管理与协作

- [x] **最近打开文件历史（Recent Files History）**：
  - 记录最近打开的 5-10 个日志文件路径，提供快速切换的下拉菜单。
- [ ] **导出过滤后的日志（Export Filtered Logs）**：
  - 提供导出/另存为功能，将当前过滤筛选后的日志行保存为本地新文件。
- [x] **日志书签与标记（Bookmarks & Pins）**：
  - [x] 允许在日志视图中通过点击行首 📍 按钮或在右键菜单中选择 "Pin Line" 添加书签。
  - [x] 已书签行高亮呈现黄色边框与 📌 图标。
  - [x] 提供侧边 "Bookmarks & Pins" 管理抽屉，支持平滑跳转、书签命名/备注标签及一键清空。

### 性能与超大文件处理 (Performance & Huge Files)

- [x] **GB 级大文件流式加载与虚拟滚动 (Streaming & Virtual Scrolling)**：
  - [x] 突破内存限制，秒开 GB 级别大日志文件。
  - [x] 采用 DOM 虚拟列表（Virtual List）渲染技术，确保滚动保持 60fps 体验。
- [x] **渲染进程内存优化与防 OOM 机制 (Memory Retention & OOM Protection)**：
  - [x] 优化日志重新过滤与 DOM 节点回收机制，降低大文件全量文本与虚拟列表的状态占用，防止频繁过滤与长时运行引发 Out-Of-Memory (OOM) 崩溃。

### 高级分析与可视化 (Advanced Analytics & Visualization)

- [x] **日志时间轴与统计图表 (Timeline & Charts)**：
  - 在页面顶部提供迷你时间轴（Mini-map Timeline），用柱状图显示各时间段日志密度，并以不同颜色直观展示 Error / Warn 报错峰值（Spikes）。

### 智能搜索与上下文查找 (Smart Context)

- [x] **上下文视图 (Context View - Before/After Lines)**：
  - [x] 在过滤模式下，允许用户展开某一条匹配日志的前 N 行和后 N 行（5、10、20 行等），无需取消当前过滤条件即可直接在视图或弹窗中直观查看报错上下文环境。

### 多文件与远程环境协同 (Multi-File & Remote)

- [x] **多标签页与分屏对比 (Tabs & Split View)**：
  - [x] 支持多标签页（Tabs）管理，支持左右或上下分屏模式，方便比对不同模块日志。
- [x] **远程服务器接入与文件筛选 (Remote Logs & SSH Browser)**：
  - [x] 支持通过 SSH 实时 tail 远程服务器日志文件（支持密码与 SSH 私钥认证）。
  - [x] 提供独立的 SSH 远程连接配置弹窗与 "Test Connection" 测试连通功能。
  - [x] 远程日志流无缝集成至 LogPrism 核心分析引擎（支持过滤、虚拟列表、双击高亮、书签与时间轴统计）。
  - [x] 支持在远程 SSH 文件浏览器弹窗（`RemoteFileBrowserModal`）中通过文件扩展名下拉框（`.log`, `.txt`, `.gz`, 所有文件 `*.*`）快速过滤远程文件。

### 🤖 AI 与智能分析 (AI & Smart Analytics)

- [ ] **AI 异常诊断助手 (AI Error Copilot)**：
  - 结合 LLM 大模型自动读取 Stack Trace 堆栈上下文，智能分析报错根因并给出修复建议。
- [ ] **日志智能聚合与降噪 (Log Clustering & Pattern Recognition)**：
  - 算法自动归类高频相似日志并折叠高频报错，展示触发频次统计。

### 🛡️ 数据安全与隐私保护 (Security & Privacy)

- [ ] **日志脱敏与数据遮罩 (Data Anonymization / Masking)**：
  - 利用正则自动屏蔽敏感信息（如手机号、身份证、邮箱、Token、密码），确保导出与分享安全。

### 🛠️ 高级开发者与运维利器 (Advanced Developer & DevOps Tools)

- [x] **在 IntelliJ IDEA 中打开代码 (Open in IntelliJ IDEA)**：
  - [x] 智能解析日志中的报错堆栈、文件名/类名与代码行号（支持 Java/Kotlin/Groovy/Python 等常见堆栈）。
  - [x] 右键菜单提供 “在 IntelliJ IDEA 中打开 (filename:line)” 动态选项，基于 JetBrains `idea://open` 原生 URL Scheme 一键拉起 IDEA 并精准定位至源码行。
- [ ] **内嵌长文本与报文格式化 (Embedded Payload Formatting)**：
  - 对日志中单行嵌套的超长 JSON 响应体、XML 报文或 SQL 语句，提供右键手风琴格式化展开与语法高亮。
- [ ] **实时监控告警触发器 (Real-time Alerting Triggers)**：
  - Tail 实时追踪模式下，匹配指定正则或错误频率阈值时触发系统原生通知或提示音。

### 🤝 团队协同与现场恢复 (Team Collaboration & Session Sharing)

- [ ] **排查现场快照与分享 (Session Snapshot & Share)**：
  - 支持导出/导入排查现场快照文件（`.lpconfig`），1:1 还原包含文件、过滤规则、书签 Pins 与标记高亮的排查场景。

## 5. 开发顺序建议优先级 (Recommended Development Priority)

为了使 LogPrism 成为最专业的日志查看和分析软件，针对当前尚未实现的 12 项功能，建议按以下优先级层次推进后续开发：

---

### 🔴 P0: 核心刚需与高频排查能力 (Immediate Next Steps - Critical)

_日常故障排查中使用频率最高、性价比极高且为专业日志分析器核心关需的功能。_

1. **正则表达式过滤支持 (Regex Filtering)**
   - **核心价值**：支持 Include/Exclude 输入框切换正则模式，满足高级开发者与运维人员复杂的文本模式匹配需求。
2. **导出过滤后的日志 (Export Filtered Logs)**
   - **核心价值**：允许将当前经过过滤筛选后的结果日志行快速导出/另存为本地新文件，便于提供给团队或归档。

---

### 🟡 P1: 排查体验提效与格式化 (High Priority - Productivity Boost)

_解决典型排查痛点，大幅提升长文本、长报文以及多文件排查体验。_

3. **内嵌长文本与报文格式化 (Embedded Payload Formatting)**
   - **核心价值**：针对日志行中嵌套的超长 JSON 响应体、XML 或 SQL 语句，提供右键手风琴美化展开与高亮。
4. **日志智能聚合与降噪 (Log Clustering & Pattern Recognition)**
   - **核心价值**：面对生产环境高频刷屏报错，自动折叠相似堆栈并展示频次统计，避免关键日志被淹没。

---

### 🟢 P2: 监控告警与安全协同 (Medium Priority - Monitoring & Security)

_扩展实时监控能力、数据安全规范与团队协同场景。_

5. **实时监控告警触发器 (Real-time Alerting Triggers)**
   - **核心价值**：Tail 实时追踪模式下，匹配指定正则或错误频率阈值时触发系统原生通知或提示音。
6. **日志脱敏与数据遮罩 (Data Anonymization / Masking)**
   - **核心价值**：一键开启敏感数据（手机号、身份证、Token、密码等）正则遮罩脱敏，确保分享与导出安全。
7. **排查现场快照与分享 (Session Snapshot & Share)**
   - **核心价值**：将文件/远程配置、过滤规则、书签 Pins 及标记高亮保存为 `.lpconfig` 快照文件，方便团队一键复刻现场。

---

### 🔵 P3: 前沿智能化与特定场景 (Future Exploration & Intelligence)

_具有较高创新价值或面向硬核用户的定制功能。_

8. **AI 异常诊断助手 (AI Error Copilot)**
   - **核心价值**：接入 LLM 大模型自动读取 Stack Trace 堆栈上下文，智能分析报错根因并给出修复参考。
9. **高级 DSL 搜索语言 (Advanced Search DSL)**
   - **核心价值**：支持形如 `level:ERROR AND timestamp>now-1h` 的领域查询语言。
10. **离线模式 (Offline Mode)**
    - **核心价值**：针对 SSH 远程日志，在断网时保留本地缓存供分析，并在网络恢复后自动续传同步。
11. **主题自定义与编辑 (Customizable Themes)**
    - **核心价值**：提供主题编辑器，支持用户定制配色方案、字体及玻璃拟态效果。

---

### ⚪ P4: 架构演进与次要优化 (Long-term Backlog)

_架构预留、系统级标准对接或次要辅助功能。_

12. **无障碍辅助支持 (Accessibility Support - WCAG 2.1 AA)**：支持键盘导航与 ARIA 标签。
13. **插件化架构 (Plugin Architecture)**：轻量级第三方解析器与导出插件扩展机制。