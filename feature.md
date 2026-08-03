# LogPrism - 功能特性与规划路线图

本项目是一个基于 Electron + React + TypeScript + Ant Design 开发的日志查看器应用。以下是当前功能特性与后续路线图：

## 1. 日志文件加载与管理

- [x] **打开日志文件**：支持通过系统文件选择对话框打开本地日志文件（限制扩展名为 `.log`、`.txt` 或所有文件）。
- [x] **自动记忆与恢复**：
  - [x] 应用关闭或重启时，自动将上次打开的文件路径持久化记录在本地配置文件（`config.json`，存储在 `userData` 目录下）。
  - [x] 每次启动应用时，会自动读取并重新加载该文件内容，恢复之前的查看状态。
- [x] **窗口标题动态关联**：打开日志文件或恢复上次打开的文件时，窗口标题会动态变更为 `LogPrism - [文件路径]`。
- [x] **实时监控变动**：利用底层文件系统监控（`fs.watch`），一旦打开的日志文件在外部被修改或有新日志追加，应用会自动感知、重新读取最新内容，并自动实时刷新渲染。

## 2. 多维度日志过滤与分析

- [x] **实时自动过滤**：所有过滤条件（包含关键词、排除关键词、大小写敏感开关、时间区间）以及日志文件本身的任何更新，都会**实时自动触发**过滤计算并刷新显示窗口，无需手动点击过滤按钮。
- [x] **包含关键词过滤（Include Keywords）**：
  - [x] 支持输入多个关键词（默认由空格分隔的连续无空格字符；若关键词内含空格，可使用双引号 `""` 括起来作为一个整体，例如 `abc "love you"`），显示包含其中任意一个（OR 逻辑）这些关键词的日志行。
  - [x] 提供 **大小写敏感（Aa）** 切换开关，满足不同检索场景。
- [x] **排除关键词过滤（Exclude Keywords）**：
  - [x] 支持以同样规则输入多个关键词（支持空格分隔及双引号括起来的词组），过滤掉包含其中任意一个（OR 逻辑）关键词的日志行。
  - [x] 同样提供 **大小写敏感（Aa）** 切换开关。
- [x] **时间区间过滤（Time Range）**：
  - [x] 支持指定开始时间和结束时间（精确到毫秒：`HH:mm:ss.SSS`）。
  - [x] 自动匹配并提取日志行首的时间戳进行区间判定（支持 `HH:mm:ss` 与 `HH:mm:ss.SSS` 格式的行首时间戳）。
  - [x] 对于不带时间戳的日志行，默认不做时间过滤，直接保留。
- [x] **跨多行日志与异常堆栈智能解析（Multi-Line Log & Exception Handling）**：
  - [x] 自动匹配以时间戳开头的行作为日志条目的起始，并将随后的无时间戳多行日志（如 Java、Node.js 异常 Stack Trace 堆栈跟踪）归类合并为同一条独立日志记录（Log Entry）。
  - [x] 包含/排除关键词过滤与时间区间过滤均作用于包含堆栈的整个日志条目，确保过滤时不会破坏或截断多行异常堆栈。

## 🔧 需要改进的地方 (Improvement Areas)

- **无障碍辅助支持（Accessibility Support）**：实现全面的键盘导航、ARIA 标签和焦点指示器，满足 WCAG 2.1 AA 标准。
- **[x] 国际化支持（Internationalization / i18n）**：基于 `i18next` 搭建多语言架构，完整支持 English 与中文界面切换及持久化保存。
- **主题自定义与编辑（Customizable Themes）**：提供实时预览的主题编辑器，允许用户创建和分享自己的配色方案、字体及毛玻璃（Glassmorphism）样式。
- **离线模式（Offline Mode）**：本地缓存远程日志，在网络断开时仍可进行日志分析，并在网络恢复后自动重新同步。
- **高级 DSL 搜索语言（Advanced Search DSL）**：为高级用户拓展过滤器语言，支持小型的特定领域查询语言（例如 `level:ERROR AND timestamp>now-1h`）。

## 3. UI 界面与交互体验

- [x] **主题风格切换（Theme Style）**：
  - [x] 支持在 **暗黑模式（Dark Theme）** 与 **明亮模式（Light Theme）** 之间自由切换。
  - [x] 主题设置通过 `localStorage` 和本地配置文件 `config.json` 自动持久化保存，保证用户下一次打开应用时保持相同的主题状态。
