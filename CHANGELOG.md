# 更新日志

本文件由 `npm run changelog:sync` 从内部 MCP 优化日志生成，面向 GitHub 公开说明使用。

同步时会脱敏本机路径、手机号、密钥形态、真实云存储路径和本地业务知识库描述；原始内部日志默认不提交到 GitHub。

## 2026-06-07 - v0.6.0

- 状态：success
- 类型：dev-recovery-release-playbook-upgrade
- 摘要：完成 v0.6.0 开发复盘沉淀：新增小程序故障恢复手册和云函数/小程序/NPM/GitHub 发布前预检工具。

### 主要变更
- 版本从 0.5.2 升级到 0.6.0，因为新增两个用户可见工具和两个资源。
- 新增 miniapp_dev_recovery_playbook，把 systemError 恢复、app.json 页面四件套、云函数路由/部署、DevTools EISDIR、版本发布、代理协作边界固化成 playbook。
- 新增 miniapp_cloudbase_release_preflight，把云函数部署、小程序上传/审核发布、NPM/GitHub 同步前检查统一到人工确认门。
- 将本次真实开发中的问题模式写入 data/understanding-templates.json，避免只硬编码在 server 函数里。
- README、smoke test、资源列表和优化建议同步更新，确保新能力可见且可验证。
- NPM publish 和 git push 属于外发动作，本轮只完成本地准备，执行前仍需用户最终确认。

### 文件与验证
- src/server.js：版本升到 0.6.0；新增 miniappDevRecoveryPlaybook、miniappCloudbaseReleasePreflight；注册两个工具和两个资源；更新优化建议。
- data/understanding-templates.json：新增 devRecoveryPlaybook 模板，记录本次开发问题模式、处理步骤、预防策略和避免项。
- scripts/smoke-test.js：新增两个工具和两个资源的冒烟测试断言，预期 toolCount 25、resourceCount 20。
- README.md：更新版本、核心能力、工具表、资源列表和 smoke test 示例数量。
- package.json：版本升到 0.6.0。
- node --check src/server.js 通过。
- node --check scripts/smoke-test.js 通过。
- data/understanding-templates.json 可正常 JSON.parse。
- npm run smoke:test 通过：toolCount 25、resourceCount 20、promptCount 3。
- 新增 miniapp_dev_recovery_playbook 返回 DevTools EISDIR 恢复内容。

### 安全边界
- 本轮只修改本地 MCP 项目文件，未修改真实小程序项目、云数据库或云函数线上环境。
- 本轮未执行 npm publish、git push、部署、上传、审核发布或外部账号权限修改。
- 公开同步前仍需脱敏检查，原始内部日志继续默认不提交 GitHub。
- 发布 NPM 和 GitHub 前必须向用户说明包名、版本、远程仓库、提交范围和影响后再执行。

## 2026-06-07 - v0.5.2

- 状态：success
- 类型：creation-guide-sync-upgrade
- 摘要：完成 v0.5.2 文档同步升级：新增小白友好版 MCP 详细创建说明书，并纳入 changelog:sync 自动更新流程。

### 主要变更
- 把“随时更新”落成脚本机制：npm run changelog:sync 同步 README 最近更新、CHANGELOG.md 和 docs/mcp-creation-guide.md。
- 新增 docs/mcp-creation-guide.md，按创建路线拆成一站一站的小白说明，保留轻松语气但继续脱敏。
- 版本从 0.5.1 升级到 0.5.2，本轮不新增 MCP tool/resource/prompt，只增强公开文档同步能力。
- 继续不公开原始内部日志，公开说明书只从脱敏后的日志字段生成。
- GitHub CLI gh 不存在，后续发布需要改用浏览器登录态、GitHub API 凭据或由用户安装 gh 后继续。

