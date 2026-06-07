#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const LOG_JSONL = path.join(ROOT, "logs", "mcp-optimization-log.jsonl");
const CHANGELOG = path.join(ROOT, "CHANGELOG.md");
const README = path.join(ROOT, "README.md");
const CREATION_GUIDE = path.join(ROOT, "docs", "mcp-creation-guide.md");
const START_MARKER = "<!-- changelog-summary:start -->";
const END_MARKER = "<!-- changelog-summary:end -->";

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

function sanitize(value) {
  return String(value || "")
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[REDACTED_KEY]")
    .replace(/AKID[A-Za-z0-9_-]{8,}/g, "[REDACTED_SECRET_ID]")
    .replace(/[A-Za-z0-9_/-]{20,}\.[A-Za-z0-9_/-]{20,}\.[A-Za-z0-9_/-]{10,}/g, "[REDACTED_TOKEN]")
    .replace(/1[3-9]\d{9}/g, "[REDACTED_MOBILE]")
    .replace(/cloud:\/\/[A-Za-z0-9._/-]+/g, "[REDACTED_CLOUD_FILE]")
    .replace(/\/Users\/[^\s`"'，。；；),]+/g, "<local-path>")
    .replace(/\/Volumes\/[^\s`"'，。；；),]+/g, "<external-volume>")
    .replace(/~\/\.[A-Za-z0-9_-]+[^\s`"'，。；；),]*/g, "<local-config>")
    .replace(/云屿知识库/g, "本地知识库")
    .replace(/云屿摄影/g, "示例摄影工作室")
    .replace(/云屿/g, "本地业务")
    .replace(/小李/g, "使用者")
    .replace(/\blychee\b/gi, "维护者")
    .replace(/维护者\s+与/g, "维护者与")
    .replace(/方便\s+维护者/g, "方便维护者")
    .replace(/仍需\s+维护者/g, "仍需维护者")
    .trim();
}

function parseEntries() {
  const lines = readText(LOG_JSONL).split("\n").filter(Boolean);
  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      entries.push({
        timestamp: "unknown",
        mcpVersion: "unknown",
        summary: "日志行解析失败，已跳过详情。"
      });
    }
  }
  return entries;
}

function dateOnly(timestamp) {
  if (!timestamp || timestamp === "unknown") return "unknown";
  return String(timestamp).slice(0, 10);
}

function list(items, limit = 6) {
  const values = Array.isArray(items) ? items : [];
  if (!values.length) return "- 暂无";
  return values.slice(0, limit).map((item) => `- ${sanitize(item)}`).join("\n");
}

function renderChangelog(entries) {
  const sorted = [...entries].reverse();
  const body = sorted.map((entry) => {
    const version = sanitize(entry.mcpVersion || "unknown");
    const title = sanitize(entry.summary || "更新记录");
    const outcome = sanitize(entry.outcome || "unspecified");
    const date = dateOnly(entry.timestamp);
    return [
      `## ${date} - v${version}`,
      "",
      `- 状态：${outcome}`,
      `- 类型：${sanitize(entry.roundType || "optimization")}`,
      `- 摘要：${title}`,
      "",
      "### 主要变更",
      list(entry.codexDecisions || entry.filesChanged || [], 8),
      "",
      "### 文件与验证",
      list([...(entry.filesChanged || []).slice(0, 5), ...(entry.verification || []).slice(0, 5)], 10),
      "",
      "### 安全边界",
      list(entry.safetyNotes || [], 6)
    ].join("\n");
  }).join("\n\n");

  return [
    "# 更新日志",
    "",
    "本文件由 `npm run changelog:sync` 从内部 MCP 优化日志生成，面向 GitHub 公开说明使用。",
    "",
    "同步时会脱敏本机路径、手机号、密钥形态、真实云存储路径和本地业务知识库描述；原始内部日志默认不提交到 GitHub。",
    "",
    body || "暂无公开更新记录。"
  ].join("\n");
}

function renderReadmeSummary(entries) {
  const latest = [...entries].slice(-5).reverse();
  if (!latest.length) return `${START_MARKER}\n暂无公开更新记录。\n${END_MARKER}`;
  const lines = [
    START_MARKER,
    "### 最近更新",
    "",
    ...latest.map((entry) => {
      const version = sanitize(entry.mcpVersion || "unknown");
      const date = dateOnly(entry.timestamp);
      const summary = sanitize(entry.summary || "更新记录");
      return `- ${date} ` + "`" + `v${version}` + "`" + `：${summary}`;
    }),
    END_MARKER
  ];
  return lines.join("\n");
}

function updateReadme(entries) {
  const readme = readText(README);
  if (!readme) return;
  const replacement = renderReadmeSummary(entries);
  const start = readme.indexOf(START_MARKER);
  const end = readme.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    writeText(README, `${readme.trimEnd()}\n\n${replacement}\n`);
    return;
  }
  const before = readme.slice(0, start);
  const after = readme.slice(end + END_MARKER.length);
  writeText(README, `${before}${replacement}${after}`);
}