- [x] **深浅色模式主题适配**：基于 Ant Design 的 `ConfigProvider` 动态切换全局样式（`darkAlgorithm` / `defaultAlgorithm`），同时对面板背景、边框颜色、文字颜色等自定义区域进行了深度适配，确保在两种主题下均有极致的视觉表现。
- [x] **可折叠的过滤器面板**：
  - [x] 过滤器和操作面板支持折叠与展开。
  - [x] 可通过双击过滤器头部或点击右侧折叠按钮进行收起/展开，以最大化日志显示区域。
- [x] **代码风格日志渲染**：
  - [x] 日志正文显示在带有微弱边框的背景区域，采用等宽字体（`Fira Code`, `JetBrains Mono`, `monospace`）。
  - [x] 支持自动换行与不换行切换。
- [x] **日志字体大小缩放**：在日志显示窗口内，支持按住 `Ctrl` 键并滚动鼠标中键（Wheel）对日志字体大小进行缩放（范围限制在 10px 到 40px 之间）。缩放后的字体大小会自动记忆持久化，下次启动应用时自动恢复。
- [x] **底部状态栏控制与反馈**：
  - [x] 左侧显示版本号及当前匹配过滤的日志行数（例如 `v1.1.0` / `"Found X matches"`），并在外部日志变动时展示带有呼吸灯特效的更新时间提示（例如 `File updates on 16:40:12 (5 seconds ago)`）。
  - [x] 右侧提供 **Check for Updates**、**Tail Mode**、**Word Wrap** 复选框（Checkbox）和 **Theme Style**（Dark/Light）单选按钮。
  - [x] Word Wrap 勾选时启用自动换行（`pre-wrap`），未勾选时显示原始排版（`pre`）。
  - [x] 换行与主题配置均会自动持久化，并在应用重新打开时自动恢复。
- [x] **追加追踪模式（Tail Mode / Auto Scroll to Bottom）**：
  - [x] 添加 `Tail` 开关。当外部日志有新内容追加且开启 Tail 时，视图自动滚动到最底部。
  - [x] 若用户手动往上滚动，则自动挂起 Tail，并伴有弹性箭头的动态提示气泡提示新日志到达，点击可瞬间触底并恢复追踪。
- [x] **一键回到顶部/底部（Scroll to Top / Bottom Buttons）**：
  - [x] 在日志显示区域右下角添加半透明模糊滤镜的悬浮导航按钮，且支持全局快捷键（如 `Ctrl + Home` / `Ctrl + End`），快速回到开头或结尾。
  - [x] 按钮仅在偏离顶部或底端（50px）时智能渐入呈现，且滚到底部操作能自动恢复挂起的 Tail Mode 追踪。
- [x] **行级右键快捷菜单与标记（Row Context Menu & Mark Highlights）**：
  - [x] 支持在任意日志行上右键唤出自定义的快捷菜单。
  - [x] 支持一键设置当前行时间为 "Time Range" 的开始时间（Set as Start Time）或结束时间（Set as End Time），提取后自动实时重新过滤。
  - [x] 支持通过二级子菜单将当前行以特殊颜色高亮标记（包含 Blue, Red, Green, Orange, Purple 五种预置色及 Clear Mark 选项），背景颜色与菜单选项保持一致，并自动搭配高对比度白色文字。
  - [x] 智能细节：对不含时间戳的行，自动禁用并置灰时间设置选项；菜单会在滚动日志、点击空白处、窗口失去焦点或按 `Escape` 键时自动隐藏；高亮标记不受后续过滤条件改变的影响，并在加载新文件时自动重置。
- [x] **快捷键页内文本搜索（In-Page Search Bar / Ctrl+F / Cmd+F / F3）**：
  - [x] 支持通过快捷键 `Ctrl + F`（或 `Cmd + F`）唤出悬浮在右上角的高亮玻璃拟态搜索框。
  - [x] 输入检索词后自动进行全局匹配，并实时呈现匹配项总数与当前聚焦序号（如 `1/12`）。
  - [x] 支持按 `F3` / `Enter` 顺序定位到下一个匹配项，按 `Shift + F3` / `Shift + Enter` 定位到上一个匹配项，并自动平滑滚动视图到当前匹配所在位置。
  - [x] 当前匹配项提供高对比度橙色高亮显示，支持通过 `Esc` 键或关闭按钮迅速退出搜索状态。
