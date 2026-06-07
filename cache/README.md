# MCP 本地索引缓存

本目录用于保存 CodeGraph 启发的轻量索引缓存。

默认情况下，MCP 仍只读扫描项目；只有调用 `miniapp_index_status` 并传入 `writeCache: true` 时，才会写入：

- `miniapp-graph-index.json`
- `miniapp-file-hashes.json`

`0.4.1` 起，新写入的缓存只保存：

- 安全文本文件相对路径
- 文件 SHA-256 hash
- 节点/边摘要和统计信息
- 项目根目录 hash 与项目目录名

缓存不保存项目绝对路径、源码全文、密钥、token、客户隐私原文或敏感文件内容。