### 文件与验证
- scripts/sync-public-changelog.js：新增 docs/mcp-creation-guide.md 生成逻辑，并在输出结果里报告 creationGuide。
- docs/mcp-creation-guide.md：新增小白友好版 MCP 详细创建说明书，按版本路线解释创建过程和维护方式。
- README.md：补充说明 changelog:sync 会同步 README、CHANGELOG 和创建说明书，并链接 docs/mcp-creation-guide.md。
- package.json：版本升级到 0.5.2。
- src/server.js：SERVER_INFO 版本升级到 0.5.2。
- npm run changelog:sync 通过，生成 docs/mcp-creation-guide.md。
- node --check src/server.js 通过。
- node --check scripts/smoke-test.js 通过。
- node --check scripts/sync-public-changelog.js 通过。
- npm run smoke:test 通过：toolCount 23、resourceCount 18、promptCount 3。

### 安全边界
- 本轮未上传、未创建 GitHub 仓库、未 git push、未部署、未改权限。
- 本轮未安装依赖，未执行 npm install、curl、wget、brew 或远程脚本。
- 本轮未读取真实客户项目、真实 CloudBase/Tencent 环境或目标工程外业务资料。
- 原始内部日志仍在本地并被 .gitignore 排除；公开说明书只使用脱敏字段。
- 发布到 GitHub 前仍需可用发布通道；当前 gh 命令不存在。

## 2026-06-07 - v0.5.1

- 状态：success
- 类型：github-open-source-prep
- 摘要：完成 v0.5.1 开源准备：整理中文 GitHub README、MIT 许可证、公开脱敏 CHANGELOG 同步机制、通用默认配置和发布前安全忽略规则。

### 主要变更
- 遵守公开发布前确认规则：本轮只做本地开源准备、验证和本地提交准备，不创建远程仓库、不 git push。
- 不直接公开原始 MCP 优化日志，因为原始日志包含本机路径、个人工作流和本地知识库上下文描述；改为生成脱敏公开版 CHANGELOG.md。
- 新增 scripts/sync-public-changelog.js，从 logs/mcp-optimization-log.jsonl 生成 CHANGELOG.md，并更新 README 标记区，满足后续日志同步。
- package/server 版本升级到 0.5.1，因为本轮修改公开文档、配置和日志同步机制但不新增 tool/resource/prompt。
- 将 README、package 描述、默认配置和 MCP 示例配置改为公开通用表达，保留已有工具名兼容。
- 新增 .gitignore 排除原始内部日志、cache JSON、本地用户画像、审计输出、环境文件和敏感配置。

### 文件与验证
- README.md：重写为中文开源项目说明，加入项目标题、核心能力、快速开始、MCP 配置、工具表、安全边界和 changelog 同步说明。
- CHANGELOG.md：由内部 JSONL 日志生成脱敏公开版更新日志，并在 README 最近更新区同步摘要。
- scripts/sync-public-changelog.js：新增公开 changelog 同步脚本，自动脱敏本机路径、手机号、密钥形态、云存储路径和本地业务名称。
- package.json：版本升级到 0.5.1；private 改为 false；license 改为 MIT；新增 changelog:sync 脚本、中文 description 和 keywords。
- LICENSE：新增 MIT 许可证。
- node --check src/server.js 通过。
- node --check scripts/smoke-test.js 通过。
- node --check scripts/sync-public-changelog.js 通过。
- npm run changelog:sync 通过，读取 6 条历史日志并生成 CHANGELOG.md/README 最近更新摘要。
- npm run smoke:test 通过：toolCount 23、resourceCount 18、promptCount 3；路线图、资源、参数校验、项目外文件拒绝、知识库确认门均通过。

### 安全边界
- 本轮未联网、未上传、未创建 GitHub 仓库、未 git push、未部署、未改权限、未改外部账号。
- 本轮未执行 npm install、git clone、curl、wget、brew、npx init 或远程脚本。
- 本轮未读取真实客户项目、真实 CloudBase/Tencent 环境、本地知识库原文或目标工程外业务资料。
- 原始内部日志仍保留在本地并被 .gitignore 排除；公开同步只使用脱敏后的 CHANGELOG.md。
- 最终 GitHub 创建仓库和 push 前仍需用户确认 owner/repo、public 可见性、commit、分支和将上传的文件范围。

## 2026-06-07 - v0.5.0