- [x] **双击与划词词汇高亮（Double-Click & Selection Word Highlighting）**：
  - [x] 在日志内容视图中双击或鼠标划词选中任意词汇，即可自动高亮标注当前所有渲染日志中完全相同的词汇。
- [x] **应用自动更新与版本管理（Auto-Update & Version Check）**：
  - [x] 集成 `electron-updater` 模块，支持与 GitHub Release 联动进行应用升级检测。
  - [x] 底部状态栏左侧常驻显示当前版本号（如 `v1.1.0`），右侧提供 **Check for Updates** 触发入口。
  - [x] 提供交互式更新模态弹窗（Modal），涵盖新版本 Changelog 显示、下载进度条（Progress bar）及一键 "Restart and Install" 重启安装体验。
  - [x] 包含完善的错误捕捉与友好提示（如缺少 GitHub `latest.yml` 时的针对性提示）。
- [x] **启动窗口最大化（Maximized Window on Launch）**：
  - [x] 应用启动时在 `ready-to-show` 事件中自动调取 `mainWindow.maximize()`，使主窗口在�## 5. 开发顺序建议优先级 (Recommended Development Priority)

为了使 LogPrism 成为最专业的日志查看和分析软件，针对当前尚未实现的 13 项功能，结合**用户排查价值**与**开发实现难度**，建议按以下优先级层次推进后续开发：

---

### 🔴 P0: 核心刚需与高频排查能力 (Immediate Next Steps - Critical)
_日常故障排查中使用频率最高、开发投入产出比（ROI）极高的核心刚需功能。_

1. **正则表达式过滤支持 (Regex Filtering)**
   - **核心价值**：满足高级开发者与运维人员复杂的文本模式匹配（如 IP、错误码、特定 ID 组合）需求。
   - **实现难度**：低（在关键词过滤器中扩展正则解析与开关控制）。
2. **上下文视图 (Context View - Before/After Lines)**
   - **核心价值**：过滤出特定报错后，允许直接展开查看该行前 N 行与后 N 行的完整上下文日志，无需反复重置或清除过滤条件。
   - **实现难度**：中（基于现有日志索引提供展开/折叠上下文视图）。
3. **导出过滤后的日志 (Export Filtered Logs)**
   - **核心价值**：将筛选后的精简报错日志保存为新文件，便于团队沟通、存档或提交 Bug 单。
   - **实现难度**：低（结合 Electron 文件对话框写入过滤后的日志数据）。

---

### 🟡 P1: 排查体验提效与格式化 (High Priority - Productivity Boost)
_解决典型排查痛点，大幅提升超长报文、大流量报错日志的分析效率。_

4. **内嵌长文本与报文格式化 (Embedded Payload Formatting)**
   - **核心价值**：针对日志行中嵌套的超长单行 JSON、XML 或 SQL 语句，提供右键手风琴美化展开与高亮。
   - **实现难度**：中（行级内嵌 JSON/XML 美化视图与语法高亮）。
5. **日志智能聚合与降噪 (Log Clustering & Pattern Recognition)**
   - **核心价值**：面对生产环境高频刷屏报错，自动折叠相似堆栈并展示频次统计（如：`NullPointerException (Occurred 500 times)`），防止关键日志被淹没。
   - **实现难度**：中高（需要日志模式提取与相似度聚类算法）。

---

### 🟢 P2: 实时监控、安全与团队协同 (Medium Priority - Monitoring, Security & Collaboration)
_扩展实时监控告警能力、隐私安全保护及团队现场复刻能力。_

6. **实时监控告警触发器 (Real-time Alerting Triggers)**
   - **核心价值**：Tail 实时追踪模式下，匹配指定正则或错误频率阈值时触发桌面原生通知或音效提示。
   - **实现难度**：中（集成 Electron System Notification 与音效触发）。
7. **日志脱敏与数据遮罩 (Data Anonymization / Masking)**
   - **核心价值**：一键开启敏感数据（手机号、身份证、Token、密码等）正则遮罩脱敏，确保导出或分享日志时不泄露隐私。
   - **实现难度**：中（正则替换规则引擎与脱敏开关）。
