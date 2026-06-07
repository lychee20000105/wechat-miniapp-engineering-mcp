#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SERVER_INFO = {
  name: "wechat-miniapp-engineering-mcp",
  version: "0.5.1"
};
const LOG_DIR = path.join(ROOT, "logs");
const LOG_JSONL = path.join(LOG_DIR, "mcp-optimization-log.jsonl");
const LOG_MD = path.join(LOG_DIR, "mcp-optimization-log.md");
const CACHE_DIR = path.join(ROOT, "cache");
const GRAPH_CACHE = path.join(CACHE_DIR, "miniapp-graph-index.json");
const HASH_CACHE = path.join(CACHE_DIR, "miniapp-file-hashes.json");

const SENSITIVE_FILE_PATTERNS = [
  /^auth\.json$/i,
  /^history\.jsonl$/i,
  /^project\.private\.config\.json$/i,
  /^\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /^id_rsa/i,
  /credentials/i,
  /token/i,
  /secret/i,
  /password/i,
  /cookie/i,
  /backup.*\.json$/i
];
const SKIP_DIRS = new Set(["node_modules", ".git", ".codegraph", "miniprogram_npm", ".understand-anything", "dist", "build", "coverage"]);
const SAFE_TEXT_EXTENSIONS = new Set([
  ".js", ".json", ".wxml", ".wxss", ".md", ".txt", ".ts", ".tsx", ".jsx", ".css", ".html", ".yml", ".yaml"
]);
const MAX_SAFE_TEXT_FILE_SIZE = 600_000;
const NATIVE_WXML_TAGS = new Set([
  "view", "scroll-view", "swiper", "swiper-item", "movable-area", "movable-view", "cover-view", "cover-image",
  "icon", "text", "rich-text", "progress", "button", "checkbox", "checkbox-group", "form", "input", "label",
  "picker", "picker-view", "picker-view-column", "radio", "radio-group", "slider", "switch", "textarea",
  "navigator", "functional-page-navigator", "audio", "image", "video", "camera", "live-player", "live-pusher",
  "map", "canvas", "web-view", "ad", "official-account", "open-data", "block", "template", "slot"
]);

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function readText(filePath, maxChars = 12000) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n...[truncated]` : text;
  } catch {
    return "";
  }
}

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function resolveConfigPath(filePath) {
  if (!filePath) return "";
  return path.isAbsolute(filePath) ? filePath : path.resolve(ROOT, filePath);
}

function listDirectories(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function safeLstat(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch {
    return null;
  }
}

function safeRealpath(filePath) {
  try {
    return fs.realpathSync.native ? fs.realpathSync.native(filePath) : fs.realpathSync(filePath);
  } catch {
    return "";
  }
}

function isPathInside(childPath, parentPath) {
  const rel = path.relative(parentPath, childPath);
  return rel === "" || Boolean(rel && !rel.startsWith("..") && !path.isAbsolute(rel));
}

function deniedRoots() {
  const home = process.env.HOME;
  const roots = [path.resolve("/")];
  if (home) {
    roots.push(
      path.resolve(home),
      path.resolve(home, ".codex"),
      path.resolve(home, ".claude"),
      path.resolve(home, ".ssh"),
      path.resolve(home, "Library")
    );
  }
  return roots;
}

function isDeniedResolvedPath(resolvedPath) {
  const normalized = path.resolve(resolvedPath);
  for (const denied of deniedRoots()) {
    if (denied === path.resolve("/")) {
      if (normalized === denied) return true;
      continue;
    }
    if (process.env.HOME && denied === path.resolve(process.env.HOME)) {
      if (normalized === denied) return true;
      continue;
    }
    if (normalized === denied || isPathInside(normalized, denied)) return true;
  }
  return isSensitivePath(normalized);
}

function listFilesRecursive(dirPath, predicate, limit = 200) {
  const results = [];
  const rootReal = safeRealpath(dirPath);
  if (!rootReal || isDeniedResolvedPath(rootReal)) return results;
  function walk(current) {
    if (results.length >= limit) return;
    const currentLstat = safeLstat(current);
    if (!currentLstat || currentLstat.isSymbolicLink()) return;
    const currentReal = safeRealpath(current);
    if (!currentReal || !isPathInside(currentReal, rootReal) || isDeniedResolvedPath(currentReal)) return;
    let entries = [];
    try {
      entries = fs.readdirSync(currentReal, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= limit) return;
      const full = path.join(currentReal, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !isSensitiveName(entry.name)) walk(full);
      } else if (predicate(full)) {
        const fileReal = safeRealpath(full);
        if (fileReal && isPathInside(fileReal, rootReal) && !isDeniedResolvedPath(fileReal)) results.push(fileReal);
      }
    }
  }
  walk(rootReal);
  return results;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isSensitiveName(name) {
  return SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

function isSensitivePath(filePath) {
  const parts = filePath.split(path.sep).filter(Boolean);
  if (parts.some((part) => isSensitiveName(part))) return true;
  return parts.includes(".ssh") || parts.includes(".gnupg") || parts.includes("Keychains");
}

function isSafeTextFile(filePath) {
  if (isSensitivePath(filePath)) return false;
  return SAFE_TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function resolveProjectRoot(projectPath) {
  const requested = projectPath
    ? path.resolve(projectPath)
    : resolveConfigPath(config.currentProjectPath) || process.cwd();
  const resolved = path.resolve(requested);
  const real = safeRealpath(resolved);
  const stat = real ? safeStat(real) : null;
  if (!stat || !stat.isDirectory()) throw new Error("项目目录不存在或不可访问。");
  if (isDeniedResolvedPath(real)) throw new Error("拒绝扫描高风险或敏感目录。");
  return real;
}

function summarizeArgs(args = {}) {
  const allowed = ["projectPath", "productName", "brandName", "depth", "phase", "topic", "target", "featureName", "filePath", "focus", "format", "limit", "roundType", "detail_level", "budget", "writeCache"];
  const summary = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(args, key)) summary[key] = redactSensitive(String(args[key]));
  }
  if (args.query) summary.queryPreview = redactSensitive(String(args.query).slice(0, 80));
  if (args.goal) summary.goalPreview = redactSensitive(String(args.goal).slice(0, 120));
  if (args.summary) summary.summaryPreview = redactSensitive(String(args.summary).slice(0, 160));
  return summary;
}

function redactSensitive(text) {
  return String(text)
    .replace(/(sk-[A-Za-z0-9_-]{12,})/g, "[REDACTED_KEY]")
    .replace(/(AKID[A-Za-z0-9_-]{8,})/g, "[REDACTED_SECRET_ID]")
    .replace(/([A-Za-z0-9_/-]{20,}\.[A-Za-z0-9_/-]{20,}\.[A-Za-z0-9_/-]{10,})/g, "[REDACTED_TOKEN]")
    .replace(/1[3-9]\d{9}/g, "[REDACTED_MOBILE]")
    .replace(/cloud:\/\/[A-Za-z0-9._/-]+/g, "[REDACTED_CLOUD_FILE]");
}

function nowIso() {
  return new Date().toISOString();
}

function markdownListFromObjects(items, formatter) {
  if (!items || items.length === 0) return "- 暂无";
  return items.map(formatter).join("\n");
}

function contentHash(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex");
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 2.2);
}

function truncateByChars(text, maxChars) {
  const value = String(text || "");
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 18))}\n...[truncated]`;
}

function parseDetailLevel(value) {
  const level = String(value || "standard").toLowerCase();
  return ["summary", "standard", "full"].includes(level) ? level : "standard";
}

function uniqueStrings(items, limit = 100) {
  return [...new Set((items || []).filter(Boolean).map(String))].slice(0, limit);
}

function stripCodeFenceSensitive(text) {
  return redactSensitive(String(text || "").replace(/[A-Za-z0-9+/=]{80,}/g, "[REDACTED_LONG_VALUE]"));
}

const DEFAULT_USER_PROFILE = {
  communicationPreferences: [
    "默认中文沟通",
    "先给结论，再拆执行步骤",
    "面向小白时要解释清楚页面、数据、接口、测试和上线"
  ],
  deliveryPreferences: [
    "优先输出可执行清单、SOP、表格和阶段路线图",
    "复杂工程按需求、UI、前端、后端、测试、上线拆分"
  ],
  safetyRules: [
    "不保存密钥、密码、token、AppSecret、私钥或 Cookie",
    "外发、上传、部署、改权限和写正式数据前必须人工确认"
  ],
  knowledgeWorkflow: [
    "需要本地业务知识时先确认读取范围",
    "默认不读取目标项目外的资料"
  ],
  codingHabits: [
    "优先沿用微信原生小程序 + 云开发路线",
    "后端按 route -> controller -> service -> model 分层",
    "客户私密资源要设计访问凭证、有效期、撤销和访问日志"
  ],
  miniProgramArchitectureRules: [
    "前端新增页面要同步考虑 app.json、JS/WXML/WXSS/JSON、空状态和异常态",
    "后端新增能力要同步考虑路由、控制器、业务层、数据层、权限和日志",
    "公开展示和私密交付要分集合、分接口、分权限"
  ],
  preferredAnswerShape: ["先结论", "再给推荐路线", "再拆执行清单", "最后列风险和下一步"]
};

const DEFAULT_SKILL_USAGE = {
  installedSkillGroups: [],
  claudePluginHints: [],
  recommendedForMiniProgram: ["官方文档检索", "浏览器验证", "安全审查", "文档交付"],
  avoidByDefaultForMiniProgram: [
    "不要默认引入 Taro/uni-app/React/Vue 跨端框架",
    "不要默认用大型后端管理系统替换微信云开发架构"
  ]
};

const config = readJson(path.join(ROOT, "config", "defaults.json"), {});
const docs = readJson(path.join(ROOT, "data", "docs.json"), { official: [], github: [] });
const userProfile = readJson(path.join(ROOT, "data", "user-profile.json"), DEFAULT_USER_PROFILE);
const skillUsage = readJson(path.join(ROOT, "data", "skill-usage.json"), DEFAULT_SKILL_USAGE);
const understandingTemplates = readJson(path.join(ROOT, "data", "understanding-templates.json"), {
  stages: [],
  miniappDomainDictionary: [],
  nodeTypeHints: {},
  edgeTypeHints: {}
});

function toMarkdownList(items) {
  if (!items || items.length === 0) return "- 暂无";
  return items.map((item) => `- ${item}`).join("\n");
}

function renderWorkingPrinciples() {
  const prefs = [
    ...(userProfile.communicationPreferences || []).slice(0, 4),
    ...(userProfile.deliveryPreferences || []).slice(0, 3),
    ...(userProfile.knowledgeWorkflow || []).slice(0, 3)
  ];
  return toMarkdownList(prefs);
}

function renderArchitectureRules() {
  return toMarkdownList(userProfile.miniProgramArchitectureRules || []);
}

function inspectProject(args = {}) {
  const projectPath = resolveProjectRoot(args.projectPath);
  const projectConfigPath = path.join(projectPath, "project.config.json");
  const projectConfig = readJson(projectConfigPath, {});
  const miniprogramRoot = projectConfig.miniprogramRoot || projectConfig.srcMiniprogramRoot || "miniprogram/";
  const cloudRoot = projectConfig.cloudfunctionRoot || "cloudfunctions/";
  const appJsonPath = path.join(projectPath, miniprogramRoot, "app.json");
  const appJson = readJson(appJsonPath, {});
  const cloudFunctions = listDirectories(path.join(projectPath, cloudRoot));
  const pages = Array.isArray(appJson.pages) ? appJson.pages : [];
  const tabBar = appJson.tabBar?.list || [];
  const pageFiles = listFilesRecursive(
    path.join(projectPath, miniprogramRoot),
    (file) => /\.(wxml|js|wxss|json)$/.test(file),
    800
  );
  const readme = args.includeReadme === false ? "" : readText(path.join(projectPath, "README.md"), 5000);
  const inferredModules = [];
  const pageText = pages.join("\n");
  if (/work\/calendar|档期/.test(pageText + readme)) inferredModules.push("内部档期/订单协同");
  if (/performance|业绩|commission|提成|payroll|工资/.test(pageText + readme)) inferredModules.push("业绩/提成/工资结算");
  if (/album|样片|作品/.test(pageText + readme)) inferredModules.push("样片/作品展示");
  if (/product|服务|套餐/.test(pageText + readme)) inferredModules.push("拍摄服务/套餐内容");
  if (/admin|后台|管理/.test(pageText + readme)) inferredModules.push("后台管理");

  return [
    `# ${config.projectLabel || "微信小程序项目"}工程扫描`,
    "",
    `- 项目路径：\`${projectPath}\``,
    `- 小程序根目录：\`${miniprogramRoot}\``,
    `- 云函数目录：\`${cloudRoot}\``,
    `- AppID：\`${projectConfig.appid || "未读取到"}\``,
    `- 基础库版本：\`${projectConfig.libVersion || "未读取到"}\``,
    `- 页面数量：${pages.length}`,
    `- 本地代码文件数：${pageFiles.length}`,
    `- 云函数：${cloudFunctions.length ? cloudFunctions.join(", ") : "未发现"}`,
    "",
    "## 底部导航",
    toMarkdownList(tabBar.map((item) => `${item.text || "未命名"} -> \`${item.pagePath || ""}\``)),
    "",
    "## 推断出的业务模块",
    toMarkdownList(inferredModules),
    "",
    "## 对当前工程的建议",
    "- 继续保持微信原生 + 云开发路线，不建议为了客户成片展示功能整体迁移框架。",
    "- 内部经营能力和客户展示能力建议拆成两个入口：内部入口关注档期、订单、业绩、工资；客户入口关注品牌、作品、套餐、预约、私密交付。",
    "- 现有 `album`、`product` 模块可以作为客户展示小程序的数据和页面参考，但不要直接暴露内部 `work`、`admin`、`payroll` 链路。",
    "- 成片展示涉及云存储和客户隐私，必须单独设计访问权限、订单码/手机号校验、分享有效期和后台操作日志。",
    readme ? "\n## README 摘要\n" + readme : ""
  ].join("\n");
}

