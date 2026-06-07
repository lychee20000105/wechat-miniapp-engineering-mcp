# 面向中国友好的微信小程序开发 MCP

一个中文优先、本地运行的微信小程序工程顾问 MCP，立志让每个小白都可以轻松上手。

它不是页面模板库，也不是自动部署器。它更像一个工程教练：把一个微信小程序从想法拆成需求、页面、数据、云函数、CloudBase、安全、测试、上线和后续优化。

## 项目状态

- 当前版本：`0.5.2`
- 运行方式：本地 stdio MCP server
- 目标用户：中国微信小程序开发者、AI IDE 用户、刚开始做小程序的产品/运营/个体商家
- 默认示例：包内 synthetic 微信小程序 fixture，不包含真实客户资料、真实 AppID、真实云存储 fileID 或密钥
- 安全边界：默认不联网、不部署、不写真实 CloudBase/Tencent 环境、不保存密钥

## 核心能力

- 扫描本地微信原生/云开发小程序工程，解释页面、tabBar、云函数、业务模块和下一步建议。
- 生成微信小程序工程蓝图：产品定位、页面、数据集合、云函数、UI、测试和上线。
- 输出“客户成片展示小程序”小白路线图：业务定位、MVP 边界、阶段 SOP、页面、数据、CloudBase、隐私和上线清单。
- 把功能拆成需求、UI、前端、后端、测试、上线任务。
- 生成小程序上线检查清单，重点覆盖隐私、云存储、数据库规则和审核材料。
- 生成轻量项目地图、文件角色解释、功能影响分析、相关上下文和 Mermaid 依赖图。
- 做小程序专项安全快扫，只输出路径、行号、规则和修复方向，不输出原始敏感匹配文本。
- 维护 MCP 优化日志，并可同步生成脱敏公开版 `CHANGELOG.md` 和小白友好版创建说明书。

## 快速开始

要求 Node.js `>=18`。

```bash
git clone https://github.com/lychee20000105/wechat-miniapp-engineering-mcp.git
cd wechat-miniapp-engineering-mcp
npm run smoke:test
```

启动本地 MCP server：

```bash
npm run start
```

这个 server 使用 stdio MCP。通常不需要手动长期运行，MCP 客户端会按配置自动启动。

## MCP 客户端配置

把下面配置加到支持 MCP 的客户端里，并把 `/absolute/path/to/wechat-miniapp-engineering-mcp` 替换成你的本地项目绝对路径。

```json
{
  "mcpServers": {
    "wechat-miniapp-engineering": {
      "command": "node",
      "args": [
        "/absolute/path/to/wechat-miniapp-engineering-mcp/src/server.js"
      ]
    }
  }
}
```

如果你要让 AI 同时管理真实 CloudBase 环境，可以另外配置官方 CloudBase MCP。本项目只负责工程规划、项目理解和上线检查，不直接替代官方部署工具。

## 常用工具

| 工具 | 用途 |
| --- | --- |
| `miniapp_inspect_project` | 扫描本地小程序工程，解释页面、云函数和业务模块 |
| `miniapp_generate_blueprint` | 生成小程序产品到工程的完整蓝图 |
| `miniapp_showcase_roadmap` | 生成客户成片展示小程序的小白路线图 |
| `miniapp_work_breakdown` | 把功能拆成需求、UI、前端、后端、测试、上线任务 |
| `miniapp_launch_checklist` | 生成上线前检查清单 |
| `miniapp_project_map` | 输出页面、云函数、集合、组件和依赖边 |
| `miniapp_understand_file_role` | 解释某个文件的角色、上下游和下一步 |
| `miniapp_understand_feature_impact` | 分析一个功能影响哪些页面、接口、数据和上线风险 |
| `miniapp_relevant_context` | 按 Core/Near/Extended/Background 收集相关上下文 |
| `miniapp_dependency_diagram` | 生成 Mermaid 依赖图 |
| `miniapp_security_quick_scan` | 做小程序专项安全快扫 |
| `miniapp_index_status` | 计算安全文本文件 hash，默认只读 |
| `local_mcp_append_optimization_log` | 追加本地 MCP 优化日志 |
| `local_mcp_read_optimization_log` | 读取最近的 MCP 优化日志 |
| `local_mcp_optimization_log_status` | 查看日志路径、记录数和最新摘要 |

## 资源与提示词

内置资源包括：

