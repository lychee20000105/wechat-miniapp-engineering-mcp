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

const entries = parseEntries();
writeText(CHANGELOG, renderChangelog(entries));
updateReadme(entries);

console.log(JSON.stringify({
  ok: true,
  entries: entries.length,
  changelog: path.relative(ROOT, CHANGELOG),
  readme: path.relative(ROOT, README)
}, null, 2));