function generateBlueprint(args = {}) {
  const productName = args.productName || config.defaultScenario || "客户成片展示小程序";
  const brandName = args.brandName || "示例摄影工作室";
  const depth = args.depth || "mvp";
  const linkExisting = args.linkExistingProject !== false;
  return [
    `# ${productName}工程蓝图`,
    "",
    `- 品牌：${brandName}`,
    `- 版本范围：${depth === "full" ? "完整产品版" : "MVP 首版"}`,
    `- 是否对接现有档期项目：${linkExisting ? "建议轻量对接订单/客户信息" : "先独立运行"}`,
    "",
    "## 0. 按本地工作方式执行",
    renderWorkingPrinciples(),
    "",
    "## 1. 产品定位",
    "- 面向客户的作品展示、套餐了解、预约咨询和成片交付入口。",
    "- 内部档期/业绩/工资系统继续作为经营后台，不直接暴露给客户。",
    "- 客户展示小程序只拿必要数据：公开作品、公开套餐、预约线索、客户私密相册访问状态。",
    "",
    "## 2. 角色和权限",
    "- 游客：看公开作品、套餐、品牌介绍，提交咨询预约。",
    "- 客户：通过手机号、订单码或专属链接查看自己的私密成片。",
    "- 员工：可上传/整理与自己订单相关的交付素材，不能看财务数据。",
    "- 管理员：管理作品、套餐、客户相册、访问权限、预约线索和下架记录。",
    "",
    "## 3. 页面地图",
    "- 首页：首页封面、近期成片、拍摄分类、热门套餐、咨询入口。",
    "- 作品分类：生日宴、百日宴、婚礼、乔迁、写真、商拍等分类筛选。",
    "- 作品详情：封面视频/图片、精选图集、拍摄说明、套餐引导、咨询按钮。",
    "- 套餐详情：服务内容、交付周期、可选加项、注意事项、预约入口。",
    "- 预约咨询：称呼、电话、日期、拍摄类型、预算、备注、来源。",
    "- 我的成片：手机号/订单码验证，展示客户私密相册列表。",
    "- 私密相册详情：精修图、视频、下载说明、分享有效期、客户反馈。",
    "- 管理后台：作品、套餐、客户相册、预约线索、访问日志。",
    "",
    "## 4. 数据集合建议",
    "- `showcase_category`：作品分类。",
    "- `showcase_case`：公开作品案例。",
    "- `showcase_case_asset`：公开作品图片/视频资源。",
    "- `service_package`：拍摄套餐与交付说明。",
    "- `lead_reservation`：客户预约线索。",
    "- `client_album`：客户私密相册主表。",
    "- `client_album_asset`：客户成片资源，保存云存储 fileID、类型、排序、是否可下载。",
    "- `client_album_access`：访问凭证、手机号、订单码、有效期、打开次数。",
    "- `client_album_log`：查看、下载、分享、后台修改日志。",
    "",
    "## 5. 云函数建议",
    "- `showcaseListCases`：公开作品列表。",
    "- `showcaseGetCaseDetail`：公开作品详情。",
    "- `showcaseSubmitLead`：提交预约线索，带基础风控。",
    "- `clientVerifyAlbumAccess`：手机号/订单码/专属 token 校验。",
    "- `clientListAlbumAssets`：返回客户私密相册资源。",
    "- `adminSaveShowcaseContent`：管理员维护公开内容。",
    "- `adminSaveClientAlbum`：管理员创建/维护客户相册。",
    "- `adminAuditAsset`：素材上架、下架和日志记录。",
    "",
    "## 6. UI 设计方向",
    "- 公开展示页偏品牌和作品质感：大图、短文案、清晰分类、少干扰。",
    "- 私密交付页偏安全和效率：客户身份、相册状态、下载说明、售后入口。",
    "- 后台页偏表格和表单：状态、筛选、批量操作、日志追溯。",
    "- 建议使用 TDesign Miniprogram 统一按钮、表单、标签、弹窗、空状态。",
    "",
    "## 7. 上线前必须确认",
    "- 小程序类目是否覆盖摄影服务/图片展示/预约咨询。",
    "- 隐私协议是否说明手机号、订单码、图片/视频存储和用途。",
    "- 云存储权限是否避免公开暴露客户私密成片。",
    "- 私密相册是否有有效期、访问日志和后台撤销能力。",
    "- 分享路径是否不会泄露其他客户内容。",
    "- 体验版是否用非真实客户数据完整走通。"
  ].join("\n");
}

function workBreakdown(args = {}) {
  const featureName = args.featureName || "客户成片展示小程序";
  const phase = args.phase || "all";
  const sections = {
    requirements: [
      "确认客户是谁、入口在哪里、是否需要登录。",
      "列出公开内容和私密内容的边界。",
      "列出必须上线的 MVP 功能和暂缓功能。",
      "确认与现有档期/订单系统的对接字段。"
    ],
    ui: [
      "画页面地图：公开展示、套餐、预约、我的成片、后台。",
      "为每页写模块清单，不先写代码。",
      "确定图片比例、视频封面、空状态、按钮文案。",
      "统一组件规范：按钮、标签、表单、弹窗、列表。"
    ],
    frontend: [
      "创建页面路由和 tabBar 或分包结构。",
      "接公开接口：作品列表、作品详情、套餐详情。",
      "接私密接口：身份校验、相册列表、资源详情。",
      "处理加载、空状态、错误、无权限、过期链接。"
    ],
    backend: [
      "设计云数据库集合和索引。",
      "设计云函数输入输出和权限校验。",
      "接云存储 fileID，不把客户私密 fileID 直接公开给无权限用户。",
      "记录访问日志、后台修改日志和撤销状态。"
    ],
    qa: [
      "游客路径：看作品 -> 看套餐 -> 留资。",
      "客户路径：输入手机号/订单码 -> 看成片 -> 下载或反馈。",
      "管理员路径：上传作品 -> 发布 -> 下架 -> 查日志。",
      "异常路径：订单码错误、链接过期、资源删除、弱网重试。"
    ],
    launch: [
      "检查 AppID、云环境 ID、云函数部署状态。",
      "检查数据库权限和云存储权限。",
      "配置隐私协议和类目材料。",
      "上传体验版，内部真机测试，提交审核。"
    ]
  };
  const selected = phase === "all" ? Object.entries(sections) : [[phase, sections[phase] || []]];
  return [
    `# ${featureName}工作拆解`,
    "",
    ...selected.flatMap(([name, items]) => [
      `## ${name}`,
      toMarkdownList(items.map((item) => `[ ] ${item}`)),
      ""
    ])
  ].join("\n");
}

function launchChecklist(args = {}) {
  const includePrivateAlbum = args.includePrivateAlbum !== false;
  const privateItems = includePrivateAlbum ? [
    "[ ] 私密相册不能被游客通过 fileID 或分享路径直接访问。",
    "[ ] 手机号/订单码/token 校验失败时不返回任何客户资源。",
    "[ ] 后台可撤销客户访问权限。",
    "[ ] 访问、下载、分享、后台修改都有日志。",
    "[ ] 体验版不得使用真实客户隐私素材。"
  ] : [];
  return [
    "# 微信小程序上线清单",
    "",
    "## 账号与配置",
    "- [ ] AppID 正确，项目配置和微信公众平台一致。",
    "- [ ] 云环境 ID 正确，开发/体验/正式环境不要混用。",
    "- [ ] 服务类目、主体资质、隐私协议已配置。",
    "- [ ] 不把密钥、密码、Webhook、token 写入源码。",
    "",
    "## 前端",
    "- [ ] 所有页面能从首页或明确入口到达。",
    "- [ ] 加载、空状态、失败、无权限、过期状态都可读。",
    "- [ ] 图片和视频在真机网络下加载正常。",
    "- [ ] 分享标题、封面、路径不泄露内部数据。",
    "",
    "## 云开发",
    "- [ ] 云函数已上传并在正式环境验证。",
    "- [ ] 数据库集合权限按角色配置。",
    "- [ ] 云存储权限不会公开客户隐私资源。",
    "- [ ] 日志可用于定位提交失败、访问失败和权限失败。",
    "",
    "## 专项安全门禁",
    "- [ ] 数据库规则没有公开写入、游客写入或客户集合全员可读。",
    "- [ ] 云存储私密资源不会被游客直接下载或通过 fileID 猜到。",
    "- [ ] 云函数敏感接口已校验登录态、角色、资源归属和管理员权限。",
    "- [ ] 前端没有硬编码正式环境外的测试地址、mock 开关、体验版提示或测试账号。",
    "- [ ] 分享路径、页面参数和日志不包含手机号、订单码、openid、token 或客户资源 fileID。",
    "- [ ] `project.private.config.json` 不进入共享配置、日志、缓存或文档。",
    "",
    "## 客户成片交付",
    ...privateItems.map((item) => `- ${item}`),
    "",
    "## 审核与发布",
    "- [ ] 体验版用测试账号和测试素材跑完主流程。",
    "- [ ] 后台管理入口不暴露给普通客户。",
    "- [ ] 提交审核前删除测试文案、测试二维码和占位图。",
    "- [ ] 审核通过后先灰度给内部员工验证。"
  ].join("\n");
}

function miniappShowcaseRoadmap(args = {}) {
  const roadmap = understandingTemplates.showcaseRoadmap || {};
  const brandName = args.brandName || "示例摄影工作室";
  const depth = args.depth === "full" ? "full" : "mvp";
  const phase = args.phase || "all";
  const audience = args.audience || "beginner";
  const phaseMap = {
    business: ["业务定位", "MVP 边界", "下一步要确认"],
    pages: ["页面规划", "阶段 SOP"],
    data: ["数据模型", "阶段 SOP"],
    cloudbase: ["CloudBase 接口", "阶段 SOP"],
    privacy: ["隐私与安全清单", "阶段 SOP"],
    launch: ["上线清单", "阶段 SOP"]
  };
  const selectedSections = phase === "all" ? null : new Set(phaseMap[phase] || []);
  const shouldShow = (name) => !selectedSections || selectedSections.has(name);
  const phases = Array.isArray(roadmap.phases) ? roadmap.phases : [];
  const scopedPhases = phase === "all"
    ? phases
    : phases.filter((item) => {
      const name = String(item.name || "");
      return (
        (phase === "business" && /第 0|边界/.test(name)) ||
        (phase === "pages" && /第 1|页面|UI/i.test(name)) ||
        (phase === "data" && /第 2|数据/.test(name)) ||
        (phase === "cloudbase" && /第 3|CloudBase|接口/i.test(name)) ||
        (phase === "privacy" && /第 4|隐私|安全/.test(name)) ||
        (phase === "launch" && /第 5|测试|上线/.test(name))
      );
    });
  const mvpScope = roadmap.mvpScope || {};
  const sections = [
    `# ${brandName}客户成片展示小程序路线图`,
    "",
    "## 先给小白的结论",
    `- 推荐路线：微信原生小程序 + 微信云开发，先做 ${depth === "full" ? "完整运营版" : "MVP 首版"}。`,
    `- 目标读者：${audience === "beginner" ? "纯小白，按 SOP 一步一步执行" : "已有基础，按模块验收" }。`,
    "- 公开作品、预约咨询和客户私密相册必须分入口、分接口、分权限。",
    "- 本工具只输出路线图和检查清单，不生成模板代码，不部署，不修改真实 CloudBase。",
    ""
  ];
  if (shouldShow("业务定位")) {
    sections.push("## 业务定位", toMarkdownList(roadmap.businessPositioning || []), "");
  }
  if (shouldShow("MVP 边界")) {
    sections.push(
      "## MVP 边界",
      "### 必须做",
      toMarkdownList(mvpScope.must || []),
      "",
      "### 可选做",
      toMarkdownList(mvpScope.optional || []),
      "",
      "### 暂缓做",
      toMarkdownList(mvpScope.defer || []),
      ""
    );
  }
  if (shouldShow("阶段 SOP")) {
    sections.push("## 阶段 SOP");
    for (const item of scopedPhases) {
      sections.push(
        `### ${item.name}`,
        "任务：",
        toMarkdownList(item.tasks || []),
        "",
        "完成标准：",
        toMarkdownList(item.done || []),
        ""
      );
    }
  }
  if (shouldShow("页面规划")) {
    sections.push("## 页面规划", toMarkdownList(roadmap.pagePlan || []), "");
  }
  if (shouldShow("数据模型")) {
    sections.push("## 数据模型", toMarkdownList(roadmap.dataCollections || []), "");
  }
  if (shouldShow("CloudBase 接口")) {
    sections.push("## CloudBase 接口", toMarkdownList(roadmap.cloudFunctions || []), "");
  }
  if (shouldShow("隐私与安全清单")) {
    sections.push("## 隐私与安全清单", toMarkdownList(roadmap.privacyChecklist || []), "");
  }
  if (shouldShow("上线清单")) {
    sections.push("## 上线清单", toMarkdownList(roadmap.launchChecklist || []), "");
  }
  if (shouldShow("下一步要确认")) {
    sections.push("## 下一步要确认", toMarkdownList(roadmap.nextQuestions || []), "");
  }
  sections.push(
    "## 使用建议",
    "- 先用本路线图定 MVP，再用 `miniapp_work_breakdown` 拆具体任务。",
    "- 改真实项目之前，用 `miniapp_project_map` 和 `miniapp_relevant_context` 显式传入项目路径做只读理解。",
    "- 上线前跑 `miniapp_security_quick_scan`，优先处理 critical/high。",
    "- 涉及真实 CloudBase、上传、权限、客户资料和本地知识库读取时，先让使用者确认。",
    ""
  );
  return sections.join("\n");
}

function docsLookup(args = {}) {
  const topic = String(args.topic || "").toLowerCase();
  const all = [...docs.official, ...docs.github];
  const filtered = topic
    ? all.filter((item) => item.topics.some((tag) => tag.toLowerCase().includes(topic)) || item.title.toLowerCase().includes(topic))
    : all;
  return [
    "# 小程序工程资料索引",
    "",
    ...filtered.map((item) => [
      `## ${item.title}`,
      `- 链接：${item.url}`,
      `- 适用主题：${item.topics.join(", ")}`
    ].join("\n"))
  ].join("\n\n");
}

function localUserProfile(args = {}) {
  const includeSources = args.includeSources === true;
  return [
    "# 本地工作画像",
    "",
    "## 沟通偏好",
    toMarkdownList(userProfile.communicationPreferences || []),
    "",
    "## 交付偏好",
    toMarkdownList(userProfile.deliveryPreferences || []),
    "",
    "## 安全规则",
    toMarkdownList(userProfile.safetyRules || []),
    "",
    "## 知识库工作流",
    toMarkdownList(userProfile.knowledgeWorkflow || []),
    "",
    "## 代码编写习惯",
    toMarkdownList(userProfile.codingHabits || []),
    "",
    "## 小程序架构规则",
    renderArchitectureRules(),
    "",
    "## 推荐回答结构",
    toMarkdownList(userProfile.preferredAnswerShape || []),
    includeSources ? `\n## 读取来源\n\`\`\`json\n${JSON.stringify(userProfile.sourceSummary || {}, null, 2)}\n\`\`\`` : ""
  ].join("\n");
}

function localSkillRouting(args = {}) {
  const topic = String(args.topic || "").toLowerCase();
  const groups = skillUsage.installedSkillGroups || [];
  const filtered = topic
    ? groups.filter((group) => {
      const blob = `${group.group} ${(group.skills || []).join(" ")} ${group.howToUse || ""}`.toLowerCase();
      return blob.includes(topic);
    })
    : groups;
  return [
    "# 本地技能路由建议",
    "",
    "## 小程序工程主线推荐技能",
    toMarkdownList(skillUsage.recommendedForMiniProgram || []),
    "",
    "## 默认不建议用于当前小程序主线",
    toMarkdownList(skillUsage.avoidByDefaultForMiniProgram || []),
    "",
    "## 技能分组",
    ...filtered.flatMap((group) => [
      `### ${group.group}`,
      `- 技能：${(group.skills || []).join(", ") || "暂无"}`,
      `- 用法：${group.howToUse || "暂无"}`
    ]),
    "",
    "## Claude 插件线索",
    toMarkdownList(skillUsage.claudePluginHints || [])
  ].join("\n");
}