8. **排查现场快照与分享 (Session Snapshot & Share)**
   - **核心价值**：将打开的文件/远程配置、过滤条件、书签 Pins 及标记高亮导出为 `.lpconfig` 快照文件，方便团队一键复刻问题现场。
   - **实现难度**：中（状态序列化与反序列化导入/导出机制）。

---

### 🔵 P3: 前沿智能化与高级定制 (Future Exploration & Advanced Features)
_具有较高创新价值、探索性或面向特定场景/特定用户的定制功能。_

9. **AI 异常诊断助手 (AI Error Copilot)**
   - **核心价值**：接入 LLM 大模型自动读取 Stack Trace 堆栈上下文，智能分析报错根因并给出修复建议。
   - **实现难度**：中（LLM API 接入、 Prompt 模板设计与 API Key 配置管理）。
10. **高级 DSL 搜索语言 (Advanced Search DSL)**
    - **核心价值**：支持形如 `level:ERROR AND timestamp>now-1h AND msg:timeout` 的复杂结构化查询。
    - **实现难度**：高（需要设计 AST 语法解析器与过滤器引擎转换）。
11. **离线模式 (Offline Mode)**
    - **核心价值**：针对 SSH 远程日志，在网络断开时保留本地缓存供分析，并在网络恢复后自动同步。
    - **实现难度**：中（本地 Stream 缓存与断线重连同步逻辑）。
12. **主题自定义与编辑 (Customizable Themes)**
    - **核心价值**：提供主题编辑器，支持用户自定义配色方案、字体及玻璃拟态效果。
    - **实现难度**：中（CSS 变量动态编辑器与主题导出/导入）。
13. **无障碍辅助支持 (Accessibility Support - WCAG 2.1 AA)**
    - **核心价值**：完善全键盘导航与 ARIA 标签，满足无障碍合规需求。
    - **实现难度**：中高（虚拟列表与复杂 DOM 节点的 ARIA 增强）。分析过滤日志。
  - 在 "Time Range:" 控制栏右侧实时动态展示系统检测到的日志时间格式 Badge/Tag，并支持手动切换格式。

### 视图与导航交互优化

- [x] **行号显示（Line Numbers）**：
  - 在日志渲染面板的左侧渲染一列原文件或过滤后的日志行号，便于精准定位。

### 数据管理与协作

- [x] **最近打开文件历史（Recent Files History）**：
  - 记录最近打开的 5-10 个日志文件路径。
  - 提供快速切换的下拉列表，便于多文件轮流排查。
- [ ] **导出过滤后的日志（Export Filtered Logs）**：
  - 提供导出/另存为功能，将当前已经过过滤条件筛选后的日志行保存为本地新文件。
- [x] **日志书签与标记（Bookmarks & Pins）**：
  - [x] 允许在日志视图中通过点击行首 📍 按钮或在右键快捷菜单中选择 "Pin Line" 将任意日志行添加为书签。
  - [x] 视图中已设为书签的日志行会高亮呈现黄色左侧边框与 📌 图标。
  - [x] 提供侧边 "Bookmarks & Pins" 管理抽屉（Drawer），实时显示书签列表（含行号 `#Line`、时间戳和文本预览）。
  - [x] 支持在抽屉中点击任意书签平滑跳转并高亮闪烁定位至对应日志行，并提供单个删除与一键清空（Clear All）功能。
  - [x] 支持在侧边抽屉（点击 ✏️ 编辑图标）或右键菜单（"Rename Bookmark"）中为书签命名/添加自定义备注（Bookmark Naming/Labels），设置后以 🏷️ 标签形式在列表和鼠标悬浮提示中优先直观展示。

### 性能与超大文件处理 (Performance & Huge Files)

- [x] **GB级大文件流式加载与虚拟滚动 (Streaming & Virtual Scrolling)**：
  - [x] 突破内存限制，支持秒开 GB 级别的超大日志文件。
  - [x] 引入虚拟列表（Virtual List）技术，只渲染可视区域的 DOM，确保在海量日志下的滚动和渲染保持 60fps 丝滑体验。

### 高级分析与可视化 (Advanced Analytics & Visualization)

- [x] **日志时间轴与统计图表 (Timeline & Charts)**：
  - 在页面顶部或侧边栏提供迷你时间轴（Mini-map Timeline），用柱状图显示各时间段的日志密度。
  - 用不同颜色直观展示 Error / Warn 在时间轴上的分布（Spikes），帮助快速定位故障爆发时间点。

