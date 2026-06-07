# MCP 详细创建说明书

这是一份给小白看的创建说明书。它不是冷冰冰的流水账，而是把这个 MCP 从 0 到现在怎么长出来，拆成一站一站的小积木。

当前公开版：v0.6.0

## 先说人话：这个 MCP 是干什么的

它是一个本地运行的微信小程序工程顾问。你可以把它理解成一个会拆任务的开发搭子：你说想做一个小程序，它帮你把页面、数据、云函数、权限、测试、上线检查都摆出来。

它不负责偷偷部署，也不负责保存任何密钥。它的重点是让刚入门的人先看懂、再动手、最后能检查。

## 创建思路

- 第一层：先定方向。它不是模板库，而是工程顾问。
- 第二层：先能讲清楚。让小白知道页面、云函数、数据库、CloudBase 各自负责什么。
- 第三层：再能看项目。扫描 demo 小程序，画项目地图，解释文件角色。
- 第四层：补安全边界。客户素材、手机号、订单号、fileID、密钥都不能乱进日志。
- 第五层：加更新机制。内部日志保留细节，公开文档只同步脱敏后的说明。

## 创建路线

## 第 1 站：2026-06-07，v0.3.0

这一站做的事：整理 维护者与 Codex 关于微信小程序工程 MCP 的完整优化脉络，并准备嵌入 Understand-Anything 启发的轻量项目理解能力。

### 小白怎么理解
- 将 MCP 定位为本地小程序工程顾问，而不是模板库：主线是帮助小白把微信原生小程序从想法拆到上线。
- 优先遵守本机 AGENTS.md、使用者工作方式、本地知识库规则和私有自我进化规则。
- 此前已生成 MCP 包：<local-path>，并保持本地 stdio MCP、无外发、无密钥保存。
- 此前 MCP v0.2.0 已包含 10 个工具、7 个资源、3 个 prompt，覆盖项目扫描、蓝图、任务拆解、上线清单、文档索引、CloudBase MCP 指南、本地用户画像、技能路由、优化建议、本地知识库查询。

### 实际动了哪些地方
- 此前新增或维护：data/user-profile.json、data/skill-usage.json、outputs/local-codex-claude-audit.md。
- 本轮计划修改：src/server.js、README.md、scripts/smoke-test.js、package.json。
- 本轮计划新增：data/understanding-templates.json、logs/README.md、logs/mcp-optimization-log.jsonl、logs/mcp-optimization-log.md。

### 怎么确认没有跑偏
- 此前 v0.2.0 冒烟测试通过：initialize true，toolCount 10，resourceCount 7，promptCount 3。
- 本轮 v0.3.0 完成后需要运行 node --check src/server.js、npm run smoke:test，并手动调用新增日志与理解工具。

## 第 2 站：2026-06-07，v0.3.0

这一站做的事：完成 v0.3.0 优化：内置追加式 MCP 优化日志，并嵌入 Understand-Anything 启发的小程序项目理解能力。

### 小白怎么理解
- 日志采用 JSONL + Markdown 双文件，既方便机器读取，也方便维护者 直接审阅。
- 新增日志 append/read/status 三个 MCP 工具和 full/latest/status 三个资源。
- Understand-Anything 只作为方法论来源，嵌入轻量项目地图、全流程理解、文件角色解释、功能影响分析四个工具。
- 继续保持 MCP 无依赖、本地 stdio、安全文本扫描和不保存密钥的边界。

### 实际动了哪些地方
- src/server.js：新增日志函数、日志工具、日志资源、项目图谱、流程理解、文件角色和功能影响分析。
- data/understanding-templates.json：新增小程序理解阶段、节点/边说明、客户私密相册规则和 Understand-Anything 来源说明。
- logs/README.md：新增日志目录说明、强制记录规则和禁止记录项。
- logs/mcp-optimization-log.jsonl：新增初始历史日志。
- logs/mcp-optimization-log.md：新增人可读历史日志。

### 怎么确认没有跑偏
- node --check src/server.js 通过。
- npm run smoke:test 通过：toolCount 17，resourceCount 12，promptCount 3，日志工具和理解工具均可调用。
- 手动调用 miniapp_project_map、miniapp_understand_file_role、miniapp_understand_feature_impact 通过，均返回有效 Markdown。

## 第 3 站：2026-06-07，v0.3.0

这一站做的事：完成 GitHub CodeGraph 项目阅读与 MCP 融合可行性评估，结论是吸收轻量代码图谱/上下文/影响分析方法，不直接捆绑 Rust 二进制和全量 hooks。