function localMcpOptimizationAdvice(args = {}) {
  const target = args.target || "wechat-miniapp-engineering-mcp";
  return [
    `# ${target}优化建议`,
    "",
    "## 已内置的优化",
    "- 已加入本地工作画像，包含沟通、交付、安全、知识库和编码习惯。",
    "- 已加入技能路由表，可判断小程序工程中应优先使用哪些技能。",
    "- 工程蓝图默认加入“本地工作方式”章节，避免只给技术模板。",
    "- MCP 仍保持本地只读和不保存密钥的安全边界。",
    "",
    "## 针对小程序工程的下一步增强",
    "- 增加 `miniapp_generate_implementation_plan`：输入功能名，输出 route/controller/service/model/page 文件施工图。",
    "- 增加 `miniapp_privacy_audit`：检查客户私密相册、云存储、手机号/订单码、访问日志和撤销机制。",
    "- 增加 `miniapp_skill_recommender`：根据任务推荐是否使用 silent-search、security、marketingskills、ffmpeg、playwright。",
    "- 增加 `miniapp_cloudbase_preflight`：真实 CloudBase 操作前列出影响范围、环境、集合、云函数和确认项。",
    "- 增加 `miniapp_rule_snapshot`：定期扫描 AGENTS/CLAUDE/知识库协议，发现规则漂移。",
    "",
    "## 当前不建议做的优化",
    "- 不把官方 CloudBase MCP 直接打包进本 MCP；应保持可选配置，避免保存云密钥。",
    "- 不自动读取 Claude history 或 Codex auth/cache；这些可能包含敏感信息或大量无关上下文。",
    "- 不默认引入跨端框架或大型后端系统；先沿用微信原生云开发。",
    "",
    "## 推荐输出格式",
    "- 先结论，再路线，再清单，最后风险和下一步。",
    "- 对小白问题要拆成阶段、文件、页面、数据表、云函数、测试、上线。",
    "- 对业务方案要补引流产品、利润产品、形象产品。"
  ].join("\n");
}

function cloudbaseMcpGuide() {
  return [
    "# CloudBase MCP 配置说明",
    "",
    "用途：让 AI IDE 通过 MCP 管理腾讯云开发环境、数据库、云函数、存储和部署。",
    "",
    "## 本地模式配置示例",
    "不要把真实密钥写进普通文本文件。个人开发优先使用本地模式，按 CloudBase 官方流程登录。",
    "",
    "```json",
    JSON.stringify({
      mcpServers: {
        cloudbase: {
          command: "npx",
          args: ["@cloudbase/cloudbase-mcp@latest"]
        }
      }
    }, null, 2),
    "```",
    "",
    "## 与本 MCP 的分工",
    "- `wechat-miniapp-engineering-mcp`：负责需求梳理、工程拆解、项目扫描、上线清单。",
    "- `cloudbase`：负责真实云开发环境操作，例如数据库、云函数、存储、部署。",
    "",
    "## 安全边界",
    "- 不在 MCP 配置里保存 AppSecret、腾讯云 SecretKey、后台密码。",
    "- 外发、上传、改权限、改数据库正式数据前必须人工确认。",
    "- 先用测试环境和测试素材跑通，再动正式环境。"
  ].join("\n");
}

function queryYunyuContext(args = {}) {
  const query = args.query || "小程序 成片展示 客户 交付 摄影";
  if (args.confirmed !== true) {
    return [
      "# 需要确认后再读取本地知识库",
      "",
      "该工具会调用目标包外的本机知识库命令，并读取目标包外的上下文缓存。",
      "",
      "## 确认请求",
      "- 动作名称：读取本地知识库路由上下文",
      "- 目标路径：本机固定知识库查询命令与上下文缓存路径",
      "- 是否联网/外发/部署/改权限：不联网、不外发、不部署、不改权限；但会读取目标包外本地资料",
      "- 可能风险：可能涉及业务资料或历史上下文摘要",
      "- 回滚方案：不传 `confirmed:true` 时不执行任何读取",
      "- 本地替代方案：先用 `miniapp_generate_blueprint`、`miniapp_showcase` 类通用输出，不调取知识库",
      "",
      "确认后请再次调用本工具，并传入 `confirmed: true`。"
    ].join("\n");
  }
  const command = resolveConfigPath(config.kbQueryCommand);
  if (!command || !exists(command)) {
    return `未找到知识库查询命令：${command || "未配置"}`;
  }
  const result = spawnSync(command, ["context", query], {
    encoding: "utf8",
    timeout: 30000
  });
  const contextText = readText(resolveConfigPath(config.kbContextPath), 20000);
  return [
    "# 本地知识库上下文",
    "",
    `- 查询：${query}`,
    `- 命令退出码：${result.status}`,
    result.stderr ? `- stderr：${result.stderr}` : "",
    "",
    contextText || result.stdout || "未读取到上下文。"
  ].filter(Boolean).join("\n");
}

function normalizeArray(value) {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value.map((item) => String(item)) : [String(value)];
}

function sanitizeForLog(value, key = "") {
  if (value === undefined || value === null) return value;
  if (/secret|token|password|cookie|key|appid|appsecret|mobile|phone/i.test(key)) {
    return "[REDACTED_SENSITIVE_FIELD]";
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeForLog(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitizeForLog(entryValue, entryKey)])
    );
  }
  return redactSensitive(String(value));
}

function ensureLogFiles() {
  ensureDir(LOG_DIR);
  if (!exists(LOG_JSONL)) fs.writeFileSync(LOG_JSONL, "", "utf8");
  if (!exists(LOG_MD)) {
    fs.writeFileSync(LOG_MD, [
      "# MCP 优化日志",
      "",
      "本日志只记录可公开审计的工程事实：用户思路、Codex 决策摘要、引用技能、文件改动、验证结果和安全边界。",
      "",
      "不记录隐藏推理、不保存密钥、不保存客户隐私原文、不上传不同步。",
      ""
    ].join("\n"), "utf8");
  }
}

function parseOptimizationLogEntries() {
  ensureLogFiles();
  const lines = readText(LOG_JSONL, 2_000_000).split("\n").filter(Boolean);
  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      entries.push({
        timestamp: "unknown",
        summary: "日志行解析失败，保留原始行摘要。",
        rawPreview: redactSensitive(line.slice(0, 180))
      });
    }
  }
  return entries;
}

function renderLogSection(title, value) {
  const items = normalizeArray(value).filter(Boolean);
  if (!items.length) return "";
  return [`### ${title}`, ...items.map((item) => `- ${redactSensitive(item)}`), ""].join("\n");
}

function renderOptimizationLogEntry(entry) {
  const safe = sanitizeForLog(entry);
  return [
    `## ${safe.timestamp || nowIso()} - ${safe.summary || "MCP 优化记录"}`,
    "",
    `- 记录 ID：\`${safe.id || "未生成"}\``,
    `- 轮次类型：${safe.roundType || "optimization"}`,
    `- outcome：${safe.outcome || "未标注"}`,
    `- 记录人：${safe.actor || "codex"}`,
    `- MCP 版本：${safe.mcpVersion || SERVER_INFO.version}`,
    "",
    renderLogSection("用户提供的思路", safe.userIdeas),
    renderLogSection("Codex 工程决策摘要", safe.codexDecisions),
    renderLogSection("引用/参考的 skill 与项目", safe.skillsReferenced),
    renderLogSection("6 个子 agent 讨论结论", safe.subagentSummary),
    renderLogSection("文件改动", safe.filesChanged),
    renderLogSection("验证结果", safe.verification),
    renderLogSection("安全边界", safe.safetyNotes),
    renderLogSection("后续动作", safe.nextActions),
    renderLogSection("备注", safe.notes)
  ].filter(Boolean).join("\n");
}

function appendOptimizationLog(args = {}) {
  ensureLogFiles();
  const entry = sanitizeForLog({
    id: `mcp-opt-${Date.now()}`,
    timestamp: nowIso(),
    mcpVersion: SERVER_INFO.version,
    roundType: args.roundType || "optimization",
    outcome: args.outcome || "unspecified",
    actor: args.actor || "codex",
    summary: args.summary || "MCP 优化记录",
    userIdeas: normalizeArray(args.userIdeas),
    codexDecisions: normalizeArray(args.codexDecisions),
    skillsReferenced: normalizeArray(args.skillsReferenced),
    subagentSummary: normalizeArray(args.subagentSummary),
    filesChanged: normalizeArray(args.filesChanged),
    verification: normalizeArray(args.verification),
    safetyNotes: normalizeArray(args.safetyNotes),
    nextActions: normalizeArray(args.nextActions),
    notes: normalizeArray(args.notes),
    requestSummary: summarizeArgs(args)
  });
  fs.appendFileSync(LOG_JSONL, `${JSON.stringify(entry)}\n`, "utf8");
  fs.appendFileSync(LOG_MD, `\n${renderOptimizationLogEntry(entry)}\n`, "utf8");
  return [
    "# 已写入 MCP 优化日志",
    "",
    `- JSONL：\`${LOG_JSONL}\``,
    `- Markdown：\`${LOG_MD}\``,
    `- 记录 ID：\`${entry.id}\``,
    "",
    "说明：MCP 无法自动读取外部聊天窗口的完整上下文，后续每轮优化需要由调用方显式调用本工具或在优化完成时追加记录。"
  ].join("\n");
}

function readOptimizationLog(args = {}) {
  const format = args.format || "markdown";
  const limit = Math.max(1, Math.min(Number(args.limit || 10), 100));
  const entries = parseOptimizationLogEntries().slice(-limit);
  if (format === "json") return JSON.stringify(entries, null, 2);
  if (!entries.length) return readText(LOG_MD, 12000) || "# MCP 优化日志\n\n暂无记录。";
  return [
    "# MCP 优化日志（最近记录）",
    "",
    `- 日志文件：\`${LOG_MD}\``,
    `- 展示条数：${entries.length}`,
    "",
    ...entries.map(renderOptimizationLogEntry)
  ].join("\n");
}

function optimizationLogStatus() {
  const entries = parseOptimizationLogEntries();
  const latest = entries.at(-1);
  return [
    "# MCP 优化日志状态",
    "",
    `- JSONL：\`${LOG_JSONL}\``,
    `- Markdown：\`${LOG_MD}\``,
    `- 记录数：${entries.length}`,
    `- 最新时间：${latest?.timestamp || "暂无"}`,
    `- 最新摘要：${latest?.summary || "暂无"}`,
    "",
    "## 强制记录规则",
    "- 后续每一轮 MCP 升级、优化、技能嵌入、项目理解、配置修改，都必须追加本日志。",
    "- 记录范围是用户思路、Codex 决策摘要、引用技能、文件改动、验证结果、安全边界和下一步。",
    "- 不记录隐藏推理、密钥、token、客户隐私原文、外部账号凭证。"
  ].join("\n");
}

function toPosixRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(number, max));
}

function normalizeRootPrefix(value, fallback) {
  const root = String(value || fallback || "").replace(/^\/+/, "");
  return root.endsWith("/") || root === "" ? root : `${root}/`;
}

function getMiniappStructure(projectRoot) {
  const projectConfig = readJson(path.join(projectRoot, "project.config.json"), {});
  const miniprogramRoot = normalizeRootPrefix(projectConfig.miniprogramRoot || projectConfig.srcMiniprogramRoot, "miniprogram/");
  const cloudRoot = normalizeRootPrefix(projectConfig.cloudfunctionRoot, "cloudfunctions/");
  const appJsonPath = path.join(projectRoot, miniprogramRoot, "app.json");
  const appJson = readJson(appJsonPath, {});
  const pages = Array.isArray(appJson.pages) ? appJson.pages : [];
  const subPackages = Array.isArray(appJson.subPackages) ? appJson.subPackages : Array.isArray(appJson.subpackages) ? appJson.subpackages : [];
  const subPackagePages = subPackages.flatMap((item) => {
    const root = normalizeRootPrefix(item.root || "", "");
    return Array.isArray(item.pages) ? item.pages.map((page) => `${root}${String(page).replace(/^\/+/, "")}`) : [];
  });
  const globalUsingComponents = Object.entries(appJson.usingComponents || {}).map(([alias, componentPath]) => ({
    alias,
    path: String(componentPath)
  }));
  return {
    projectConfig,
    miniprogramRoot,
    cloudRoot,
    appJsonPath,
    appJson,
    pages: [...new Set([...pages, ...subPackagePages])],
    rootPages: pages,
    subPackagePages,
    tabBar: Array.isArray(appJson.tabBar?.list) ? appJson.tabBar.list : [],
    cloudFunctions: listDirectories(path.join(projectRoot, cloudRoot)),
    globalUsingComponents
  };
}

function detectNodeType(relPath, structure) {
  const rel = relPath.toLowerCase();
  const ext = path.extname(rel);
  if (rel === "project.config.json" || rel.endsWith("/app.json") || rel.endsWith("/sitemap.json")) return "config";
  if (ext === ".md") return "document";
  if (rel.startsWith(structure.cloudRoot.toLowerCase())) {
    if (rel.endsWith("/index.js")) return "cloud_function_entry";
    if (rel.includes("/controller/") || rel.includes("controller")) return "controller";
    if (rel.includes("/service/") || rel.includes("service")) return "service";
    if (rel.includes("/model/") || rel.includes("model")) return "model";
    if (rel.includes("route")) return "route";
    return "cloud_function_file";
  }
  if (rel.startsWith(structure.miniprogramRoot.toLowerCase())) {
    if (rel.includes("/pages/") || structure.pages.some((page) => rel.includes(page.toLowerCase()))) {
      if (ext === ".wxml") return "page_view";
      if (ext === ".wxss") return "page_style";
      if (ext === ".json") return "page_config";
      return "page_logic";
    }
    if (rel.includes("/components/")) {
      if (ext === ".wxml") return "component_view";
      if (ext === ".wxss") return "component_style";
      if (ext === ".json") return "component_config";
      return "component_logic";
    }
    if (rel.includes("/utils/") || rel.includes("/helper/")) return "frontend_helper";
    return "miniprogram_file";
  }
  return "file";
}

