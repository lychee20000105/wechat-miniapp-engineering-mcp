# MCP 优化日志说明

本目录内置在 `wechat-miniapp-engineering-mcp` 包中，用于记录 MCP 后续升级、优化、技能嵌入、配置修改和验证结果。

公开发布时，原始日志文件默认不提交到 GitHub。需要公开说明时，运行 `npm run changelog:sync` 生成脱敏版 `CHANGELOG.md`，并同步 README 最近更新摘要。

## 文件

- `mcp-optimization-log.jsonl`：机器可读的追加日志，一行一条记录。
- `mcp-optimization-log.md`：人可读的详细日志。

## 强制记录规则

- 每一轮 MCP 优化、升级、技能嵌入、配置修改、审查、验证后，都必须追加日志。
- 记录内容包括用户提供的思路、Codex 工程决策摘要、outcome、引用/参考的 skill、子 agent 汇总、文件改动、验证结果、安全边界和下一步。
- MCP 无法自动读取外部聊天窗口的完整上下文；后续需要在优化完成时显式调用 `local_mcp_append_optimization_log` 或由维护者手动追加。

## 禁止记录

- 不记录隐藏推理或不可公开的链路。
- 不记录密钥、token、密码、AppSecret、私钥、Cookie。
- 不记录客户隐私原文、真实手机号、真实订单码、真实云存储 fileID。
- 原始日志不上传、不同步、不公开发布；公开项目只同步脱敏后的 `CHANGELOG.md`。