### 小白怎么理解
- 优先评估 suatkocar/codegraph，因为其标题就是 CodeGraph，且定位为 codebase intelligence MCP server，与当前 MCP 最相关。
- 已克隆仓库到本地 work/codegraph-research/suatkocar-codegraph 做只读分析。
- 判断可以融合 CodeGraph 的方法论和轻量能力：增量 file hash、CodeNode/CodeEdge 模型、四层上下文预算、detail_level、影响面分析、Mermaid 图、工具 preset、安全规则格式。
- 判断不应直接打包 CodeGraph Rust 二进制、46 个工具、Claude hooks、全量 OWASP/CWE 规则、fastembed/sqlite-vec/tree-sitter 全语言栈。

### 实际动了哪些地方
- outputs/codegraph-fusion-evaluation.md：新增 CodeGraph 工作原理、源码文档阅读范围、融合判断和分阶段建议。
- logs/mcp-optimization-log.jsonl：追加本轮研究评估日志。
- logs/mcp-optimization-log.md：追加本轮研究评估日志。

### 怎么确认没有跑偏
- 已成功克隆 suatkocar/codegraph。
- 已读取 README、docs、Cargo.toml、LICENSE、CHANGELOG、ROADMAP、CLAUDE、核心 src 模块、queries、rules、tests/eval 文件结构。
- 已生成本地评估报告。
- 本轮未改 MCP server 代码，因此未运行 MCP 冒烟测试。

## 第 4 站：2026-06-07，v0.4.0

这一站做的事：完成 v0.4.0 融合升级：把 CodeGraph 评估中最适合微信小程序工程 MCP 的轻量图谱、上下文、依赖图、增量索引和安全快扫能力嵌入本地 MCP。

### 小白怎么理解
- 将 MCP 版本从 0.3.0 升级到 0.4.0。
- 吸收 CodeGraph 的 CodeNode/CodeEdge、重要节点排序、路由链路、四层上下文、Mermaid 图谱和增量 hash 思路。
- 保留当前 MCP 的轻量、本地、无外部依赖、stdio 运行方式，不安装 CodeGraph Rust 二进制，也不引入向量库、全语言 Tree-sitter 或全量 hooks。
- 把通用 CodeGraph 能力改造成微信小程序定制能力，重点识别页面、云函数、数据库集合、route、controller/action、cloud function 调用和依赖边。

### 实际动了哪些地方
- src/server.js：新增 crypto hash、轻量图谱增强、route/action/controller/cloud edges、重要度评分、四层上下文、Mermaid 依赖图、图谱统计、增量索引状态和小程序安全快扫。
- package.json：版本升级为 0.4.0。
- README.md：补充 CodeGraph 融合边界、新工具、新资源、缓存策略和安全说明。
- scripts/smoke-test.js：增加 v0.4.0 新工具和新资源的冒烟检查。
- cache/README.md：新增本地索引缓存说明，明确只有 writeCache: true 时写入缓存。

### 怎么确认没有跑偏
- node --check src/server.js 已通过。
- npm run smoke:test 已通过，检查结果包含 toolCount 22、resourceCount 17、promptCount 3。
- 已手动调用 miniapp_project_map、miniapp_relevant_context、miniapp_dependency_diagram、miniapp_index_status，均返回有效结果。
- miniapp_index_status 已对当前小程序项目完成默认全量安全文本扫描，扫描文件数 612，并写入 MCP cache。

## 第 5 站：2026-06-07，v0.4.1

这一站做的事：完成 v0.4.1 小步可验证优化：强化 realpath 路径安全、包内 synthetic fixture 验证、WXML/WXSS/JSON 组件关系识别、上线安全快扫规则和日志 outcome 字段。

### 小白怎么理解
- 版本从 0.4.0 升级到 0.4.1；本轮未新增 tool/resource/prompt，因此采用 patch 版本。
- 采纳 A5 安全否决意见：默认项目从包外真实项目切换为目标包内 demo fixture，并强化 realpath、软链接跳过、项目外文件拒绝和敏感文件名跳过。
- 采纳 A2 建议：增强 WXML/WXSS/JSON 轻量解析，加入 usingComponents、WXML 自定义组件标签、WXSS @import、页面跳转和 controller/service/model 语义边。
- 采纳 A4 建议：扩展安全快扫规则，覆盖数据库权限、云存储访问、云函数权限、隐私字段、前端硬编码、测试残留和项目配置边界。