function parseJsonObject(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function extractUsingComponents(json) {
  return Object.entries(json.usingComponents || {})
    .filter(([alias, componentPath]) => alias && typeof componentPath === "string")
    .map(([alias, componentPath]) => ({ alias, path: componentPath }));
}

function extractWxmlCustomTags(text) {
  const tags = new Set();
  for (const match of text.matchAll(/<\s*([a-zA-Z][\w-]*)(?=[\s>/])/g)) {
    const tag = match[1];
    const lower = tag.toLowerCase();
    if (lower.includes("-") || !NATIVE_WXML_TAGS.has(lower)) tags.add(tag);
  }
  return [...tags].slice(0, 80);
}

function stripMiniappUrl(value) {
  return String(value || "").split("?")[0].split("#")[0].replace(/^\/+/, "");
}

function extractFileFacts(filePath, relPath, text) {
  const symbols = [];
  const collections = new Set();
  const imports = new Set();
  const handlers = [];
  const routes = new Set();
  const cloudFunctionCalls = new Set();
  const routeMappings = [];
  const usingComponents = [];
  const styleImports = new Set();
  const customTags = new Set();
  const navigationTargets = new Set();
  let componentDeclared = false;
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".json") {
    const json = parseJsonObject(text);
    componentDeclared = json.component === true;
    usingComponents.push(...extractUsingComponents(json));
  }
  if (extension === ".wxml") {
    extractWxmlCustomTags(text).forEach((tag) => customTags.add(tag));
  }
  if (extension === ".wxss" || extension === ".css") {
    for (const match of text.matchAll(/@import\s+["'`]([^"'`]+)["'`]/g)) styleImports.add(match[1]);
  }
  for (const match of text.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) symbols.push(match[1]);
  for (const match of text.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)\b/g)) symbols.push(match[1]);
  for (const match of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g)) symbols.push(match[1]);
  for (const match of text.matchAll(/\basync\s+([A-Za-z_$][\w$]*)\s*\(/g)) symbols.push(match[1]);
  if (/\bPage\s*\(\s*\{/.test(text)) handlers.push("Page");
  if (/\bComponent\s*\(\s*\{/.test(text)) handlers.push("Component");
  if (/\bApp\s*\(\s*\{/.test(text)) handlers.push("App");
  if (/\bgetApp\s*\(/.test(text)) handlers.push("getApp");
  if (/exports\.main\s*=/.test(text)) handlers.push("cloud function main");
  for (const match of text.matchAll(/\.collection\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) collections.add(match[1]);
  for (const match of text.matchAll(/(?:require\(|from\s+)["'`]([^"'`]+)["'`]/g)) imports.add(match[1]);
  for (const match of text.matchAll(/\broute\s*=\s*["'`]([A-Za-z0-9_/-]+)["'`]/g)) routes.add(match[1]);
  for (const match of text.matchAll(/\broute\s*:\s*["'`]([A-Za-z0-9_/-]+)["'`]/g)) routes.add(match[1]);
  for (const match of text.matchAll(/\bcallCloud(?:Data|Sumbit|Submit|SumbitAsync|SubmitAsync)?\(\s*["'`]([A-Za-z0-9_/-]+)["'`]/g)) routes.add(match[1]);
  for (const match of text.matchAll(/["'`]([A-Za-z0-9_/-]+\/[A-Za-z0-9_/-]+)["'`]/g)) {
    if (/^(admin\/|work\/|album\/|product\/|news\/|fav\/|passport\/|home\/|meet\/|check\/)/.test(match[1])) routes.add(match[1]);
  }
  for (const match of text.matchAll(/callFunction\(\s*\{[\s\S]{0,260}?name\s*:\s*["'`]([^"'`]+)["'`]/g)) cloudFunctionCalls.add(match[1]);
  for (const match of text.matchAll(/wx\.(?:navigateTo|redirectTo|switchTab|reLaunch)\(\s*\{[\s\S]{0,220}?url\s*:\s*["'`]([^"'`]+)["'`]/g)) {
    const target = stripMiniappUrl(match[1]);
    if (target) navigationTargets.add(target);
  }
  for (const match of text.matchAll(/["'`]([A-Za-z0-9_/-]+\/[A-Za-z0-9_/-]+)["'`]\s*:\s*["'`]([A-Za-z0-9_/-]+_controller@[A-Za-z0-9_$]+(?:#[A-Za-z0-9_-]+)?)["'`]/g)) {
    routeMappings.push({ route: match[1], target: match[2] });
    routes.add(match[1]);
  }
  return {
    path: relPath,
    extension: path.extname(filePath).toLowerCase(),
    hash: contentHash(text),
    lineCount: text.split("\n").length,
    symbols: [...new Set(symbols)].slice(0, 20),
    handlers: [...new Set(handlers)],
    componentDeclared,
    usingComponents: usingComponents.slice(0, 80),
    customTags: [...customTags].slice(0, 80),
    styleImports: [...styleImports].slice(0, 80),
    navigationTargets: [...navigationTargets].slice(0, 80),
    collections: [...collections].slice(0, 20),
    imports: [...imports].slice(0, 40),
    routes: [...routes].slice(0, 80),
    cloudFunctionCalls: [...cloudFunctionCalls].slice(0, 20),
    routeMappings: routeMappings.slice(0, 120)
  };
}

function resolveRelativeImport(fromRelPath, importValue, knownRelPaths) {
  if (!importValue.startsWith(".")) return "";
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRelPath), importValue));
  const candidates = [
    base,
    `${base}.js`,
    `${base}.ts`,
    `${base}.json`,
    path.posix.join(base, "index.js"),
    path.posix.join(base, "index.ts")
  ];
  return candidates.find((candidate) => knownRelPaths.has(candidate)) || "";
}

function resolveMiniappPath(fromRelPath, value, structure, knownRelPaths, extensions = [".js", ".json", ".wxml", ".wxss"]) {
  if (!value) return "";
  const raw = stripMiniappUrl(value);
  if (!raw) return "";
  let base = "";
  if (raw.startsWith(".")) {
    base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRelPath), raw));
  } else if (raw.startsWith(structure.miniprogramRoot)) {
    base = path.posix.normalize(raw);
  } else {
    base = path.posix.normalize(path.posix.join(structure.miniprogramRoot, raw));
  }
  const candidates = [base];
  for (const ext of extensions) candidates.push(`${base}${ext}`);
  for (const ext of extensions) candidates.push(path.posix.join(base, `index${ext}`));
  return candidates.find((candidate) => knownRelPaths.has(candidate)) || "";
}

function componentBaseFromRelPath(relPath, structure) {
  const normalized = relPath.split(path.sep).join("/");
  const rel = normalized.toLowerCase();
  if (!rel.startsWith(structure.miniprogramRoot.toLowerCase()) || !rel.includes("/components/")) return "";
  const parsed = path.posix.parse(normalized);
  return parsed.name === "index" ? parsed.dir : path.posix.join(parsed.dir, parsed.name);
}

function componentBaseFromResolvedPath(relPath, structure) {
  const parsed = path.posix.parse(relPath);
  const base = parsed.name === "index" ? parsed.dir : path.posix.join(parsed.dir, parsed.name);
  if (base.toLowerCase().startsWith(structure.miniprogramRoot.toLowerCase())) return base;
  return componentBaseFromRelPath(relPath, structure);
}

function controllerNameFromTarget(target) {
  return String(target || "").split("@")[0].replace(/#.+$/, "");
}

function methodNameFromTarget(target) {
  return String(target || "").split("@")[1]?.replace(/#.+$/, "") || "";
}

function inferControllerFile(controllerName, knownRelPaths) {
  if (!controllerName) return "";
  const wanted = `${controllerName}.js`;
  return [...knownRelPaths].find((relPath) => relPath.endsWith(`/controller/${wanted}`) || relPath.endsWith(`/controller/admin/${wanted}`)) || "";
}

function scoreGraphNode(graph, node) {
  const outgoing = graph.edges.filter((edge) => edge.from === node.id).length;
  const incoming = graph.edges.filter((edge) => edge.to === node.id).length;
  const typeWeight = {
    project: 8,
    page: 7,
    cloud_function: 7,
    route: 7,
    route_action: 7,
    controller: 6,
    service: 6,
    model: 6,
    collection: 5,
    cloud_function_entry: 5,
    frontend_helper: 4,
    component: 4,
    component_logic: 4,
    component_view: 4,
    component_style: 3,
    component_config: 4,
    config: 4
  }[node.type] || 1;
  return incoming * 3 + outgoing * 2 + typeWeight + Math.min(Number(node.lineCount || 0) / 200, 4);
}

function rankedGraphNodes(graph, limit = 20) {
  return graph.nodes
    .map((node) => ({ ...node, importance: Number(scoreGraphNode(graph, node).toFixed(2)) }))
    .sort((a, b) => b.importance - a.importance || String(a.path || a.name).localeCompare(String(b.path || b.name)))
    .slice(0, limit);
}

function graphNeighbors(graph, nodeId, depth = 1) {
  const seen = new Set([nodeId]);
  const result = [];
  let frontier = [nodeId];
  for (let currentDepth = 1; currentDepth <= depth; currentDepth += 1) {
    const next = [];
    for (const id of frontier) {
      for (const edge of graph.edges) {
        if (edge.from === id || edge.to === id) {
          const other = edge.from === id ? edge.to : edge.from;
          if (!seen.has(other)) {
            seen.add(other);
            next.push(other);
          }
          result.push({ ...edge, depth: currentDepth });
        }
      }
    }
    frontier = next;
  }
  return {
    edges: result,
    nodes: graph.nodes.filter((node) => seen.has(node.id))
  };
}

function nodeById(graph, id) {
  return graph.nodes.find((node) => node.id === id);
}

function buildMiniappGraph(args = {}) {
  const projectRoot = resolveProjectRoot(args.projectPath);
  const limit = clampNumber(args.limit, 700, 50, 2000);
  const structure = getMiniappStructure(projectRoot);
  const files = listFilesRecursive(projectRoot, (filePath) => {
    const stat = safeStat(filePath);
    return isSafeTextFile(filePath) && stat && stat.size <= MAX_SAFE_TEXT_FILE_SIZE;
  }, limit);
  const relFiles = files.map((filePath) => toPosixRelative(projectRoot, filePath));
  const knownRelPaths = new Set(relFiles);
  const nodes = [];
  const nodeIds = new Set();
  const edges = [];
  const pageNodes = new Set();
  const collectionNodes = new Set();
  const componentNodes = new Set();
  const factsByFile = new Map();
  const fileHashes = {};
  function addNode(node) {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  }
  function addComponentNode(componentBase, alias = "") {
    if (!componentBase) return "";
    const componentId = `component:${componentBase}`;
    if (!componentNodes.has(componentId)) {
      componentNodes.add(componentId);
      addNode({
        id: componentId,
        type: "component",
        name: alias || path.posix.basename(componentBase),
        path: componentBase
      });
    }
    return componentId;
  }

  addNode({
    id: "project",
    type: "project",
    name: config.projectLabel || path.basename(projectRoot),
    path: "."
  });

  for (const page of structure.pages) {
    const id = `page:${page}`;
    pageNodes.add(id);
    addNode({ id, type: "page", name: page.split("/").at(-1), path: `${structure.miniprogramRoot}${page}` });
    edges.push({ from: "project", to: id, type: "routes" });
  }

  for (const cloudFunction of structure.cloudFunctions) {
    const id = `cloud:${cloudFunction}`;
    addNode({ id, type: "cloud_function", name: cloudFunction, path: `${structure.cloudRoot}${cloudFunction}` });
    edges.push({ from: "project", to: id, type: "contains" });
  }

  for (const fullPath of files) {
    const relPath = toPosixRelative(projectRoot, fullPath);
    const type = detectNodeType(relPath, structure);
    const text = readText(fullPath, 80_000);
    const facts = extractFileFacts(fullPath, relPath, text);
    factsByFile.set(relPath, facts);
    fileHashes[relPath] = facts.hash;
    const fileId = `file:${relPath}`;
    addNode({
      id: fileId,
      type,
      name: path.basename(relPath),
      path: relPath,
      lineCount: facts.lineCount,
      handlers: facts.handlers
    });
    edges.push({ from: "project", to: fileId, type: "contains" });
    const componentBase = componentBaseFromRelPath(relPath, structure) || (facts.componentDeclared ? relPath.replace(/\.[^.]+$/, "") : "");
    if (componentBase) {
      const componentId = addComponentNode(componentBase);
      edges.push({ from: componentId, to: fileId, type: "contains" });
    }

    for (const page of structure.pages) {
      const pagePrefix = `${structure.miniprogramRoot}${page}`;
      if (relPath.startsWith(pagePrefix)) edges.push({ from: `page:${page}`, to: fileId, type: "contains" });
    }
    if (relPath.startsWith(structure.cloudRoot)) {
      const name = relPath.slice(structure.cloudRoot.length).split("/")[0];
      if (name) edges.push({ from: `cloud:${name}`, to: fileId, type: "contains" });
    }
    for (const collection of facts.collections) {
      const collectionId = `collection:${collection}`;
      if (!collectionNodes.has(collectionId)) {
        collectionNodes.add(collectionId);
        addNode({ id: collectionId, type: "collection", name: collection, path: collection });
      }
      edges.push({ from: fileId, to: collectionId, type: "uses_collection" });
    }
  }

  for (const [relPath, facts] of factsByFile.entries()) {
    const fileId = `file:${relPath}`;
    const fileNode = nodeById({ nodes, edges }, fileId);
    for (const importValue of facts.imports) {
      const target = resolveRelativeImport(relPath, importValue, knownRelPaths);
      if (target) {
        edges.push({ from: fileId, to: `file:${target}`, type: "imports" });
        const targetNode = nodeById({ nodes, edges }, `file:${target}`);
        if (fileNode?.type === "controller" && targetNode?.type === "service") edges.push({ from: fileId, to: `file:${target}`, type: "calls_service" });
        if (fileNode?.type === "service" && targetNode?.type === "model") edges.push({ from: fileId, to: `file:${target}`, type: "uses_model" });
      }
    }
    for (const component of facts.usingComponents || []) {
      const target = resolveMiniappPath(relPath, component.path, structure, knownRelPaths, [".json", ".js", ".wxml", ".wxss"]);
      const componentBase = target ? componentBaseFromResolvedPath(target, structure) : "";
      const componentId = addComponentNode(componentBase, component.alias);
      if (componentId) edges.push({ from: fileId, to: componentId, type: "uses_component", alias: component.alias });
    }
    if (facts.customTags?.length) {
      const configRelPath = relPath.replace(/\.wxml$/i, ".json");
      const localComponents = factsByFile.get(configRelPath)?.usingComponents || [];
      const componentAliases = new Map([...structure.globalUsingComponents, ...localComponents].map((item) => [item.alias, item.path]));
      for (const tag of facts.customTags) {
        const componentPath = componentAliases.get(tag);
        if (!componentPath) continue;
        const target = resolveMiniappPath(configRelPath, componentPath, structure, knownRelPaths, [".json", ".js", ".wxml", ".wxss"]);
        const componentBase = target ? componentBaseFromResolvedPath(target, structure) : "";
        const componentId = addComponentNode(componentBase, tag);
        if (componentId) edges.push({ from: fileId, to: componentId, type: "renders_component_tag", alias: tag });
      }
    }
    for (const importValue of facts.styleImports || []) {
      const target = resolveMiniappPath(relPath, importValue, structure, knownRelPaths, [".wxss", ".css"]);
      if (target) edges.push({ from: fileId, to: `file:${target}`, type: "imports_style" });
    }
    for (const target of facts.navigationTargets || []) {
      const normalized = stripMiniappUrl(target);
      const page = structure.pages.find((item) => normalized === item || normalized.startsWith(`${item}/`));
      if (page) edges.push({ from: fileId, to: `page:${page}`, type: "navigates_to" });
    }
    for (const route of facts.routes || []) {
      const routeId = `route:${route}`;
      addNode({ id: routeId, type: "route", name: route, path: route });
      edges.push({ from: fileId, to: routeId, type: "uses_route" });
    }
    for (const functionName of facts.cloudFunctionCalls || []) {
      const cloudId = `cloud:${functionName}`;
      addNode({ id: cloudId, type: "cloud_function", name: functionName, path: `${structure.cloudRoot}${functionName}` });
      edges.push({ from: fileId, to: cloudId, type: "calls_cloud_function" });
    }
    for (const mapping of facts.routeMappings || []) {
      const routeId = `route:${mapping.route}`;
      const actionId = `action:${mapping.route}`;
      const controllerName = controllerNameFromTarget(mapping.target);
      const methodName = methodNameFromTarget(mapping.target);
      addNode({ id: routeId, type: "route", name: mapping.route, path: mapping.route });
      addNode({ id: actionId, type: "route_action", name: `${controllerName}@${methodName}`, path: mapping.route, controllerName, methodName });
      edges.push({ from: fileId, to: routeId, type: "defines_route" });
      edges.push({ from: routeId, to: actionId, type: "dispatches_to" });
      const controllerFile = inferControllerFile(controllerName, knownRelPaths);
      if (controllerFile) edges.push({ from: actionId, to: `file:${controllerFile}`, type: "handled_by" });
    }
  }

  const importance = Object.fromEntries(rankedGraphNodes({ nodes, edges }, nodes.length).map((node) => [node.id, node.importance]));

  return {
    projectRoot,
    version: SERVER_INFO.version,
    generatedAt: nowIso(),
    structure,
    nodes,
    edges,
    importance,
    factsByFile: Object.fromEntries(factsByFile),
    fileHashes,
    safety: {
      scannedSafeTextFiles: files.length,
      maxFiles: limit,
      skippedSensitivePatterns: SENSITIVE_FILE_PATTERNS.map((pattern) => String(pattern)),
      skippedDirectories: [...SKIP_DIRS]
    }
  };
}

function routeChains(graph, limit = 40) {
  return graph.edges
    .filter((edge) => edge.type === "dispatches_to")
    .map((edge) => {
      const route = nodeById(graph, edge.from);
      const action = nodeById(graph, edge.to);
      const controllerEdge = graph.edges.find((item) => item.from === edge.to && item.type === "handled_by");
      const controller = controllerEdge ? nodeById(graph, controllerEdge.to) : null;
      return {
        route: route?.name || edge.from.replace(/^route:/, ""),
        action: action?.name || "",
        controllerPath: controller?.path || ""
      };
    })
    .slice(0, limit);
}

function graphStatsObject(graph) {
  const counts = graph.nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {});
  const edgeCounts = graph.edges.reduce((acc, edge) => {
    acc[edge.type] = (acc[edge.type] || 0) + 1;
    return acc;
  }, {});
  const routeCount = graph.nodes.filter((node) => node.type === "route").length;
  const controllerCount = graph.nodes.filter((node) => node.type === "controller").length;
  const serviceCount = graph.nodes.filter((node) => node.type === "service").length;
  const modelCount = graph.nodes.filter((node) => node.type === "model").length;
  const riskHints = [];
  if (routeCount && !controllerCount) riskHints.push("检测到路由线索，但 controller 文件较少，需确认云函数路由是否在框架内动态分发。");
  if (graph.nodes.some((node) => /album|相册|成片|showcase|gallery/i.test(`${node.name} ${node.path}`))) {
    riskHints.push("检测到相册/作品线索，客户私密资源应单独审查云存储权限、访问凭证和日志。");
  }
  if (graph.nodes.some((node) => /work|payroll|commission|payment|工资|提成|收款/i.test(`${node.name} ${node.path}`))) {
    riskHints.push("检测到内部经营/财务线索，客户展示入口必须避免暴露 work/payroll/commission/payment 链路。");
  }
  return {
    nodeCounts: counts,
    edgeCounts,
    routeCount,
    routeChainCount: routeChains(graph, 500).length,
    controllerCount,
    serviceCount,
    modelCount,
    collectionCount: graph.nodes.filter((node) => node.type === "collection").length,
    componentCount: graph.nodes.filter((node) => node.type === "component").length,
    componentEdgeCount: graph.edges.filter((edge) => edge.type === "uses_component" || edge.type === "renders_component_tag").length,
    styleImportCount: graph.edges.filter((edge) => edge.type === "imports_style").length,
    navigationEdgeCount: graph.edges.filter((edge) => edge.type === "navigates_to").length,
    topNodes: rankedGraphNodes(graph, 15),
    riskHints
  };
}

function renderProjectMap(graph, args = {}) {
  const detailLevel = parseDetailLevel(args.detail_level);
  const counts = graph.nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {});
  const filesByType = graph.nodes
    .filter((node) => node.type.startsWith("page_") || node.type.startsWith("component_") || ["route", "controller", "service", "model", "cloud_function_entry", "component", "frontend_helper", "config"].includes(node.type))
    .slice(0, detailLevel === "summary" ? 35 : 100);
  const topNodes = rankedGraphNodes(graph, detailLevel === "summary" ? 10 : 20);
  const chains = routeChains(graph, detailLevel === "summary" ? 15 : 50);
  const componentRelations = graph.edges
    .filter((edge) => edge.type === "uses_component" || edge.type === "renders_component_tag")
    .slice(0, detailLevel === "summary" ? 20 : 80)
    .map((edge) => {
      const from = nodeById(graph, edge.from);
      const to = nodeById(graph, edge.to);
      return `\`${from?.path || from?.name || edge.from}\` --${edgeLabel(edge)}${edge.alias ? `(${edge.alias})` : ""}--> \`${to?.path || to?.name || edge.to}\``;
    });
  const onboarding = [
    "project.config.json",
    `${graph.structure.miniprogramRoot}app.json`,
    `${graph.structure.miniprogramRoot}app.js`,
    `${graph.structure.cloudRoot}<云函数>/index.js`,
    `${graph.structure.cloudRoot}<云函数>/route.js`,
    `${graph.structure.cloudRoot}<云函数>/controller/`,
    `${graph.structure.cloudRoot}<云函数>/service/`,
    `${graph.structure.cloudRoot}<云函数>/model/`
  ];
  return [
    "# 小程序项目地图",
    "",
    `- 项目路径：\`${graph.projectRoot}\``,
    `- 生成时间：${graph.generatedAt}`,
    `- 安全文本文件扫描数：${graph.safety.scannedSafeTextFiles}`,
    `- 节点数：${graph.nodes.length}`,
    `- 边数：${graph.edges.length}`,
    "",
    "## 节点统计",
    toMarkdownList(Object.entries(counts).sort().map(([type, count]) => `${type}: ${count}`)),
    "",
    "## 重要节点",
    toMarkdownList(topNodes.map((node) => `${node.type} -> \`${node.path || node.name}\`（重要度 ${node.importance}）`)),
    "",
    "## 页面路由",
    toMarkdownList(graph.structure.pages.slice(0, detailLevel === "summary" ? 40 : 120).map((page) => `\`${page}\``)),
    "",
    "## tabBar",
    toMarkdownList(graph.structure.tabBar.map((item) => `${item.text || "未命名"} -> \`${item.pagePath || ""}\``)),
    "",
    "## 云函数",
    toMarkdownList(graph.structure.cloudFunctions.map((name) => `\`${name}\``)),
    "",
    "## 数据集合线索",
    toMarkdownList(graph.nodes.filter((node) => node.type === "collection").map((node) => `\`${node.name}\``).slice(0, 80)),
    "",
    "## route -> controller 线索",
    toMarkdownList(chains.map((chain) => `\`${chain.route}\` -> ${chain.action || "未解析 action"}${chain.controllerPath ? ` -> \`${chain.controllerPath}\`` : ""}`)),
    "",
    "## 组件关系线索",
    toMarkdownList(componentRelations),
    "",
    "## 关键文件",
    toMarkdownList(filesByType.map((node) => `${node.type} -> \`${node.path}\``)),
    "",
    "## 小白读代码顺序",
    toMarkdownList(onboarding),
    "",
    "## 来源说明",
    "- 该能力借鉴 Understand-Anything 的知识图谱/项目地图思路，并融合 CodeGraph 的节点/边、重要度排序、路由链路和 detail_level 思路。",
    "- 当前只读取安全文本文件，跳过密钥、token、私密配置、历史记录和高风险目录。"
  ].join("\n");
}

function miniappProjectMap(args = {}) {
  const graph = buildMiniappGraph(args);
  if (args.format === "json") {
    const { factsByFile, ...safeGraph } = graph;
    return JSON.stringify(safeGraph, null, 2);
  }
  return renderProjectMap(graph, args);
}

function understandProjectFlow(args = {}) {
  const graph = buildMiniappGraph({ ...args, limit: args.limit || 900 });
  const goal = args.goal || "面向客户的摄影成片展示小程序";
  const stages = understandingTemplates.stages?.length ? understandingTemplates.stages : [
    { name: "需求", output: "目标用户、核心场景、MVP 边界" },
    { name: "UI", output: "页面地图、组件、状态和文案" },
    { name: "前端", output: "路由、页面文件、helper 调用和异常状态" },
    { name: "后端", output: "云函数、controller、service、model 和权限" },
    { name: "数据", output: "云数据库集合、索引、云存储 fileID 和日志" },
    { name: "上线", output: "体验版、隐私协议、类目、审核和灰度验证" }
  ];
  const collectionNames = graph.nodes.filter((node) => node.type === "collection").map((node) => node.name);
  return [
    `# ${goal}全流程理解`,
    "",
    "## 先给小白的结论",
    "- 这个 MCP 现在会先画项目地图，再按“需求 -> UI -> 前端 -> 后端 -> 数据 -> 测试 -> 上线”解释工程。",
    "- 当前默认路线仍是微信原生小程序 + 微信云开发，不建议为了客户展示小程序引入重型新框架。",
    "- 客户成片展示要和内部档期、业绩、工资分入口，私密相册必须有校验、有效期、撤销和日志。",
    "",
    "## 当前项目证据",
    `- 小程序根目录：\`${graph.structure.miniprogramRoot}\``,
    `- 云函数目录：\`${graph.structure.cloudRoot}\``,
    `- 页面数：${graph.structure.pages.length}`,
    `- 云函数数：${graph.structure.cloudFunctions.length}`,
    `- 集合线索数：${collectionNames.length}`,
    "",
    "## 阶段路线",
    ...stages.flatMap((stage, index) => [
      `### ${index + 1}. ${stage.name}`,
      `- 目标产物：${stage.output || stage.description || "明确该阶段的可交付结果"}`,
      `- 小白执行法：先把这一阶段写成清单，再映射到页面、文件、数据表或云函数。`,
      ""
    ]),
    "## 结合成片展示的推荐施工顺序",
    "- 需求：确认公开作品、套餐预约、客户私密相册、后台维护四条主线。",
    "- UI：先画首页、作品分类、作品详情、预约咨询、我的成片、私密相册详情、后台列表。",
    "- 前端：新增路由和页面文件，所有页面都补加载、空状态、失败、无权限、过期。",
    "- 后端：新增公开展示接口、预约接口、客户相册校验接口、相册资源接口、后台维护接口。",
    "- 数据：公开作品和客户私密资源分集合，客户资源只通过校验后的云函数返回。",
    "- 上线：用测试素材跑通体验版，再检查隐私协议、云存储权限、审核材料。",
    "",
    "## 建议优先查看的文件",
    toMarkdownList([
      "project.config.json",
      `${graph.structure.miniprogramRoot}app.json`,
      `${graph.structure.miniprogramRoot}app.js`,
      `${graph.structure.cloudRoot}<云函数>/index.js`,
      `${graph.structure.cloudRoot}<云函数>/route.js`,
      `${graph.structure.cloudRoot}<云函数>/controller/`,
      `${graph.structure.cloudRoot}<云函数>/service/`,
      `${graph.structure.cloudRoot}<云函数>/model/`
    ])
  ].join("\n");
}

function understandFileRole(args = {}) {
  if (!args.filePath) throw new Error("必须传入 filePath。");
  const projectRoot = resolveProjectRoot(args.projectPath);
  const requestedTargetPath = path.resolve(path.isAbsolute(args.filePath) ? args.filePath : path.join(projectRoot, args.filePath));
  const targetPath = safeRealpath(requestedTargetPath);
  if (!targetPath || !isPathInside(targetPath, projectRoot)) throw new Error("拒绝读取项目外文件。");
  if (isDeniedResolvedPath(targetPath) || !isSafeTextFile(targetPath)) throw new Error("拒绝读取敏感或非安全文本文件。");
  const stat = safeStat(targetPath);
  if (!stat || !stat.isFile()) throw new Error("文件不存在或不可读取。");
  if (stat.size > MAX_SAFE_TEXT_FILE_SIZE) throw new Error("文件过大，拒绝读取。");
  const structure = getMiniappStructure(projectRoot);
  const relPath = toPosixRelative(projectRoot, targetPath);
  const text = readText(targetPath, 120_000);
  const facts = extractFileFacts(targetPath, relPath, text);
  const type = detectNodeType(relPath, structure);
  const sameStem = listFilesRecursive(projectRoot, (filePath) => {
    if (!isSafeTextFile(filePath)) return false;
    return path.basename(filePath, path.extname(filePath)) === path.basename(targetPath, path.extname(targetPath));
  }, 20).map((filePath) => toPosixRelative(projectRoot, filePath));
  return [
    "# 文件角色说明",
    "",
    `- 文件：\`${relPath}\``,
    `- 类型：${type}`,
    `- 行数：${facts.lineCount}`,
    `- 关注点：${args.focus || "默认解释它在小程序工程中的位置和上下游"}`,
    "",
    "## 它大概率负责什么",
    toMarkdownList([
      type === "page_view" ? "页面结构和展示区域" : "",
      type === "page_logic" ? "页面数据、生命周期、事件处理和接口调用" : "",
      type === "page_style" ? "页面样式和视觉布局" : "",
      type === "page_config" ? "页面标题、组件引用和局部配置" : "",
      type === "controller" ? "云函数 controller 层：接收请求、校验参数、调用 service" : "",
      type === "service" ? "业务逻辑层：组织规则、权限、状态流转和 model 调用" : "",
      type === "model" ? "数据访问层：定义集合结构、字段前缀和数据库操作" : "",
      type === "route" ? "云函数路由层：把 action/API 分发到 controller" : "",
      type === "component" ? "可复用前端组件" : "",
      type === "frontend_helper" ? "前端通用 helper、请求封装或工具函数" : "",
      type === "config" ? "项目或页面配置" : ""
    ].filter(Boolean)),
    "",
    "## 代码线索",
    toMarkdownList([
      facts.handlers.length ? `框架入口：${facts.handlers.join(", ")}` : "",
      facts.symbols.length ? `函数/类线索：${facts.symbols.slice(0, 12).join(", ")}` : "",
      facts.imports.length ? `依赖线索：${facts.imports.slice(0, 12).join(", ")}` : "",
      facts.collections.length ? `数据库集合线索：${facts.collections.join(", ")}` : "",
      facts.usingComponents.length ? `usingComponents：${facts.usingComponents.map((item) => `${item.alias} -> ${item.path}`).join(", ")}` : "",
      facts.customTags.length ? `WXML 自定义标签：${facts.customTags.join(", ")}` : "",
      facts.styleImports.length ? `WXSS 导入：${facts.styleImports.join(", ")}` : "",
      facts.navigationTargets.length ? `页面跳转：${facts.navigationTargets.join(", ")}` : ""
    ].filter(Boolean)),
    "",
    "## 同名相关文件",
    toMarkdownList(sameStem.map((item) => `\`${item}\``)),
    "",
    "## 小白下一步",
    "- 如果要改页面展示，先看 `.wxml` 和 `.wxss`。",
    "- 如果要改点击、加载、接口调用，先看 `.js`。",
    "- 如果要改数据结构或权限，继续追踪它调用的云函数、service 和 model。"
  ].join("\n");
}

function detectFeatureTerms(featureName) {
  const text = String(featureName || "").toLowerCase();
  const rules = [
    { re: /成片|相册|album|作品|showcase|case|gallery/, terms: ["album", "showcase", "case", "gallery", "成片", "相册", "作品", "fileID", "storage"] },
    { re: /预约|咨询|lead|reservation|booking/, terms: ["lead", "reservation", "booking", "预约", "咨询", "phone"] },
    { re: /套餐|产品|package|product|service/, terms: ["package", "product", "service", "套餐", "产品", "服务"] },
    { re: /订单|档期|schedule|calendar|order/, terms: ["order", "schedule", "calendar", "档期", "订单"] },
    { re: /后台|管理|admin|work/, terms: ["admin", "work", "manage", "后台", "管理"] }
  ];
  const terms = new Set(String(featureName || "").split(/\s+/).filter(Boolean));
  for (const rule of rules) {
    if (rule.re.test(text)) rule.terms.forEach((term) => terms.add(term));
  }
  return [...terms].filter((term) => term.length >= 2);
}

function understandFeatureImpact(args = {}) {
  const featureName = args.featureName || "客户成片展示";
  const projectRoot = resolveProjectRoot(args.projectPath);
  const structure = getMiniappStructure(projectRoot);
  const limit = clampNumber(args.limit, 80, 10, 200);
  const terms = detectFeatureTerms(featureName);
  const files = listFilesRecursive(projectRoot, (filePath) => {
    const stat = safeStat(filePath);
    return isSafeTextFile(filePath) && stat && stat.size <= MAX_SAFE_TEXT_FILE_SIZE;
  }, 1600);
  const matches = [];
  for (const filePath of files) {
    if (matches.length >= limit) break;
    const relPath = toPosixRelative(projectRoot, filePath);
    const haystack = `${relPath}\n${readText(filePath, 80_000)}`.toLowerCase();
    const hitTerms = terms.filter((term) => haystack.includes(term.toLowerCase())).slice(0, 8);
    if (hitTerms.length) {
      matches.push({
        path: relPath,
        type: detectNodeType(relPath, structure),
        hitTerms
      });
    }
  }
  const grouped = matches.reduce((acc, item) => {
    acc[item.type] ||= [];
    acc[item.type].push(item);
    return acc;
  }, {});
  const privateAlbumAdvice = /成片|相册|album|gallery|showcase|作品/.test(String(featureName).toLowerCase()) ? [
    "新增公开作品集合和客户私密相册集合，避免混用内部订单/工资/后台数据。",
    "新增客户相册校验云函数：手机号、订单码或专属 token 通过后才返回资源。",
    "云存储 fileID 不直接暴露给未授权游客，后台必须能撤销访问。",
    "补访问日志、下载日志、分享日志和后台修改日志。",
    "体验版必须使用测试素材，不用真实客户隐私素材。"
  ] : [];
  return [
    `# 功能影响分析：${featureName}`,
    "",
    "## 搜索词",
    toMarkdownList(terms.map((term) => `\`${term}\``)),
    "",
    "## 命中的现有文件",
    Object.keys(grouped).length ? Object.entries(grouped).map(([type, items]) => [
      `### ${type}`,
      toMarkdownList(items.slice(0, 30).map((item) => `\`${item.path}\`（${item.hitTerms.join(", ")}）`))
    ].join("\n")).join("\n\n") : "- 暂未命中现有文件，建议按下面施工清单新增。",
    "",
    "## 建议影响范围",
    "- 需求：确认该功能是公开展示、客户私密交付、后台管理，还是内部经营功能。",
    "- UI：新增或调整页面地图、空状态、错误状态、权限状态。",
    "- 前端：同步 app.json 路由、页面 js/wxml/wxss/json、helper 调用。",
    "- 后端：同步 route、controller、service、model、权限校验、日志。",
    "- 数据：同步集合结构、索引、字段说明、云存储 fileID 权限。",
    "- 测试：补游客、客户、管理员和异常路径。",
    "",
    "## 成片/相册专项建议",
    toMarkdownList(privateAlbumAdvice),
    "",
    "## 审查重点",
    "- 不要让客户入口访问内部 work/admin/payroll 链路。",
    "- 不要把真实密钥、AppSecret、token 或客户隐私写进日志。",
    "- 上线前检查隐私协议、类目、云存储权限和体验版素材。"
  ].join("\n");
}

function rankFilesForQuery(graph, query, limit = 12) {
  const terms = detectFeatureTerms(query);
  const normalizedTerms = terms.map((term) => term.toLowerCase());
  return Object.entries(graph.factsByFile)
    .map(([relPath, facts]) => {
      const blob = [
        relPath,
        facts.symbols?.join(" "),
        facts.collections?.join(" "),
        facts.routes?.join(" "),
        facts.imports?.join(" "),
        facts.usingComponents?.map((item) => `${item.alias} ${item.path}`).join(" "),
        facts.customTags?.join(" "),
        facts.styleImports?.join(" "),
        facts.navigationTargets?.join(" ")
      ].join("\n").toLowerCase();
      const hits = normalizedTerms.filter((term) => blob.includes(term));
      let score = hits.length * 8;
      const node = graph.nodes.find((item) => item.id === `file:${relPath}`);
      if (node) score += graph.importance?.[node.id] || 0;
      if (/route|controller|service|model|page_logic|page_view/.test(node?.type || "")) score += 5;
      return {
        path: relPath,
        type: node?.type || "file",
        hits: uniqueStrings(hits, 12),
        symbols: facts.symbols || [],
        routes: facts.routes || [],
        collections: facts.collections || [],
        score: Number(score.toFixed(2))
      };
    })
    .filter((item) => item.score > 0 || !query)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function edgeLabel(edge) {
  const labels = {
    contains: "包含",
    imports: "依赖",
    routes: "页面",
    uses_collection: "使用集合",
    uses_route: "调用路由",
    defines_route: "定义路由",
    dispatches_to: "分发",
    handled_by: "处理",
    calls_cloud_function: "调用云函数",
    uses_component: "使用组件",
    renders_component_tag: "渲染组件",
    imports_style: "样式导入",
    navigates_to: "页面跳转",
    calls_service: "调用服务",
    uses_model: "使用模型"
  };
  return labels[edge.type] || edge.type;
}

function renderRelevantContext(args = {}) {
  const query = args.query || args.goal || args.featureName || "客户成片展示小程序";
  const graph = buildMiniappGraph({ ...args, limit: args.limit || 1000 });
  const detailLevel = parseDetailLevel(args.detail_level);
  const budget = clampNumber(args.budget, 8000, 1200, 30000);
  const ranked = rankFilesForQuery(graph, query, detailLevel === "summary" ? 8 : 14);
  const coreBudget = Math.floor(budget * 0.4);
  const nearBudget = Math.floor(budget * 0.25);
  const extendedBudget = Math.floor(budget * 0.2);
  const backgroundBudget = Math.floor(budget * 0.15);
  const coreLines = [];
  let usedCore = 0;
  for (const item of ranked) {
    const facts = graph.factsByFile[item.path] || {};
    const text = [
      `### ${item.path}`,
      `- 类型：${item.type}`,
      `- 命中：${item.hits.join(", ") || "结构相关"}`,
      facts.routes?.length ? `- 路由：${facts.routes.slice(0, 8).join(", ")}` : "",
      facts.collections?.length ? `- 集合：${facts.collections.slice(0, 8).join(", ")}` : "",
      facts.symbols?.length ? `- 符号：${facts.symbols.slice(0, 10).join(", ")}` : ""
    ].filter(Boolean).join("\n");
    const tokens = estimateTokens(text);
    if (usedCore + tokens > coreBudget && coreLines.length) break;
    coreLines.push(text);
    usedCore += tokens;
  }

  const focusFileIds = new Set(ranked.map((item) => `file:${item.path}`));
  const nearEdges = graph.edges
    .filter((edge) => focusFileIds.has(edge.from) || focusFileIds.has(edge.to))
    .slice(0, detailLevel === "summary" ? 30 : 80);
  const nearLines = nearEdges.map((edge) => {
    const from = nodeById(graph, edge.from);
    const to = nodeById(graph, edge.to);
    return `- \`${from?.path || from?.name || edge.from}\` --${edgeLabel(edge)}--> \`${to?.path || to?.name || edge.to}\``;
  });

  const chains = routeChains(graph, 80)
    .filter((chain) => {
      const blob = `${chain.route} ${chain.action} ${chain.controllerPath}`.toLowerCase();
      return ranked.some((item) => blob.includes(path.basename(item.path, path.extname(item.path)).toLowerCase())) || detectFeatureTerms(query).some((term) => blob.includes(term.toLowerCase()));
    })
    .slice(0, 25);
  const privateAlbumContext = /成片|相册|album|gallery|showcase|作品/.test(String(query).toLowerCase()) ? [
    "- 客户私密相册必须从公开作品链路中拆出权限边界。",
    "- 后端至少需要校验手机号、订单码或专属 token，并支持有效期和撤销。",
    "- 云存储 fileID 不能从游客接口直接返回；需要访问日志和下载/分享记录。",
    "- 体验版、演示和截图必须使用测试素材。"
  ] : [];
  const stats = graphStatsObject(graph);
  return [
    `# 相关上下文：${query}`,
    "",
    `- 预算：约 ${budget} tokens`,
    `- 输出层级：${detailLevel}`,
    `- 扫描安全文本文件：${graph.safety.scannedSafeTextFiles}`,
    "",
    "## Core Context（最相关文件）",
    truncateByChars(coreLines.join("\n\n") || "- 暂未匹配到直接相关文件。", coreBudget * 3),
    "",
    "## Near Context（上下游关系）",
    truncateByChars(toMarkdownList(nearLines), nearBudget * 3),
    "",
    "## Extended Context（路由链路与专项提醒）",
    truncateByChars([
      "### route -> controller",
      toMarkdownList(chains.map((chain) => `\`${chain.route}\` -> ${chain.action}${chain.controllerPath ? ` -> \`${chain.controllerPath}\`` : ""}`)),
      "",
      "### 成片/私密资源提醒",
      toMarkdownList(privateAlbumContext)
    ].join("\n"), extendedBudget * 3),
    "",
    "## Background（项目背景）",
    truncateByChars([
      `- 页面数：${graph.structure.pages.length}`,
      `- 云函数数：${graph.structure.cloudFunctions.length}`,
      `- route 线索：${stats.routeCount}`,
      `- route 链路：${stats.routeChainCount}`,
      `- 集合线索：${stats.collectionCount}`,
      "- 小白读代码顺序：project.config.json -> app.json -> 页面 js/wxml/wxss/json -> cloud_helper -> 云函数 route -> controller -> service -> model"
    ].join("\n"), backgroundBudget * 3)
  ].join("\n");
}

function mermaidSafe(text) {
  return String(text || "")
    .replace(/[`"<>|{}[\]()#&]/g, "_")
    .slice(0, 80);
}

function mermaidNodeId(id) {
  return `n${contentHash(id).slice(0, 10)}`;
}

function renderDependencyDiagram(args = {}) {
  const graph = buildMiniappGraph({ ...args, limit: args.limit || 1000 });
  const target = args.target || args.featureName || "客户私密相册";
  const terms = detectFeatureTerms(target).map((term) => term.toLowerCase());
  const matchedFileIds = new Set(rankFilesForQuery(graph, target, 18).map((item) => `file:${item.path}`));
  const matchedRouteIds = new Set(
    graph.nodes
      .filter((node) => node.type === "route" && terms.some((term) => `${node.name} ${node.path}`.toLowerCase().includes(term)))
      .map((node) => node.id)
  );
  const seedIds = new Set([...matchedFileIds, ...matchedRouteIds]);
  if (!seedIds.size) {
    rankedGraphNodes(graph, 8).forEach((node) => seedIds.add(node.id));
  }
  const diagramEdges = graph.edges
    .filter((edge) => seedIds.has(edge.from) || seedIds.has(edge.to))
    .slice(0, 80);
  const diagramNodeIds = new Set();
  for (const edge of diagramEdges) {
    diagramNodeIds.add(edge.from);
    diagramNodeIds.add(edge.to);
  }
  const diagramNodes = graph.nodes.filter((node) => diagramNodeIds.has(node.id)).slice(0, 80);
  const lines = ["```mermaid", "graph LR"];
  for (const node of diagramNodes) {
    lines.push(`  ${mermaidNodeId(node.id)}["${mermaidSafe(`${node.type}: ${node.path || node.name}`)}"]`);
  }
  for (const edge of diagramEdges) {
    if (!diagramNodeIds.has(edge.from) || !diagramNodeIds.has(edge.to)) continue;
    lines.push(`  ${mermaidNodeId(edge.from)} -->|${mermaidSafe(edgeLabel(edge))}| ${mermaidNodeId(edge.to)}`);
  }
  lines.push("```");
  return [
    `# 依赖图：${target}`,
    "",
    "## Mermaid",
    lines.join("\n"),
    "",
    "## 说明",
    "- 这是轻量图谱，不执行代码，不安装外部 CodeGraph。",
    "- 节点来源于安全文本扫描；边来源于 app.json、文件包含、require/import、route、controller、云函数调用、集合访问等线索。",
    "- 如果图里没有完整链路，优先补 route.js、controller、service、model 的命名和引用规范。"
  ].join("\n");
}

function renderGraphStats(args = {}) {
  const graph = buildMiniappGraph({ ...args, limit: args.limit || 1200 });
  const stats = graphStatsObject(graph);
  return [
    "# 小程序图谱统计",
    "",
    `- 项目：\`${graph.projectRoot}\``,
    `- 生成时间：${graph.generatedAt}`,
    `- 安全文本文件：${graph.safety.scannedSafeTextFiles}`,
    `- 节点：${graph.nodes.length}`,
    `- 边：${graph.edges.length}`,
    "",
    "## 节点类型",
    toMarkdownList(Object.entries(stats.nodeCounts).sort().map(([type, count]) => `${type}: ${count}`)),
    "",
    "## 边类型",
    toMarkdownList(Object.entries(stats.edgeCounts).sort().map(([type, count]) => `${type}: ${count}`)),
    "",
    "## 结构指标",
    toMarkdownList([
      `页面：${graph.structure.pages.length}`,
      `云函数：${graph.structure.cloudFunctions.length}`,
      `route 线索：${stats.routeCount}`,
      `route -> controller 链路：${stats.routeChainCount}`,
      `controller 文件：${stats.controllerCount}`,
      `service 文件：${stats.serviceCount}`,
      `model 文件：${stats.modelCount}`,
      `集合线索：${stats.collectionCount}`,
      `组件节点：${stats.componentCount}`,
      `组件关系边：${stats.componentEdgeCount}`,
      `样式导入：${stats.styleImportCount}`,
      `页面跳转：${stats.navigationEdgeCount}`
    ]),
    "",
    "## 重要节点",
    toMarkdownList(stats.topNodes.map((node) => `${node.type} -> \`${node.path || node.name}\`（重要度 ${node.importance}）`)),
    "",
    "## 风险提示",
    toMarkdownList(stats.riskHints)
  ].join("\n");
}

function readHashCache() {
  return readJson(HASH_CACHE, { projectRoot: "", fileHashes: {}, updatedAt: "" }) || { projectRoot: "", fileHashes: {}, updatedAt: "" };
}

function projectRootCacheKey(projectRoot) {
  return contentHash(path.resolve(projectRoot)).slice(0, 16);
}

function writeGraphCache(graph) {
  ensureDir(CACHE_DIR);
  const cacheGraph = {
    version: SERVER_INFO.version,
    projectRootKey: projectRootCacheKey(graph.projectRoot),
    projectRootName: path.basename(graph.projectRoot),
    generatedAt: graph.generatedAt,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    safety: graph.safety,
    stats: graphStatsObject(graph),
    nodes: graph.nodes,
    edges: graph.edges
  };
  fs.writeFileSync(GRAPH_CACHE, JSON.stringify(cacheGraph, null, 2), "utf8");
  fs.writeFileSync(HASH_CACHE, JSON.stringify({
    version: SERVER_INFO.version,
    projectRootKey: projectRootCacheKey(graph.projectRoot),
    projectRootName: path.basename(graph.projectRoot),
    updatedAt: nowIso(),
    fileHashes: graph.fileHashes
  }, null, 2), "utf8");
}

function renderIndexStatus(args = {}) {
  const graph = buildMiniappGraph({ ...args, limit: args.limit || 1200 });
  const previous = readHashCache();
  const previousKey = previous.projectRootKey || (previous.projectRoot ? projectRootCacheKey(previous.projectRoot) : "");
  const currentKey = projectRootCacheKey(graph.projectRoot);
  const oldHashes = previousKey === currentKey ? previous.fileHashes || {} : {};
  const added = [];
  const changed = [];
  const unchanged = [];
  const removed = [];
  for (const [filePath, hash] of Object.entries(graph.fileHashes)) {
    if (!oldHashes[filePath]) added.push(filePath);
    else if (oldHashes[filePath] !== hash) changed.push(filePath);
    else unchanged.push(filePath);
  }
  for (const filePath of Object.keys(oldHashes)) {
    if (!graph.fileHashes[filePath]) removed.push(filePath);
  }
  const writeCache = args.writeCache === true;
  if (writeCache) writeGraphCache(graph);
  return [
    "# 小程序索引状态",
    "",
    `- 项目：\`${path.basename(graph.projectRoot)}\`（root key: ${currentKey}）`,
    `- 当前扫描文件：${Object.keys(graph.fileHashes).length}`,
    `- 上次缓存时间：${previous.updatedAt || "暂无"}`,
    `- 本次是否写入缓存：${writeCache ? "是" : "否，默认只读；传 writeCache=true 可更新 cache"}`,
    `- Graph cache：\`${GRAPH_CACHE}\``,
    `- Hash cache：\`${HASH_CACHE}\``,
    "",
    "## 变化摘要",
    toMarkdownList([
      `新增：${added.length}`,
      `变化：${changed.length}`,
      `未变：${unchanged.length}`,
      `移除：${removed.length}`
    ]),
    "",
    "## 新增/变化文件",
    toMarkdownList([...added.map((item) => `新增 \`${item}\``), ...changed.map((item) => `变化 \`${item}\``)].slice(0, 80)),
    "",
    "## 说明",
    "- 这是 CodeGraph 增量 file hash 思路的轻量版。",
    "- cache 只保存相对文件路径、hash、节点/边摘要、统计和项目 root hash，不保存项目绝对路径或敏感文件内容。",
    "- 默认不写 cache，避免普通扫描产生本地写入。"
  ].join("\n");
}

const MINIAPP_SECURITY_RULES = [
  {
    id: "MP-SECRET-001",
    severity: "critical",
    category: "secrets",
    pattern: /(appsecret|secretkey|secret_id|secretid|private_key|api[_-]?key)\s*[:=]/i,
    message: "疑似密钥字段出现在代码中，应移到安全配置或环境变量。"
  },
  {
    id: "MP-LOG-001",
    severity: "high",
    category: "privacy",
    pattern: /console\.(log|info|warn|error)\([^)]*(phone|mobile|手机号|订单码|token|fileID|openid|password|密码)/i,
    message: "日志可能输出手机号、订单码、token、fileID、openid 或密码。"
  },
  {
    id: "MP-FILEID-001",
    severity: "high",
    category: "storage",
    pattern: /(return|resolve|res\.)[\s\S]{0,120}(fileID|fileId|cloud:\/\/)/i,
    message: "接口可能直接返回云存储 fileID，客户私密资源需先做权限校验。"
  },
  {
    id: "MP-ALBUM-001",
    severity: "medium",
    category: "private_album",
    pattern: /(album|相册|成片|gallery)[\s\S]{0,200}(list|detail|get|asset)/i,
    message: "检测到相册/成片读取链路，需要确认是否具备访问凭证、有效期、撤销和访问日志。"
  },
  {
    id: "MP-AUTH-001",
    severity: "medium",
    category: "permission",
    pattern: /(admin\/|work\/)[A-Za-z0-9_/-]+/i,
    message: "检测到内部后台/经营路由，客户入口不得直接暴露。"
  },
  {
    id: "MP-VALIDATE-001",
    severity: "medium",
    category: "validation",
    pattern: /controller[\s\S]{0,500}(params|input|data)/i,
    message: "controller 参数处理需要确认是否使用 validateData 或等价校验。"
  },
  {
    id: "MP-DB-PERM-001",
    severity: "critical",
    category: "database_permission",
    filePattern: /(database|permission|rules|schema|config).*\.(json|js|md)$/i,
    pattern: /(read|write|permission|auth)[\s\S]{0,160}(true|all|public|anyone|游客|公开|无需登录)/i,
    message: "数据库权限疑似过宽，上线前应按游客、客户、员工、管理员拆分读写边界。"
  },
  {
    id: "MP-STORAGE-PUBLIC-001",
    severity: "critical",
    category: "storage_permission",
    pattern: /(getTempFileURL|downloadFile|fileID|fileId|cloud:\/\/|云存储)[\s\S]{0,180}(public|公开|游客|无需登录|true)/i,
    message: "云存储访问疑似公开，客户私密资源应经云函数校验后短期授权。"
  },
  {
    id: "MP-CLOUDFN-AUTH-001",
    severity: "high",
    category: "cloud_function_auth",
    pattern: /(exports\.main|controller|service|router)[\s\S]{0,420}(album|order|client|admin|相册|订单|客户|后台)/i,
    message: "敏感云函数链路需要确认登录态、角色、资源归属和管理员权限判断。"
  },
  {
    id: "MP-PRIVACY-001",
    severity: "high",
    category: "privacy",
    pattern: /(phone|mobile|手机号|订单码|openid|fileID|fileId|token)[\s\S]{0,180}(return|setData|navigateTo|share|console|url)/i,
    message: "隐私字段可能进入前端状态、分享路径、日志或接口返回，应最小化返回并脱敏。"
  },
  {
    id: "MP-FRONTEND-HARDCODE-001",
    severity: "high",
    category: "frontend_config",
    pattern: /(envId|cloudEnv|baseURL|apiBase|localhost|127\.0\.0\.1|mock|testMode|测试环境|体验版)/i,
    message: "前端疑似硬编码环境、测试地址或 mock 开关，上线前应改为受控配置。"
  },
  {
    id: "MP-TEST-FLAG-001",
    severity: "medium",
    category: "release_residue",
    pattern: /(debug|mock|testMode|isTest|demoOnly|体验版|测试开关|测试素材|占位)/i,
    message: "检测到测试/调试残留线索，正式发布前应确认已关闭或替换。"
  },
  {
    id: "MP-PROJECT-CONFIG-001",
    severity: "medium",
    category: "project_config",
    filePattern: /(^|\/)project\.config\.json$/i,
    pattern: /(appid|cloudfunctionRoot|miniprogramRoot|setting|compileType)/i,
    message: "project.config.json 需要确认只保留共享工程配置，个人私有配置不得进入公共配置。"
  }
];

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

function securityRiskRank(severity) {
  return { critical: 4, high: 3, medium: 2, low: 1, info: 0 }[severity] || 0;
}

function renderSecurityQuickScan(args = {}) {
  const projectRoot = resolveProjectRoot(args.projectPath);
  const limit = clampNumber(args.limit, 1200, 50, 3000);
  const maxFindings = clampNumber(args.maxFindings, 120, 20, 500);
  const files = listFilesRecursive(projectRoot, (filePath) => {
    const stat = safeStat(filePath);
    return isSafeTextFile(filePath) && stat && stat.size <= MAX_SAFE_TEXT_FILE_SIZE;
  }, limit);
  const findings = [];
  for (const filePath of files) {
    if (findings.length >= maxFindings) break;
    const relPath = toPosixRelative(projectRoot, filePath);
    const text = readText(filePath, 120_000);
    for (const rule of MINIAPP_SECURITY_RULES) {
      if (rule.filePattern && !rule.filePattern.test(relPath)) continue;
      const match = rule.pattern.exec(text);
      if (!match) continue;
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        category: rule.category,
        path: relPath,
        line: lineNumberForIndex(text, match.index || 0),
        message: rule.message
      });
      if (findings.length >= maxFindings) break;
    }
  }
  findings.sort((a, b) => securityRiskRank(b.severity) - securityRiskRank(a.severity) || a.path.localeCompare(b.path));
  const bySeverity = findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] || 0) + 1;
    return acc;
  }, {});
  const byCategory = findings.reduce((acc, finding) => {
    acc[finding.category] = (acc[finding.category] || 0) + 1;
    return acc;
  }, {});
  return [
    "# 小程序专项安全快扫",
    "",
    `- 项目：\`${projectRoot}\``,
    `- 扫描安全文本文件：${files.length}`,
    `- 规则数：${MINIAPP_SECURITY_RULES.length}`,
    `- 发现数：${findings.length}`,
    "",
    "## 严重级别统计",
    toMarkdownList(["critical", "high", "medium", "low", "info"].map((level) => `${level}: ${bySeverity[level] || 0}`)),
    "",
    "## 专项类别统计",
    toMarkdownList(Object.entries(byCategory).sort().map(([category, count]) => `${category}: ${count}`)),
    "",
    "## 发现列表",
    toMarkdownList(findings.map((finding) => `[${finding.severity}] ${finding.ruleId} \`${finding.path}:${finding.line}\` - ${finding.message}`)),
    "",
    "## 小程序成片交付重点复核",
    toMarkdownList([
      "客户私密相册接口是否有手机号、订单码或专属 token 校验。",
      "云存储 fileID 是否只在授权后返回，且后台可撤销访问。",
      "访问、下载、分享、后台修改是否写入日志。",
      "体验版是否全部使用测试素材。",
      "客户入口是否避开内部 work/admin/payroll/commission/payment 链路。"
    ]),
    "",
    "## 边界",
    "- 本工具只做静态规则快扫，不替代人工安全审计。",
    "- 输出不包含原始敏感匹配文本，只给路径、行号、规则和修复方向。"
  ].join("\n");
}

const tools = [
  {
    name: "miniapp_inspect_project",
    description: "扫描本地微信原生/云开发小程序工程，输出页面、tabBar、云函数、业务模块和下一步建议。",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "小程序项目根目录，默认读取包内 demo fixture。" },
        includeReadme: { type: "boolean", description: "是否包含 README 摘要，默认 true。" }
      },
      additionalProperties: false
    },
    handler: inspectProject
  },
  {
    name: "miniapp_generate_blueprint",
    description: "为一个微信小程序产品生成从产品定位、页面、数据表、云函数、UI 到上线的工程蓝图。",
    inputSchema: {
      type: "object",
      properties: {
        productName: { type: "string" },
        brandName: { type: "string" },
        depth: { type: "string", enum: ["mvp", "full"] },
        linkExistingProject: { type: "boolean" }
      },
      additionalProperties: false
    },
    handler: generateBlueprint
  },
  {
    name: "miniapp_showcase_roadmap",
    description: "为客户成片展示小程序输出小白可执行路线图：业务定位、MVP 边界、阶段 SOP、页面、数据、CloudBase、隐私和上线清单。",
    inputSchema: {
      type: "object",
      properties: {
        brandName: { type: "string", description: "品牌名，默认示例摄影工作室。" },
        depth: { type: "string", enum: ["mvp", "full"], description: "路线图深度，默认 mvp。" },
        phase: { type: "string", enum: ["all", "business", "pages", "data", "cloudbase", "privacy", "launch"], description: "只看某个阶段，默认 all。" },
        audience: { type: "string", enum: ["beginner", "operator"], description: "读者类型，默认 beginner。" }
      },
      additionalProperties: false
    },
    handler: miniappShowcaseRoadmap
  },
  {
    name: "miniapp_work_breakdown",
    description: "把功能拆成需求、UI、前端、后端、测试、上线六类任务清单。",
    inputSchema: {
      type: "object",
      properties: {
        featureName: { type: "string" },
        phase: { type: "string", enum: ["all", "requirements", "ui", "frontend", "backend", "qa", "launch"] }
      },
      additionalProperties: false
    },
    handler: workBreakdown
  },
  {
    name: "miniapp_launch_checklist",
    description: "生成微信小程序上线前检查清单，包含云开发、隐私、审核、客户私密相册交付。",
    inputSchema: {
      type: "object",
      properties: {
        includePrivateAlbum: { type: "boolean" }
      },
      additionalProperties: false
    },
    handler: launchChecklist
  },
  {
    name: "miniapp_docs_lookup",
    description: "按主题查询本地整理的小程序官方文档、GitHub 项目和工程工具索引。",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "例如 cloudbase、ui、deploy、framework、ci。" }
      },
      additionalProperties: false
    },
    handler: docsLookup
  },
  {
    name: "miniapp_cloudbase_mcp_guide",
    description: "输出 CloudBase MCP 与本地小程序工程顾问 MCP 的组合使用说明和安全边界。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    handler: cloudbaseMcpGuide
  },
  {
    name: "local_user_profile",
    description: "读取本地规则后提炼的工作画像，包括沟通、交付、安全、知识库和编码习惯。",
    inputSchema: {
      type: "object",
      properties: {
        includeSources: { type: "boolean", description: "是否包含读取来源摘要，默认 false。" }
      },
      additionalProperties: false
    },
    handler: localUserProfile
  },
  {
    name: "local_skill_routing",
    description: "根据已安装 Codex/Claude/agents 技能，输出适合小程序工程的技能路由和使用建议。",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "可按主题过滤，例如 security、ui、search、video、marketing。" }
      },
      additionalProperties: false
    },
    handler: localSkillRouting
  },
  {
    name: "local_mcp_optimization_advice",
    description: "基于本地 Codex/Claude 文档和当前小程序工程，输出这个 MCP 的优化建议。",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "要优化的 MCP 名称。" }
      },
      additionalProperties: false
    },
    handler: localMcpOptimizationAdvice
  },
  {
    name: "yunyu_query_context",
    description: "调用本机本地知识库路由检索，读取和当前小程序/业务相关的上下文。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        confirmed: { type: "boolean", description: "读取目标包外本地知识库前的显式确认；默认 false，不执行读取。" }
      },
      additionalProperties: false
    },
    handler: queryYunyuContext
  },
  {
    name: "local_mcp_append_optimization_log",
    description: "追加 MCP 优化日志，记录用户思路、Codex 决策摘要、引用技能、文件改动、验证结果和安全边界。",
    inputSchema: {
      type: "object",
      properties: {
        roundType: { type: "string", description: "例如 initial-summary、optimization、verification、skill-embedding。" },
        outcome: { type: "string", description: "本轮结果：success、partial 或 blocked。" },
        actor: { type: "string", description: "记录人，默认 codex。" },
        summary: { type: "string", description: "本轮优化摘要。" },
        userIdeas: { type: "array", items: { type: "string" } },
        codexDecisions: { type: "array", items: { type: "string" } },
        skillsReferenced: { type: "array", items: { type: "string" } },
        subagentSummary: { type: "array", items: { type: "string" } },
        filesChanged: { type: "array", items: { type: "string" } },
        verification: { type: "array", items: { type: "string" } },
        safetyNotes: { type: "array", items: { type: "string" } },
        nextActions: { type: "array", items: { type: "string" } },
        notes: { type: "array", items: { type: "string" } }
      },
      additionalProperties: false
    },
    handler: appendOptimizationLog
  },
  {
    name: "local_mcp_read_optimization_log",
    description: "读取 MCP 优化日志，默认返回最近 10 条 Markdown 记录。",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "读取最近多少条，1-100，默认 10。" },
        format: { type: "string", enum: ["markdown", "json"], description: "返回格式，默认 markdown。" }
      },
      additionalProperties: false
    },
    handler: readOptimizationLog
  },
  {
    name: "local_mcp_optimization_log_status",
    description: "查看 MCP 优化日志状态、路径、记录数和强制记录规则。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    handler: optimizationLogStatus
  },
  {
    name: "miniapp_project_map",
    description: "借鉴 Understand-Anything 的知识图谱思路，生成本地小程序项目地图：页面、文件、云函数、集合和依赖边。",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "小程序项目根目录，默认读取配置里的当前项目。" },
        limit: { type: "number", description: "最多扫描多少个安全文本文件，默认 700。" },
        format: { type: "string", enum: ["markdown", "json"], description: "默认 markdown；json 返回轻量图谱数据。" },
        detail_level: { type: "string", enum: ["summary", "standard", "full"], description: "输出详细程度，默认 standard。" }
      },
      additionalProperties: false
    },
    handler: miniappProjectMap
  },
  {
    name: "miniapp_understand_project_flow",
    description: "面向小白解释一个小程序从需求、UI、前端、后端、数据、测试到上线的完整工程流程。",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        goal: { type: "string", description: "要理解或建设的产品目标，例如客户成片展示小程序。" },
        limit: { type: "number", description: "最多扫描多少个安全文本文件，默认 900。" }
      },
      additionalProperties: false
    },
    handler: understandProjectFlow
  },
  {
    name: "miniapp_understand_file_role",
    description: "解释某个项目内文件在微信小程序工程里的角色、上下游线索和小白下一步。",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        filePath: { type: "string", description: "项目内相对路径或项目内绝对路径。" },
        focus: { type: "string", description: "希望重点理解的方向。" }
      },
      required: ["filePath"],
      additionalProperties: false
    },
    handler: understandFileRole
  },
  {
    name: "miniapp_understand_feature_impact",
    description: "输入一个功能名，分析可能影响的页面、云函数、数据集合、权限、测试和上线风险。",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        featureName: { type: "string", description: "例如客户成片展示、私密相册、预约咨询、套餐展示。" },
        limit: { type: "number", description: "最多返回多少个命中文件，默认 80。" }
      },
      additionalProperties: false
    },
    handler: understandFeatureImpact
  },
  {
    name: "miniapp_relevant_context",
    description: "融合 CodeGraph 的 4-tier context 思路，按任务输出 Core/Near/Extended/Background 四层小程序工程上下文。",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        query: { type: "string", description: "要收集上下文的任务或问题，例如客户私密相册、预约咨询、后台订单审核。" },
        goal: { type: "string", description: "可替代 query 的目标描述。" },
        featureName: { type: "string", description: "可替代 query 的功能名。" },
        budget: { type: "number", description: "上下文预算，约 1200-30000 tokens，默认 8000。" },
        detail_level: { type: "string", enum: ["summary", "standard", "full"] },
        limit: { type: "number", description: "最多扫描多少个安全文本文件，默认 1000。" }
      },
      additionalProperties: false
    },
    handler: renderRelevantContext
  },
  {
    name: "miniapp_dependency_diagram",
    description: "生成小程序页面、文件、路由、云函数、controller、集合之间的 Mermaid 依赖图。",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        target: { type: "string", description: "图谱聚焦目标，例如客户私密相册、album、预约咨询。" },
        featureName: { type: "string", description: "可替代 target 的功能名。" },
        limit: { type: "number", description: "最多扫描多少个安全文本文件，默认 1000。" }
      },
      additionalProperties: false
    },
    handler: renderDependencyDiagram
  },
  {
    name: "miniapp_graph_stats",
    description: "输出小程序轻量代码图谱统计：节点/边类型、route 链路、重要节点和风险提示。",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        limit: { type: "number", description: "最多扫描多少个安全文本文件，默认 1200。" }
      },
      additionalProperties: false
    },
    handler: renderGraphStats
  },
  {
    name: "miniapp_index_status",
    description: "融合 CodeGraph 增量索引思路，计算安全文本文件 hash，报告与本地 cache 的新增/变化/移除状态。",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        limit: { type: "number", description: "最多扫描多少个安全文本文件，默认 1200。" },
        writeCache: { type: "boolean", description: "是否写入本地 cache，默认 false。" }
      },
      additionalProperties: false
    },
    handler: renderIndexStatus
  },
  {
    name: "miniapp_security_quick_scan",
    description: "小程序上线专项安全快扫，检查密钥字段、敏感日志、数据库权限、云存储访问、云函数权限、隐私字段、测试残留和配置边界。",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        limit: { type: "number", description: "最多扫描多少个安全文本文件，默认 1200。" },
        maxFindings: { type: "number", description: "最多返回多少条发现，默认 120。" }
      },
      additionalProperties: false
    },
    handler: renderSecurityQuickScan
  }
];

