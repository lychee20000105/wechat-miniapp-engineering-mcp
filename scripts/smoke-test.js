#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import readline from "node:readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const serverPath = path.join(root, "src", "server.js");
const fixtureProjectPath = process.env.SMOKE_PROJECT_PATH || path.join(root, "data", "fixtures", "demo-miniapp");

const child = spawn(process.execPath, [serverPath], {
  stdio: ["pipe", "pipe", "pipe"]
});

const responses = [];
const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
rl.on("line", (line) => {
  if (!line.trim()) return;
  responses.push(JSON.parse(line));
});

child.stderr.on("data", () => {});

function send(id, method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
}

send(1, "initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "smoke-test", version: "0.1.0" }
});
child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
send(2, "tools/list", {});
send(3, "tools/call", {
  name: "miniapp_inspect_project",
  arguments: { projectPath: fixtureProjectPath, includeReadme: false }
});
send(4, "resources/list", {});
send(5, "prompts/list", {});
send(6, "tools/call", {
  name: "local_mcp_optimization_log_status",
  arguments: {}
});
send(7, "tools/call", {
  name: "miniapp_understand_project_flow",
  arguments: { projectPath: fixtureProjectPath, goal: "客户成片展示小程序", limit: 200 }
});
send(8, "resources/read", {
  uri: "miniapp://audit/optimization-log/latest"
});
send(9, "resources/read", {
  uri: "miniapp://understand/project-map"
});
send(10, "tools/call", {
  name: "miniapp_relevant_context",
  arguments: { projectPath: fixtureProjectPath, query: "客户私密相册", limit: 220, budget: 3000, detail_level: "summary" }
});
send(11, "tools/call", {
  name: "miniapp_security_quick_scan",
  arguments: { projectPath: fixtureProjectPath, limit: 220, maxFindings: 40 }
});
send(12, "tools/call", {
  name: "miniapp_graph_stats",
  arguments: { projectPath: fixtureProjectPath, limit: 220 }
});
send(13, "tools/call", {
  name: "miniapp_dependency_diagram",
  arguments: { projectPath: fixtureProjectPath, target: "客户私密相册", limit: 220 }
});
send(14, "resources/read", {
  uri: "miniapp://audit/security-quick-scan"
});
send(15, "tools/call", {
  name: "miniapp_project_map",
  arguments: { projectPath: fixtureProjectPath, limit: 220, format: "json", detail_level: "full" }
});
send(16, "tools/call", {
  name: "miniapp_index_status",
  arguments: { projectPath: fixtureProjectPath, limit: 220 }
});
send(17, "tools/call", {
  name: "miniapp_understand_file_role",
  arguments: { projectPath: fixtureProjectPath, filePath: "miniprogram/pages/index/index.wxml" }
});
send(18, "tools/call", {
  name: "miniapp_understand_file_role",
  arguments: { projectPath: fixtureProjectPath, filePath: path.join(root, "package.json") }
});
send(19, "tools/call", {
  name: "yunyu_query_context",
  arguments: { query: "客户成片展示小程序" }
});
send(20, "tools/call", {
  name: "miniapp_showcase_roadmap",
  arguments: { brandName: "示例摄影工作室", depth: "mvp", phase: "all", audience: "beginner" }
});
send(21, "resources/read", {
  uri: "miniapp://roadmap/showcase"
});
send(22, "tools/call", {
  name: "miniapp_showcase_roadmap",
  arguments: { phase: "invalid-phase" }
});
send(23, "tools/call", {
  name: "miniapp_understand_file_role",
  arguments: { projectPath: fixtureProjectPath, extraField: true }
});
send(24, "tools/call", {
  name: "miniapp_dev_recovery_playbook",
  arguments: { topic: "devtools-eisdir" }
});
send(25, "tools/call", {
  name: "miniapp_cloudbase_release_preflight",
  arguments: { action: "full-release", cloudFunctionName: "mcloud", envId: "demo-env", version: "1.2" }
});
send(26, "resources/read", {
  uri: "miniapp://playbooks/dev-recovery"
});
send(27, "resources/read", {
  uri: "miniapp://checklists/cloudbase-release"
});