### 实际动了哪些地方
- src/server.js：版本 0.4.1；新增 realpath/软链接安全入口；miniapp_inspect_project 统一走安全项目根；增强组件关系图谱；扩展安全快扫；yunyu_query_context 增加 confirmed 确认门；日志工具增加 outcome 字段。
- package.json：版本 0.4.1。
- config/defaults.json：默认 currentProjectPath 改为目标包内 demo fixture，避免默认扫描包外真实项目。
- scripts/smoke-test.js：使用 synthetic fixture；新增组件关系、index 只读、项目外文件拒绝、知识库确认门断言。
- README.md：更新安全边界、默认项目、组件关系、安全快扫、smoke 输出和 yunyu_query_context confirmed 说明。

### 怎么确认没有跑偏
- 基线：修改前 node --check src/server.js 通过，npm smoke 通过，实际 tool/resource/prompt 为 22/17/3，JSONL 日志为 4 行。
- 语法：node --check src/server.js 通过；node --check scripts/smoke-test.js 通过。
- 回归：npm --prefix <local-path> run smoke:test 通过，输出 toolCount 22、resourceCount 17、promptCount 3。
- 新增行为：smoke 确认 projectMapJsonHasComponentRelations、indexStatusReadOnly、fileRoleShowsComponentTags、outsideFileRejected、yunyuRequiresConfirmation 均为 true。

## 第 6 站：2026-06-07，v0.5.0

这一站做的事：完成 v0.5.0 优化：新增客户成片展示小程序路线图工具与资源，并加入轻量参数校验和 JSON-RPC 错误码分类。

### 小白怎么理解
- 版本从 0.4.1 升级到 0.5.0，因为新增用户可见 tool 和 resource。
- 新增 miniapp_showcase_roadmap，输出业务定位、MVP 边界、阶段 SOP、页面、数据、CloudBase、隐私与上线清单。
- 新增 miniapp://roadmap/showcase 资源，方便直接读取默认路线图。
- 路线图内容沉淀到 data/understanding-templates.json 的 showcaseRoadmap 配置块，避免全部硬编码。

### 实际动了哪些地方
- src/server.js：版本 0.5.0；新增 miniappShowcaseRoadmap；注册 miniapp_showcase_roadmap；新增 miniapp://roadmap/showcase；加入 McpError 与 validateToolArguments。
- data/understanding-templates.json：新增 showcaseRoadmap，包括业务定位、MVP 范围、阶段 SOP、页面规划、数据集合、云函数、隐私清单、上线清单和下一步问题。
- scripts/smoke-test.js：新增路线图工具、路线图资源、非法枚举和缺少必填字段参数校验断言。
- README.md：新增路线图工具说明、资源 URI、smoke 输出字段和参数校验说明。
- package.json：版本升级到 0.5.0。

### 怎么确认没有跑偏
- 基线：修改前 package/server 版本为 0.4.1，JSONL 日志为 5 行，node --check 与 npm smoke 均通过。
- 语法：node --check src/server.js 通过；node --check scripts/smoke-test.js 通过。
- JSON：data/understanding-templates.json 可正常 JSON.parse。
- 回归：npm --prefix <local-path> run smoke:test 通过，toolCount 23、resourceCount 18、promptCount 3。

## 第 7 站：2026-06-07，v0.5.1

这一站做的事：完成 v0.5.1 开源准备：整理中文 GitHub README、MIT 许可证、公开脱敏 CHANGELOG 同步机制、通用默认配置和发布前安全忽略规则。

### 小白怎么理解
- 遵守公开发布前确认规则：本轮只做本地开源准备、验证和本地提交准备，不创建远程仓库、不 git push。
- 不直接公开原始 MCP 优化日志，因为原始日志包含本机路径、个人工作流和本地知识库上下文描述；改为生成脱敏公开版 CHANGELOG.md。
- 新增 scripts/sync-public-changelog.js，从 logs/mcp-optimization-log.jsonl 生成 CHANGELOG.md，并更新 README 标记区，满足后续日志同步。
- package/server 版本升级到 0.5.1，因为本轮修改公开文档、配置和日志同步机制但不新增 tool/resource/prompt。

### 实际动了哪些地方
- README.md：重写为中文开源项目说明，加入项目标题、核心能力、快速开始、MCP 配置、工具表、安全边界和 changelog 同步说明。
- CHANGELOG.md：由内部 JSONL 日志生成脱敏公开版更新日志，并在 README 最近更新区同步摘要。
- scripts/sync-public-changelog.js：新增公开 changelog 同步脚本，自动脱敏本机路径、手机号、密钥形态、云存储路径和本地业务名称。
- package.json：版本升级到 0.5.1；private 改为 false；license 改为 MIT；新增 changelog:sync 脚本、中文 description 和 keywords。
- LICENSE：新增 MIT 许可证。