const prompts = [
  {
    name: "miniapp_product_manager",
    description: "让 AI 以产品经理方式梳理微信小程序需求和版本边界。",
    arguments: [
      { name: "idea", description: "小程序想法或功能", required: true }
    ]
  },
  {
    name: "miniapp_engineering_reviewer",
    description: "让 AI 审查页面、数据表、云函数、权限和上线清单是否完整。",
    arguments: [
      { name: "plan", description: "已有方案或工程蓝图", required: true }
    ]
  },
  {
    name: "miniapp_xiaoli_engineering_planner",
    description: "按本地工作习惯规划微信小程序工程，从业务、UI、前后端、测试、上线拆清单。",
    arguments: [
      { name: "goal", description: "小程序目标或功能", required: true }
    ]
  }
];

function getPrompt(name, args = {}) {
  if (name === "miniapp_product_manager") {
    return {
      description: "微信小程序产品经理提示词",
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `请按小白能理解的方式，把这个微信小程序想法拆成：目标用户、使用场景、页面清单、数据表、云函数、UI 设计、前端任务、后端任务、测试清单、上线清单。想法：${args.idea || ""}`
        }
      }]
    };
  }
  if (name === "miniapp_engineering_reviewer") {
    return {
      description: "微信小程序工程审查提示词",
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `请审查下面的小程序方案，重点找遗漏：权限、云存储、数据库集合、云函数、客户隐私、上线审核、异常状态、后台管理。方案：\n${args.plan || ""}`
        }
      }]
    };
  }
  if (name === "miniapp_xiaoli_engineering_planner") {
    return {
      description: "按本地工作习惯的小程序工程规划提示词",
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `请按本地工作习惯规划这个微信小程序目标：${args.goal || ""}\n\n要求：默认中文；先给结论和推荐路线；再拆成引流/利润/形象产品（如适用）；再列页面、数据表、云函数、UI、前端、后端、测试、上线清单；涉及本地业务资料先提示应确认读取知识库；涉及外发、部署、权限、客户隐私时列出确认项；不要默认引入跨端框架。`
        }
      }]
    };
  }
  throw new Error(`Unknown prompt: ${name}`);
}