setTimeout(() => {
  child.kill("SIGTERM");
  const byId = new Map(responses.map((item) => [item.id, item]));
  const toolNames = byId.get(2)?.result?.tools?.map((tool) => tool.name) || [];
  const projectMapJsonText = byId.get(15)?.result?.content?.[0]?.text || "{}";
  let projectMapJson = {};
  try {
    projectMapJson = JSON.parse(projectMapJsonText);
  } catch {}
  const projectMapEdges = Array.isArray(projectMapJson.edges) ? projectMapJson.edges : [];
  const summary = {
    initialize: Boolean(byId.get(1)?.result?.serverInfo?.name),
    toolCount: byId.get(2)?.result?.tools?.length || 0,
    hasOptimizationLogTools: [
      "local_mcp_append_optimization_log",
      "local_mcp_read_optimization_log",
      "local_mcp_optimization_log_status"
    ].every((name) => toolNames.includes(name)),
    hasUnderstandTools: [
      "miniapp_project_map",
      "miniapp_understand_project_flow",
      "miniapp_understand_file_role",
      "miniapp_understand_feature_impact",
      "miniapp_relevant_context",
      "miniapp_dependency_diagram",
      "miniapp_graph_stats",
      "miniapp_index_status",
      "miniapp_security_quick_scan",
      "miniapp_showcase_roadmap",
      "miniapp_dev_recovery_playbook",
      "miniapp_cloudbase_release_preflight"
    ].every((name) => toolNames.includes(name)),
    inspectProjectReturnedText: Boolean(byId.get(3)?.result?.content?.[0]?.text?.includes("工程扫描")),
    logStatusReturnedText: Boolean(byId.get(6)?.result?.content?.[0]?.text?.includes("优化日志状态")),
    projectFlowReturnedText: Boolean(byId.get(7)?.result?.content?.[0]?.text?.includes("全流程理解")),
    latestLogResourceReturnedText: Boolean(byId.get(8)?.result?.contents?.[0]?.text?.includes("MCP 优化日志")),
    projectMapResourceReturnedText: Boolean(byId.get(9)?.result?.contents?.[0]?.text?.includes("小程序项目地图")),
    relevantContextReturnedText: Boolean(byId.get(10)?.result?.content?.[0]?.text?.includes("相关上下文")),
    securityScanReturnedText: Boolean(byId.get(11)?.result?.content?.[0]?.text?.includes("专项安全快扫")),
    graphStatsReturnedText: Boolean(byId.get(12)?.result?.content?.[0]?.text?.includes("图谱统计")),
    dependencyDiagramReturnedText: Boolean(byId.get(13)?.result?.content?.[0]?.text?.includes("Mermaid")),
    securityScanResourceReturnedText: Boolean(byId.get(14)?.result?.contents?.[0]?.text?.includes("专项安全快扫")),
    projectMapJsonHasComponentRelations: ["uses_component", "renders_component_tag", "imports_style", "navigates_to"].every((type) => projectMapEdges.some((edge) => edge.type === type)),
    indexStatusReadOnly: Boolean(byId.get(16)?.result?.content?.[0]?.text?.includes("本次是否写入缓存：否")),
    fileRoleShowsComponentTags: Boolean(byId.get(17)?.result?.content?.[0]?.text?.includes("WXML 自定义标签")),
    outsideFileRejected: Boolean(byId.get(18)?.error?.message?.includes("拒绝读取项目外文件")),
    yunyuRequiresConfirmation: Boolean(byId.get(19)?.result?.content?.[0]?.text?.includes("需要确认")),
    showcaseRoadmapReturnedText: Boolean(byId.get(20)?.result?.content?.[0]?.text?.includes("客户成片展示小程序路线图")),
    showcaseRoadmapResourceReturnedText: Boolean(byId.get(21)?.result?.contents?.[0]?.text?.includes("阶段 SOP")),
    invalidEnumRejected: byId.get(22)?.error?.code === -32602,
    missingRequiredRejected: byId.get(23)?.error?.code === -32602,
    devRecoveryReturnedText: Boolean(byId.get(24)?.result?.content?.[0]?.text?.includes("EISDIR")),
    releasePreflightReturnedText: Boolean(byId.get(25)?.result?.content?.[0]?.text?.includes("发布前预检")),
    devRecoveryResourceReturnedText: Boolean(byId.get(26)?.result?.contents?.[0]?.text?.includes("故障恢复手册")),
    releasePreflightResourceReturnedText: Boolean(byId.get(27)?.result?.contents?.[0]?.text?.includes("云函数预检")),
    resourceCount: byId.get(4)?.result?.resources?.length || 0,
    promptCount: byId.get(5)?.result?.prompts?.length || 0
  };
  console.log(JSON.stringify(summary, null, 2));
  if (
    !summary.initialize ||
    summary.toolCount < 25 ||
    summary.resourceCount < 20 ||
    !summary.hasOptimizationLogTools ||
    !summary.hasUnderstandTools ||
    !summary.inspectProjectReturnedText ||
    !summary.logStatusReturnedText ||
    !summary.projectFlowReturnedText ||
    !summary.latestLogResourceReturnedText ||
    !summary.projectMapResourceReturnedText ||
    !summary.relevantContextReturnedText ||
    !summary.securityScanReturnedText ||
    !summary.graphStatsReturnedText ||
    !summary.dependencyDiagramReturnedText ||
    !summary.securityScanResourceReturnedText ||
    !summary.projectMapJsonHasComponentRelations ||
    !summary.indexStatusReadOnly ||
    !summary.fileRoleShowsComponentTags ||
    !summary.outsideFileRejected ||
    !summary.yunyuRequiresConfirmation ||
    !summary.showcaseRoadmapReturnedText ||
    !summary.showcaseRoadmapResourceReturnedText ||
    !summary.invalidEnumRejected ||
    !summary.missingRequiredRejected ||
    !summary.devRecoveryReturnedText ||
    !summary.releasePreflightReturnedText ||
    !summary.devRecoveryResourceReturnedText ||
    !summary.releasePreflightResourceReturnedText
  ) {
    process.exitCode = 1;
  }
}, 3000);