- 状态：success
- 类型：showcase-roadmap-schema-upgrade
- 摘要：完成 v0.5.0 优化：新增客户成片展示小程序路线图工具与资源，并加入轻量参数校验和 JSON-RPC 错误码分类。

### 主要变更
- 版本从 0.4.1 升级到 0.5.0，因为新增用户可见 tool 和 resource。
- 新增 miniapp_showcase_roadmap，输出业务定位、MVP 边界、阶段 SOP、页面、数据、CloudBase、隐私与上线清单。
- 新增 miniapp://roadmap/showcase 资源，方便直接读取默认路线图。
- 路线图内容沉淀到 data/understanding-templates.json 的 showcaseRoadmap 配置块，避免全部硬编码。
- 加入轻量 inputSchema 校验，覆盖 required、type、enum、additionalProperties；无效参数返回 JSON-RPC -32602，未知工具返回 -32601。
- 继续不生成页面模板代码、不连接 CloudBase、不修改真实权限、不读取客户资料。

### 文件与验证
- src/server.js：版本 0.5.0；新增 miniappShowcaseRoadmap；注册 miniapp_showcase_roadmap；新增 miniapp://roadmap/showcase；加入 McpError 与 validateToolArguments。
- data/understanding-templates.json：新增 showcaseRoadmap，包括业务定位、MVP 范围、阶段 SOP、页面规划、数据集合、云函数、隐私清单、上线清单和下一步问题。
- scripts/smoke-test.js：新增路线图工具、路线图资源、非法枚举和缺少必填字段参数校验断言。
- README.md：新增路线图工具说明、资源 URI、smoke 输出字段和参数校验说明。
- package.json：版本升级到 0.5.0。
- 基线：修改前 package/server 版本为 0.4.1，JSONL 日志为 5 行，node --check 与 npm smoke 均通过。
- 语法：node --check src/server.js 通过；node --check scripts/smoke-test.js 通过。
- JSON：data/understanding-templates.json 可正常 JSON.parse。
- 回归：npm --prefix <local-path> run smoke:test 通过，toolCount 23、resourceCount 18、promptCount 3。
- 新增行为：miniapp_showcase_roadmap 正常返回客户成片展示小程序路线图；miniapp://roadmap/showcase 正常返回阶段 SOP。

### 安全边界
- 本轮未联网、未外发、未上传、未部署、未连接真实 CloudBase/Tencent。
- 本轮未执行 npm install、git clone、发布、权限修改或外部脚本。
- 本轮未读取真实小程序项目、客户资料、本地知识库原文、D 盘全盘或 HOME 下其他项目。
- 路线图只使用通用虚构业务结构，不包含真实客户资料、手机号、订单号、密钥或真实 fileID。
- 日志只记录工程摘要，不记录隐藏推理、完整命令输出、客户原文或敏感凭证。

## 2026-06-07 - v0.4.1

- 状态：success
- 类型：safety-component-fixture-upgrade
- 摘要：完成 v0.4.1 小步可验证优化：强化 realpath 路径安全、包内 synthetic fixture 验证、WXML/WXSS/JSON 组件关系识别、上线安全快扫规则和日志 outcome 字段。

### 主要变更
- 版本从 0.4.0 升级到 0.4.1；本轮未新增 tool/resource/prompt，因此采用 patch 版本。
- 采纳 A5 安全否决意见：默认项目从包外真实项目切换为目标包内 demo fixture，并强化 realpath、软链接跳过、项目外文件拒绝和敏感文件名跳过。
- 采纳 A2 建议：增强 WXML/WXSS/JSON 轻量解析，加入 usingComponents、WXML 自定义组件标签、WXSS @import、页面跳转和 controller/service/model 语义边。
- 采纳 A4 建议：扩展安全快扫规则，覆盖数据库权限、云存储访问、云函数权限、隐私字段、前端硬编码、测试残留和项目配置边界。
- 采纳 A6 建议：smoke test 改为包内 synthetic fixture，覆盖组件关系、默认不写 cache、项目外文件拒绝、本地知识库确认门。
- 暂缓 A3 的新增 miniapp_showcase_roadmap 工具，因为新增 tool/resource 会扩大本轮变更面；路线图能力保留下轮评估。