const resources = [
  {
    uri: "miniapp://docs/index",
    name: "小程序工程资料索引",
    description: "官方文档、GitHub 项目和推荐工具索引。",
    mimeType: "application/json"
  },
  {
    uri: "miniapp://project/current",
    name: "当前小程序工程扫描",
    description: "扫描默认配置里的 demo 小程序 fixture。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://checklists/launch",
    name: "上线检查清单",
    description: "微信小程序上线前检查清单。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://roadmap/showcase",
    name: "客户成片展示小程序路线图",
    description: "面向小白的客户成片展示小程序 SOP、页面、数据、CloudBase、隐私和上线路线图。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://cloudbase/mcp-guide",
    name: "CloudBase MCP 使用说明",
    description: "CloudBase MCP 配置说明、安全边界和分工。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://user/profile",
    name: "本地工作画像",
    description: "从本机 Codex/Claude 文档提炼的沟通、交付、安全、知识库和编码习惯。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://user/skill-routing",
    name: "本地技能路由建议",
    description: "从已安装技能提炼的小程序工程技能使用建议。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://audit/optimization-advice",
    name: "MCP 优化建议",
    description: "基于本地 Codex/Claude 文档和现有小程序工程的 MCP 优化建议。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://audit/optimization-log",
    name: "MCP 优化日志",
    description: "MCP 优化、技能嵌入、配置修改和验证记录。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://audit/optimization-log/latest",
    name: "MCP 最新优化日志",
    description: "最近一条 MCP 优化日志。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://audit/optimization-log/status",
    name: "MCP 优化日志状态",
    description: "日志路径、记录数和强制记录规则。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://understand/project-map",
    name: "当前小程序项目地图",
    description: "当前默认项目的轻量知识图谱和读代码顺序。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://understand/project-flow",
    name: "当前小程序全流程理解",
    description: "面向小白解释当前小程序从需求到上线的完整流程。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://understand/relevant-context",
    name: "当前小程序相关上下文",
    description: "按 Core/Near/Extended/Background 四层输出客户成片展示相关上下文。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://understand/dependency-diagram",
    name: "当前小程序依赖图",
    description: "客户私密相册相关页面、路由、controller、集合 Mermaid 图。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://understand/graph-stats",
    name: "当前小程序图谱统计",
    description: "节点/边统计、重要节点、route 链路和风险提示。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://audit/security-quick-scan",
    name: "小程序专项安全快扫",
    description: "客户私密相册、云存储、敏感日志、内部路由暴露风险快扫。",
    mimeType: "text/markdown"
  },
  {
    uri: "miniapp://understand/index-status",
    name: "当前小程序索引状态",
    description: "安全文本文件 hash 与本地 cache 的变化状态。",
    mimeType: "text/markdown"
  }
];