- `miniapp://docs/index`
- `miniapp://project/current`
- `miniapp://checklists/launch`
- `miniapp://roadmap/showcase`
- `miniapp://cloudbase/mcp-guide`
- `miniapp://audit/optimization-log`
- `miniapp://audit/optimization-log/latest`
- `miniapp://understand/project-map`
- `miniapp://understand/project-flow`
- `miniapp://understand/relevant-context`
- `miniapp://understand/dependency-diagram`
- `miniapp://audit/security-quick-scan`
- `miniapp://understand/index-status`

内置提示词包括：

- `miniapp_product_manager`
- `miniapp_engineering_reviewer`
- `miniapp_xiaoli_engineering_planner`

## 冒烟测试

```bash
npm run smoke:test
```

通过时会看到类似：

```json
{
  "initialize": true,
  "toolCount": 23,
  "resourceCount": 18,
  "promptCount": 3,
  "showcaseRoadmapReturnedText": true,
  "invalidEnumRejected": true,
  "missingRequiredRejected": true
}
```

默认 smoke test 使用包内 synthetic fixture：

```text
data/fixtures/demo-miniapp
```

如需验证其他本地小程序项目，可以临时设置：

```bash
SMOKE_PROJECT_PATH=/absolute/path/to/your-miniapp npm run smoke:test
```

真实项目扫描前，请先确认隐私范围，不要把真实密钥、客户素材、手机号、订单号或云存储 fileID 写进日志。

## 更新日志同步

项目维护时，内部优化日志会追加到：

```text
logs/mcp-optimization-log.jsonl
logs/mcp-optimization-log.md
```

这两份原始日志默认不提交到 GitHub。公开项目说明使用脱敏后的 `CHANGELOG.md`，同时同步 README 最近更新摘要和 [MCP 详细创建说明书](docs/mcp-creation-guide.md)：

```bash
npm run changelog:sync
```

同步规则：

- 从内部 JSONL 日志提取版本、摘要、变更文件、验证结果和安全边界。
- 自动脱敏本机路径、手机号、密钥形态、真实云存储路径和本地知识库描述。
- 不同步隐藏推理、客户原文、密钥、token、订单号、手机号或真实 fileID。
- 后续每次追加内部优化日志后，先运行 `npm run changelog:sync`，再提交 README、`CHANGELOG.md` 和 `docs/mcp-creation-guide.md`。

<!-- changelog-summary:start -->
### 最近更新

- 2026-06-07 `v0.5.2`：完成 v0.5.2 文档同步升级：新增小白友好版 MCP 详细创建说明书，并纳入 changelog:sync 自动更新流程。
- 2026-06-07 `v0.5.1`：完成 v0.5.1 开源准备：整理中文 GitHub README、MIT 许可证、公开脱敏 CHANGELOG 同步机制、通用默认配置和发布前安全忽略规则。
- 2026-06-07 `v0.5.0`：完成 v0.5.0 优化：新增客户成片展示小程序路线图工具与资源，并加入轻量参数校验和 JSON-RPC 错误码分类。
- 2026-06-07 `v0.4.1`：完成 v0.4.1 小步可验证优化：强化 realpath 路径安全、包内 synthetic fixture 验证、WXML/WXSS/JSON 组件关系识别、上线安全快扫规则和日志 outcome 字段。
- 2026-06-07 `v0.4.0`：完成 v0.4.0 融合升级：把 CodeGraph 评估中最适合微信小程序工程 MCP 的轻量图谱、上下文、依赖图、增量索引和安全快扫能力嵌入本地 MCP。
<!-- changelog-summary:end -->

完整公开更新日志见 [CHANGELOG.md](CHANGELOG.md)。

## 安全边界

- 不保存 AppSecret、腾讯云 SecretKey、后台密码、Webhook、token、Cookie 或私钥。
- 默认只读扫描项目；`miniapp_index_status` 只有传 `writeCache: true` 时才写入本项目 `cache/`。
- 项目理解工具只读取安全文本文件，跳过 `.env`、密钥、token、历史记录、私密配置、备份 JSON 和高风险目录。
- 路径解析使用 realpath 校验并跳过软链接，防止 `..`、绝对路径或软链接逃逸到项目外。
- 安全快扫不输出原始敏感匹配文本，只输出路径、行号、规则、严重级别和修复方向。
- 真实云开发环境操作建议另配官方 CloudBase MCP，并在上传、改权限、改正式数据前人工确认。

## 开发脚本

```bash
npm run start
npm run smoke:test
npm run changelog:sync
```

语法检查：

```bash
node --check src/server.js
node --check scripts/smoke-test.js
node --check scripts/sync-public-changelog.js
```

## 许可证

MIT