### 文件与验证
- src/server.js：版本 0.4.1；新增 realpath/软链接安全入口；miniapp_inspect_project 统一走安全项目根；增强组件关系图谱；扩展安全快扫；yunyu_query_context 增加 confirmed 确认门；日志工具增加 outcome 字段。
- package.json：版本 0.4.1。
- config/defaults.json：默认 currentProjectPath 改为目标包内 demo fixture，避免默认扫描包外真实项目。
- scripts/smoke-test.js：使用 synthetic fixture；新增组件关系、index 只读、项目外文件拒绝、知识库确认门断言。
- README.md：更新安全边界、默认项目、组件关系、安全快扫、smoke 输出和 yunyu_query_context confirmed 说明。
- 基线：修改前 node --check src/server.js 通过，npm smoke 通过，实际 tool/resource/prompt 为 22/17/3，JSONL 日志为 4 行。
- 语法：node --check src/server.js 通过；node --check scripts/smoke-test.js 通过。
- 回归：npm --prefix <local-path> run smoke:test 通过，输出 toolCount 22、resourceCount 17、promptCount 3。
- 新增行为：smoke 确认 projectMapJsonHasComponentRelations、indexStatusReadOnly、fileRoleShowsComponentTags、outsideFileRejected、yunyuRequiresConfirmation 均为 true。
- 补充验证：miniapp_index_status writeCache:false 不写 cache，writeCache:true 只写目标包 cache 两个索引文件。

### 安全边界
- 本轮未联网、未搜索 GitHub、未访问官方文档、未调用外部 API。
- 本轮未执行 npm install、git clone、curl、wget、brew、cargo install、npx init、发布、部署、上传、同步或权限修改。
- 本轮未连接真实 CloudBase/Tencent/微信开发者工具，未修改 MCP 客户端配置、全局 Codex/Claude 配置或 hooks。
- 本轮未读取真实用户小程序项目、客户资料、本地知识库原文、D 盘全盘或 HOME 下其他项目；默认项目已改为包内 synthetic fixture。
- 本轮没有永久删除用户文件；fixture 中敏感命名样例 tokens.wxss 保留，用于验证跳过规则。
- 日志只记录工程摘要，不记录隐藏推理、完整子 agent transcript、完整命令输出、密钥、token、客户原文、真实手机号、订单号或真实云存储 fileID。

## 2026-06-07 - v0.4.0

- 状态：unspecified
- 类型：codegraph-fusion-upgrade
- 摘要：完成 v0.4.0 融合升级：把 CodeGraph 评估中最适合微信小程序工程 MCP 的轻量图谱、上下文、依赖图、增量索引和安全快扫能力嵌入本地 MCP。

### 主要变更
- 将 MCP 版本从 0.3.0 升级到 0.4.0。
- 吸收 CodeGraph 的 CodeNode/CodeEdge、重要节点排序、路由链路、四层上下文、Mermaid 图谱和增量 hash 思路。
- 保留当前 MCP 的轻量、本地、无外部依赖、stdio 运行方式，不安装 CodeGraph Rust 二进制，也不引入向量库、全语言 Tree-sitter 或全量 hooks。
- 把通用 CodeGraph 能力改造成微信小程序定制能力，重点识别页面、云函数、数据库集合、route、controller/action、cloud function 调用和依赖边。
- 安全快扫只输出路径、行号、规则、严重级别和修复建议，不输出原始敏感匹配文本。
- 增量索引默认只读；只有调用 miniapp_index_status 且 writeCache 为 true 时才写入 MCP cache 目录。