function readResource(uri) {
  if (uri === "miniapp://docs/index") return JSON.stringify(docs, null, 2);
  if (uri === "miniapp://project/current") return inspectProject({ includeReadme: false });
  if (uri === "miniapp://checklists/launch") return launchChecklist({});
  if (uri === "miniapp://roadmap/showcase") return miniappShowcaseRoadmap({});
  if (uri === "miniapp://cloudbase/mcp-guide") return cloudbaseMcpGuide();
  if (uri === "miniapp://user/profile") return localUserProfile({});
  if (uri === "miniapp://user/skill-routing") return localSkillRouting({});
  if (uri === "miniapp://audit/optimization-advice") return localMcpOptimizationAdvice({});
  if (uri === "miniapp://audit/optimization-log") return readOptimizationLog({ limit: 20 });
  if (uri === "miniapp://audit/optimization-log/latest") return readOptimizationLog({ limit: 1 });
  if (uri === "miniapp://audit/optimization-log/status") return optimizationLogStatus();
  if (uri === "miniapp://understand/project-map") return miniappProjectMap({});
  if (uri === "miniapp://understand/project-flow") return understandProjectFlow({});
  if (uri === "miniapp://understand/relevant-context") return renderRelevantContext({ query: "客户成片展示 私密相册 预约咨询" });
  if (uri === "miniapp://understand/dependency-diagram") return renderDependencyDiagram({ target: "客户私密相册" });
  if (uri === "miniapp://understand/graph-stats") return renderGraphStats({});
  if (uri === "miniapp://audit/security-quick-scan") return renderSecurityQuickScan({});
  if (uri === "miniapp://understand/index-status") return renderIndexStatus({});
  throw new Error(`Unknown resource: ${uri}`);
}