### 智能搜索与上下文查找 (Smart Context)

- [ ] **上下文视图 (Context View - Before/After Lines)**：
  - 在过滤模式下，允许用户展开某一条匹配日志的前 N 行和后 N 行，以便查看报错的上下文环境，而无需取消当前过滤条件。

### 多文件与远程环境协同 (Multi-File & Remote)

- [x] **多标签页与分屏对比 (Tabs & Split View)**：
  - [x] 支持同时打开多个日志文件，并以多标签页（Tabs）形式管理。
  - [x] 支持分屏模式（左右或上下分屏），方便比对同一时间段不同模块（如 Web 和 DB）的日志。
- [x] **远程服务器接入 (Remote Logs)**：
  - [x] 支持通过 SSH 实时 tail 远程服务器的日志文件（`tail -n <lines> -f <remotePath>`）。
  - [x] 支持密码认证（Password）与 SSH 私钥认证（Private Key / Passphrase）。
  - [x] 提供独立的 SSH 远程连接配置弹窗（`RemoteLogModal`），支持多服务器 Profile 快速保存、切换、编辑与删除。
  - [x] 提供 "Test Connection" 连接测试功能，提供实时的 SSH 握手反馈与错误提示。
  - [x] 远程日志流无缝集成至 LogPrism 核心分析引擎，支持实时关键词过滤、时间范围过滤、虚拟列表滚动、双击高亮、书签标记与时间轴图表统计。
  - [x] 底部状态栏展示 SSH 连接状态 Tag（Connecting/Connected/Disconnected/Error）并提供一键 Disconnect 切断连接入口。

### 🤖 AI 与智能分析 (AI & Smart Analytics)

- [ ] **AI 异常诊断助手 (AI Error Copilot)**：
  - 在检测到 `Exception` 或 `FATAL` 堆栈时提供一键 AI 诊断按钮。
  - 结合 LLM 大模型自动读取上下文，分析报错根因并给出可能的修复方案或解决思路。
- [ ] **日志智能聚合与降噪 (Log Clustering & Pattern Recognition)**：
  - 支持一键“折叠重复项”，算法自动归类高频相似日志。
  - 在视图中折叠高频报错，并显示触发频次统计（如：`NullPointerException (Occurred 500 times in 10m)`），避免故障刷屏导致关键信息淹没。

### 🛡️ 数据安全与隐私保护 (Security & Privacy)

- [ ] **日志脱敏与数据遮罩 (Data Anonymization / Masking)**：
  - 提供一键隐私脱敏切换开关，利用正则自动屏蔽敏感信息（如手机号、身份证、邮箱、Token、密码）。
  - 支持脱敏后保存或导出，确保日志在团队协作或提交 Bug 列表时不泄露敏感数据。

### 🛠️ 高级开发者与运维利器 (Advanced Developer & DevOps Tools)

- [x] **在 IntelliJ IDEA 中打开代码 (Open in IntelliJ IDEA)**：
  - [x] 智能解析日志中的报错堆栈、文件名/类名与代码行号（支持 Java/Kotlin/Groovy/Python 等常见堆栈）。
  - [x] 在右键菜单中提供 “在 IntelliJ IDEA 中打开 (filename:line)” 动态选项。
  - [x] 支持配置与自动查找本地项目源码根目录 (Source Root Path)，基于 package 规则匹配与递归搜索精准定位本地文件。
  - [x] 基于 JetBrains `idea://open` 原生 URL Scheme 协议一键拉起 IDEA 并定位跳转至对应代码行。
- [ ] **内嵌长文本与报文格式化 (Embedded Payload Formatting)**：
  - 对日志中单行嵌套的超长 JSON 响应体、XML 报文或 SQL 语句，提供右键 `Format Payload` 功能。
  - 在当前日志行下方以手风琴形式展开格式化面板，提供缩进美化与语法高亮。
- [ ] **实时监控告警触发器 (Real-time Alerting Triggers)**：
  - 在 Tail 追踪模式下，支持自定义告警规则（如：匹配正则 `OutOfMemoryError` 或 10s 内 `ERROR` > 20 条）。
  - 触发规则时播放音效或发送系统原生通知（Desktop Notification），无需时刻死守屏幕。

### 🤝 团队协同与现场恢复 (Team Collaboration & Session Sharing)