### 文件与验证
- src/server.js：新增 crypto hash、轻量图谱增强、route/action/controller/cloud edges、重要度评分、四层上下文、Mermaid 依赖图、图谱统计、增量索引状态和小程序安全快扫。
- package.json：版本升级为 0.4.0。
- README.md：补充 CodeGraph 融合边界、新工具、新资源、缓存策略和安全说明。
- scripts/smoke-test.js：增加 v0.4.0 新工具和新资源的冒烟检查。
- cache/README.md：新增本地索引缓存说明，明确只有 writeCache: true 时写入缓存。
- node --check src/server.js 已通过。
- npm run smoke:test 已通过，检查结果包含 toolCount 22、resourceCount 17、promptCount 3。
- 已手动调用 miniapp_project_map、miniapp_relevant_context、miniapp_dependency_diagram、miniapp_index_status，均返回有效结果。
- miniapp_index_status 已对当前小程序项目完成默认全量安全文本扫描，扫描文件数 612，并写入 MCP cache。

### 安全边界
- 本轮未执行 install.sh、brew、cargo install、npx init 或任何远程安装脚本。
- 本轮未修改 <local-config> 客户端配置、全局 hooks 或外部系统。
- 本轮未上传、未同步、未发布公网、未写入飞书或第三方账号。
- 缓存只保存安全文本文件路径、hash、节点/边摘要和统计，不保存密钥、token、客户隐私原文或敏感文件内容。
- 后续如需连接真实 CloudBase MCP、公开部署或修改账号权限，仍需维护者 单独确认。

## 2026-06-07 - v0.3.0

- 状态：unspecified
- 类型：research-fusion-evaluation
- 摘要：完成 GitHub CodeGraph 项目阅读与 MCP 融合可行性评估，结论是吸收轻量代码图谱/上下文/影响分析方法，不直接捆绑 Rust 二进制和全量 hooks。

### 主要变更
- 优先评估 suatkocar/codegraph，因为其标题就是 CodeGraph，且定位为 codebase intelligence MCP server，与当前 MCP 最相关。
- 已克隆仓库到本地 work/codegraph-research/suatkocar-codegraph 做只读分析。
- 判断可以融合 CodeGraph 的方法论和轻量能力：增量 file hash、CodeNode/CodeEdge 模型、四层上下文预算、detail_level、影响面分析、Mermaid 图、工具 preset、安全规则格式。
- 判断不应直接打包 CodeGraph Rust 二进制、46 个工具、Claude hooks、全量 OWASP/CWE 规则、fastembed/sqlite-vec/tree-sitter 全语言栈。
- 本轮只生成本地评估报告和追加 MCP 日志，不修改全局 Codex/Claude 配置，不安装外部二进制，不执行部署。

### 文件与验证
- outputs/codegraph-fusion-evaluation.md：新增 CodeGraph 工作原理、源码文档阅读范围、融合判断和分阶段建议。
- logs/mcp-optimization-log.jsonl：追加本轮研究评估日志。
- logs/mcp-optimization-log.md：追加本轮研究评估日志。
- 已成功克隆 suatkocar/codegraph。
- 已读取 README、docs、Cargo.toml、LICENSE、CHANGELOG、ROADMAP、CLAUDE、核心 src 模块、queries、rules、tests/eval 文件结构。
- 已生成本地评估报告。
- 本轮未改 MCP server 代码，因此未运行 MCP 冒烟测试。

### 安全边界
- 未执行 install.sh、install.ps1、brew、cargo install、npx init。
- 未修改 <local-config> 客户端配置或全局 hooks。
- 未上传、未发布、未同步、未写入任何外部系统。
- 报告和日志只记录工程摘要，不记录密钥、token、客户隐私原文。

## 2026-06-07 - v0.3.0

- 状态：unspecified
- 类型：optimization-verification
- 摘要：完成 v0.3.0 优化：内置追加式 MCP 优化日志，并嵌入 Understand-Anything 启发的小程序项目理解能力。

### 主要变更
- 日志采用 JSONL + Markdown 双文件，既方便机器读取，也方便维护者 直接审阅。
- 新增日志 append/read/status 三个 MCP 工具和 full/latest/status 三个资源。
- Understand-Anything 只作为方法论来源，嵌入轻量项目地图、全流程理解、文件角色解释、功能影响分析四个工具。
- 继续保持 MCP 无依赖、本地 stdio、安全文本扫描和不保存密钥的边界。
- README 明确写入后续每轮优化必须追加日志的规则和限制。