function result(id, payload) {
  return { jsonrpc: "2.0", id, result: payload };
}

function error(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

class McpError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function valueMatchesSchemaType(value, expectedType) {
  if (expectedType === "array") return Array.isArray(value);
  if (expectedType === "object") return value && typeof value === "object" && !Array.isArray(value);
  if (expectedType === "number") return typeof value === "number" && Number.isFinite(value);
  if (expectedType === "boolean") return typeof value === "boolean";
  if (expectedType === "string") return typeof value === "string";
  return true;
}

function validateToolArguments(tool, args) {
  const schema = tool.inputSchema || {};
  const properties = schema.properties || {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  if (!valueMatchesSchemaType(args, "object")) {
    throw new McpError(-32602, `Invalid params for ${tool.name}: arguments must be an object.`);
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(args, key)) {
      throw new McpError(-32602, `Invalid params for ${tool.name}: missing required field "${key}".`);
    }
  }
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(args)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) {
        throw new McpError(-32602, `Invalid params for ${tool.name}: unknown field "${key}".`);
      }
    }
  }
  for (const [key, value] of Object.entries(args)) {
    const prop = properties[key];
    if (!prop) continue;
    if (prop.type && !valueMatchesSchemaType(value, prop.type)) {
      throw new McpError(-32602, `Invalid params for ${tool.name}: field "${key}" must be ${prop.type}.`);
    }
    if (Array.isArray(prop.enum) && !prop.enum.includes(value)) {
      throw new McpError(-32602, `Invalid params for ${tool.name}: field "${key}" must be one of ${prop.enum.join(", ")}.`);
    }
    if (prop.type === "array" && prop.items?.type) {
      const invalidIndex = value.findIndex((item) => !valueMatchesSchemaType(item, prop.items.type));
      if (invalidIndex >= 0) {
        throw new McpError(-32602, `Invalid params for ${tool.name}: field "${key}" item ${invalidIndex} must be ${prop.items.type}.`);
      }
    }
  }
}

async function handleRequest(message) {
  if (!message || message.jsonrpc !== "2.0") return;
  if (message.id === undefined && String(message.method || "").startsWith("notifications/")) return;
  const id = message.id;
  try {
    switch (message.method) {
      case "initialize":
        send(result(id, {
          protocolVersion: message.params?.protocolVersion || "2024-11-05",
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: SERVER_INFO
        }));
        return;
      case "tools/list":
        send(result(id, {
          tools: tools.map(({ handler, ...tool }) => tool)
        }));
        return;
      case "tools/call": {
        const name = message.params?.name;
        const args = message.params?.arguments || {};
        const tool = tools.find((item) => item.name === name);
        if (!tool) throw new McpError(-32601, `Unknown tool: ${name}`);
        validateToolArguments(tool, args);
        const text = await tool.handler(args);
        send(result(id, { content: [{ type: "text", text }] }));
        return;
      }
      case "resources/list":
        send(result(id, { resources }));
        return;
      case "resources/read": {
        const uri = message.params?.uri;
        const text = readResource(uri);
        const resource = resources.find((item) => item.uri === uri);
        send(result(id, {
          contents: [{
            uri,
            mimeType: resource?.mimeType || "text/plain",
            text
          }]
        }));
        return;
      }
      case "prompts/list":
        send(result(id, { prompts }));
        return;
      case "prompts/get": {
        const prompt = getPrompt(message.params?.name, message.params?.arguments || {});
        send(result(id, prompt));
        return;
      }
      case "ping":
        send(result(id, {}));
        return;
      default:
        send(error(id, -32601, `Method not found: ${message.method}`));
    }
  } catch (err) {
    send(error(id, err instanceof McpError ? err.code : -32000, err instanceof Error ? err.message : String(err)));
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const message = JSON.parse(trimmed);
    void handleRequest(message);
  } catch (err) {
    send(error(null, -32700, err instanceof Error ? err.message : String(err)));
  }
});

process.stderr.write(`${SERVER_INFO.name} ${SERVER_INFO.version} ready\n`);