### 怎么确认没有跑偏
- node --check src/server.js 通过。
- node --check scripts/smoke-test.js 通过。
- node --check scripts/sync-public-changelog.js 通过。
- npm run changelog:sync 通过，读取 6 条历史日志并生成 CHANGELOG.md/README 最近更新摘要。

## 第 8 站：2026-06-07，v0.5.2

这一站做的事：完成 v0.5.2 文档同步升级：新增小白友好版 MCP 详细创建说明书，并纳入 changelog:sync 自动更新流程。

### 小白怎么理解
- 把“随时更新”落成脚本机制：npm run changelog:sync 同步 README 最近更新、CHANGELOG.md 和 docs/mcp-creation-guide.md。
- 新增 docs/mcp-creation-guide.md，按创建路线拆成一站一站的小白说明，保留轻松语气但继续脱敏。
- 版本从 0.5.1 升级到 0.5.2，本轮不新增 MCP tool/resource/prompt，只增强公开文档同步能力。
- 继续不公开原始内部日志，公开说明书只从脱敏后的日志字段生成。

### 实际动了哪些地方
- scripts/sync-public-changelog.js：新增 docs/mcp-creation-guide.md 生成逻辑，并在输出结果里报告 creationGuide。
- docs/mcp-creation-guide.md：新增小白友好版 MCP 详细创建说明书，按版本路线解释创建过程和维护方式。
- README.md：补充说明 changelog:sync 会同步 README、CHANGELOG 和创建说明书，并链接 docs/mcp-creation-guide.md。
- package.json：版本升级到 0.5.2。
- src/server.js：SERVER_INFO 版本升级到 0.5.2。

### 怎么确认没有跑偏
- npm run changelog:sync 通过，生成 docs/mcp-creation-guide.md。
- node --check src/server.js 通过。
- node --check scripts/smoke-test.js 通过。
- node --check scripts/sync-public-changelog.js 通过。

## 第 9 站：2026-06-07，v0.6.0

这一站做的事：完成 v0.6.0 开发复盘沉淀：新增小程序故障恢复手册和云函数/小程序/NPM/GitHub 发布前预检工具。

### 小白怎么理解
- 版本从 0.5.2 升级到 0.6.0，因为新增两个用户可见工具和两个资源。
- 新增 miniapp_dev_recovery_playbook，把 systemError 恢复、app.json 页面四件套、云函数路由/部署、DevTools EISDIR、版本发布、代理协作边界固化成 playbook。
- 新增 miniapp_cloudbase_release_preflight，把云函数部署、小程序上传/审核发布、NPM/GitHub 同步前检查统一到人工确认门。
- 将本次真实开发中的问题模式写入 data/understanding-templates.json，避免只硬编码在 server 函数里。

### 实际动了哪些地方
- src/server.js：版本升到 0.6.0；新增 miniappDevRecoveryPlaybook、miniappCloudbaseReleasePreflight；注册两个工具和两个资源；更新优化建议。
- data/understanding-templates.json：新增 devRecoveryPlaybook 模板，记录本次开发问题模式、处理步骤、预防策略和避免项。
- scripts/smoke-test.js：新增两个工具和两个资源的冒烟测试断言，预期 toolCount 25、resourceCount 20。
- README.md：更新版本、核心能力、工具表、资源列表和 smoke test 示例数量。
- package.json：版本升到 0.6.0。

### 怎么确认没有跑偏
- node --check src/server.js 通过。
- node --check scripts/smoke-test.js 通过。
- data/understanding-templates.json 可正常 JSON.parse。
- npm run smoke:test 通过：toolCount 25、resourceCount 20、promptCount 3。

## 以后怎么更新这份说明书

每次 MCP 有升级、优化、修 bug、补文档，先把内部优化日志追加好，然后运行：

```bash
npm run changelog:sync
```

这条命令会一起更新三样东西：

- `CHANGELOG.md`：公开更新日志。
- `README.md`：最近更新摘要。
- `docs/mcp-creation-guide.md`：这份小白友好的详细创建说明书。

## 安全提醒

这份说明书来自内部日志，但生成时会脱敏。本机路径、手机号、密钥形态、真实云存储路径、本地业务名称都会被替换或泛化。公开仓库里不应该出现真实客户资料、token、AppSecret、订单号或真实 fileID。