### 文件与验证
- src/server.js：新增日志函数、日志工具、日志资源、项目图谱、流程理解、文件角色和功能影响分析。
- data/understanding-templates.json：新增小程序理解阶段、节点/边说明、客户私密相册规则和 Understand-Anything 来源说明。
- logs/README.md：新增日志目录说明、强制记录规则和禁止记录项。
- logs/mcp-optimization-log.jsonl：新增初始历史日志。
- logs/mcp-optimization-log.md：新增人可读历史日志。
- node --check src/server.js 通过。
- npm run smoke:test 通过：toolCount 17，resourceCount 12，promptCount 3，日志工具和理解工具均可调用。
- 手动调用 miniapp_project_map、miniapp_understand_file_role、miniapp_understand_feature_impact 通过，均返回有效 Markdown。

### 安全边界
- 日志只记录工程摘要，不记录隐藏推理、密钥、token、客户隐私原文。
- 项目扫描跳过敏感文件和高风险目录，只读取安全文本文件。
- 本轮没有上传、同步、发布、部署公网、改账号权限或写入外部系统。

## 2026-06-07 - v0.3.0

- 状态：unspecified
- 类型：initial-summary
- 摘要：整理 维护者与 Codex 关于微信小程序工程 MCP 的完整优化脉络，并准备嵌入 Understand-Anything 启发的轻量项目理解能力。

### 主要变更
- 将 MCP 定位为本地小程序工程顾问，而不是模板库：主线是帮助小白把微信原生小程序从想法拆到上线。
- 优先遵守本机 AGENTS.md、使用者工作方式、本地知识库规则和私有自我进化规则。
- 此前已生成 MCP 包：<local-path>，并保持本地 stdio MCP、无外发、无密钥保存。
- 此前 MCP v0.2.0 已包含 10 个工具、7 个资源、3 个 prompt，覆盖项目扫描、蓝图、任务拆解、上线清单、文档索引、CloudBase MCP 指南、本地用户画像、技能路由、优化建议、本地知识库查询。
- 此前已将本地 Codex/Claude 文档抽象成 user-profile.json，将本地技能使用建议抽象成 skill-usage.json，并输出 local-codex-claude-audit.md。
- 本轮决定升级到 v0.3.0：加入追加式优化日志、日志读取/状态工具、日志资源，以及 Understand-Anything 启发的轻量项目地图和工程理解工具。
- 对 Understand-Anything 只吸收适合当前 MCP 的方法：项目地图、节点/边、代码路径解释、onboarding 路线、增量理解思路；不复制重型 dashboard、多模型流水线、Neo4j/向量化等依赖。
- 日志记录工程事实和可审计决策摘要，不记录隐藏推理、不记录密钥、不记录客户隐私原文。

### 文件与验证
- 此前新增或维护：data/user-profile.json、data/skill-usage.json、outputs/local-codex-claude-audit.md。
- 本轮计划修改：src/server.js、README.md、scripts/smoke-test.js、package.json。
- 本轮计划新增：data/understanding-templates.json、logs/README.md、logs/mcp-optimization-log.jsonl、logs/mcp-optimization-log.md。
- 此前 v0.2.0 冒烟测试通过：initialize true，toolCount 10，resourceCount 7，promptCount 3。
- 本轮 v0.3.0 完成后需要运行 node --check src/server.js、npm run smoke:test，并手动调用新增日志与理解工具。

### 安全边界
- 所有日志只保存在本地 MCP 包内部，不上传、不发布、不同步。
- 跳过 auth.json、history.jsonl、project.private.config.json、.env、*.pem、*.key、id_rsa、credentials、token、secret、password、cookie、backup json。
- 拒绝扫描 HOME、根目录、<local-config> 等高风险目录。
- 不把官方 CloudBase MCP 打包进本 MCP，不保存腾讯云密钥。
- 后续真实部署、上传、权限修改、外发、飞书写入仍需维护者 另行确认。