- [ ] **排查现场快照与分享 (Session Snapshot & Share)**：
  - 支持将当前的排查现场（包含打开的文件/远程配置、过滤规则、书签 Pins、标记高亮）导出为轻量级快照文件（`.lpconfig`）。
  - 允许同事一键导入快照，1:1 还原完全一致的排查场景。

## 5. 开发顺序建议优先级 (Recommended Development Priority)

为了使 LogPrism 成为最专业的日志查看和分析软件，针对当前尚未实现的功能，建议按以下优先级层次推进后续开发：

---

### 🔴 P0: 核心刚需与高频排查能力 (Immediate Next Steps - Critical)

_日常故障排查中使用频率最高、性价比极高且为专业日志分析器核心刚需的功能。_

1. **上下文视图 (Context View - Before/After Lines)**
   - **核心价值**：过滤出特定报错后，允许直接展开查看该行前 N 行与后 N 行的完整上下文日志，无需反复重置或清除过滤条件。
2. **正则表达式过滤支持 (Regex Filtering)**
   - **核心价值**：支持 Include/Exclude 输入框切换正则模式，满足高级开发者与运维人员复杂的文本模式匹配需求。

---

### 🟡 P1: 排查体验提效与格式化 (High Priority - Productivity Boost)

_解决典型排查痛点，大幅提升长文本、长报文以及多文件排查体验。_

4. **内嵌长文本与报文格式化 (Embedded Payload Formatting)**
   - **核心价值**：针对日志行中嵌套的超长 JSON 响应体、XML 或 SQL 语句，提供右键手风琴美化展开与高亮。
5. **导出过滤后的日志 (Export Filtered Logs)**
   - **核心价值**：允许将当前经过过滤筛选后的结果日志行快速导出/另存为本地新文件，便于提供给团队或归档。
6. **日志智能聚合与降噪 (Log Clustering & Pattern Recognition)**
   - **核心价值**：面对生产环境高频刷屏报错，自动折叠相似堆栈并展示频次统计，避免关键日志被淹没。

---

### 🟢 P2: 监控告警与安全协同 (Medium Priority - Monitoring & Security)

_扩展实时监控能力、数据安全规范与团队协同场景。_

8. **实时监控告警触发器 (Real-time Alerting Triggers)**
   - **核心价值**：Tail 实时追踪模式下，匹配指定正则或错误频率阈值时触发系统原生通知或提示音。
9. **日志脱敏与数据遮罩 (Data Anonymization / Masking)**
   - **核心价值**：一键开启敏感数据（手机号、身份证、Token、密码等）正则遮罩脱敏，确保分享与导出安全。
10. **排查现场快照与分享 (Session Snapshot & Share)**
    - **核心价值**：将文件/远程配置、过滤规则、书签 Pins 及标记高亮保存为 `.lpconfig` 快照文件，方便团队一键复刻现场。
11. **[x] 国际化支持 (Internationalization / i18n)**
    - **核心价值**：搭建多语言 `i18next` + `react-i18next` 基础架构，支持 English / 中文 界面即时切换与持久化存储。

---

### 🔵 P3: 前沿智能化与特定场景 (Future Exploration & Intelligence)

_具有较高创新价值或面向硬核用户的定制功能。_

12. **AI 异常诊断助手 (AI Error Copilot)**
    - **核心价值**：接入 LLM 大模型自动读取 Stack Trace 堆栈上下文，智能分析报错根因并给出修复参考。
13. **高级 DSL 搜索语言 (Advanced Search DSL)**
    - **核心价值**：支持形如 `level:ERROR AND timestamp>now-1h` 的领域查询语言。
14. **离线模式 (Offline Mode)**
    - **核心价值**：针对 SSH 远程日志，在断网时保留本地缓存供分析，并在网络恢复后自动续传同步。
15. **主题自定义与编辑 (Customizable Themes)**
    - **核心价值**：提供主题编辑器，支持用户定制配色方案、字体及玻璃拟态效果。

---

### ⚪ P4: 架构演进与次要优化 (Long-term Backlog)

_架构预留、系统级标准对接或次要辅助功能。_

16. **无障碍辅助支持 (Accessibility Support - WCAG 2.1 AA)**：支持键盘导航与 ARIA 标签。
17. **插件化架构 (Plugin Architecture)**：轻量级第三方解析器与导出插件扩展机制。