function compactList(items, limit = 5) {
  const values = Array.isArray(items) ? items : [];
  if (!values.length) return "- 这一轮主要是整理和验证，没有额外公开细节。";
  return values.slice(0, limit).map((item) => `- ${sanitize(item)}`).join("\n");
}

function renderGuideChapter(entry, index) {
  const version = sanitize(entry.mcpVersion || "unknown");
  const date = dateOnly(entry.timestamp);
  const title = sanitize(entry.summary || "更新记录");
  const decisions = entry.codexDecisions || [];
  const files = entry.filesChanged || [];
  const verification = entry.verification || [];
  return [
    `## 第 ${index + 1} 站：${date}，v${version}`,
    "",
    `这一站做的事：${title}`,
    "",
    "### 小白怎么理解",
    compactList(decisions, 4),
    "",
    "### 实际动了哪些地方",
    compactList(files, 5),
    "",
    "### 怎么确认没有跑偏",
    compactList(verification, 4)
  ].join("\n");
}

function renderCreationGuide(entries) {
  const chronological = [...entries];
  const latest = chronological.at(-1);
  const latestVersion = sanitize(latest?.mcpVersion || "unknown");
  const chapters = chronological.map(renderGuideChapter).join("\n\n");
  return [
    "# MCP 详细创建说明书",
    "",
    "这是一份给小白看的创建说明书。它不是冷冰冰的流水账，而是把这个 MCP 从 0 到现在怎么长出来，拆成一站一站的小积木。",
    "",
    `当前公开版：v${latestVersion}`,
    "",
    "## 先说人话：这个 MCP 是干什么的",
    "",
    "它是一个本地运行的微信小程序工程顾问。你可以把它理解成一个会拆任务的开发搭子：你说想做一个小程序，它帮你把页面、数据、云函数、权限、测试、上线检查都摆出来。",
    "",
    "它不负责偷偷部署，也不负责保存任何密钥。它的重点是让刚入门的人先看懂、再动手、最后能检查。",
    "",
    "## 创建思路",
    "",
    "- 第一层：先定方向。它不是模板库，而是工程顾问。",
    "- 第二层：先能讲清楚。让小白知道页面、云函数、数据库、CloudBase 各自负责什么。",
    "- 第三层：再能看项目。扫描 demo 小程序，画项目地图，解释文件角色。",
    "- 第四层：补安全边界。客户素材、手机号、订单号、fileID、密钥都不能乱进日志。",
    "- 第五层：加更新机制。内部日志保留细节，公开文档只同步脱敏后的说明。",
    "",
    "## 创建路线",
    "",
    chapters || "暂无创建记录。",
    "",
    "## 以后怎么更新这份说明书",
    "",
    "每次 MCP 有升级、优化、修 bug、补文档，先把内部优化日志追加好，然后运行：",
    "",
    "```bash",
    "npm run changelog:sync",
    "```",
    "",
    "这条命令会一起更新三样东西：",
    "",
    "- `CHANGELOG.md`：公开更新日志。",
    "- `README.md`：最近更新摘要。",
    "- `docs/mcp-creation-guide.md`：这份小白友好的详细创建说明书。",
    "",
    "## 安全提醒",
    "",
    "这份说明书来自内部日志，但生成时会脱敏。本机路径、手机号、密钥形态、真实云存储路径、本地业务名称都会被替换或泛化。公开仓库里不应该出现真实客户资料、token、AppSecret、订单号或真实 fileID。"
  ].join("\n");
}

const entries = parseEntries();
writeText(CHANGELOG, renderChangelog(entries));
writeText(CREATION_GUIDE, renderCreationGuide(entries));
updateReadme(entries);

console.log(JSON.stringify({
  ok: true,
  entries: entries.length,
  changelog: path.relative(ROOT, CHANGELOG),
  creationGuide: path.relative(ROOT, CREATION_GUIDE),
  readme: path.relative(ROOT, README)
}, null, 2));
