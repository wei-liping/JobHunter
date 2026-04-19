#!/usr/bin/env node
/**
 * 本地抓取 AI 产品经理相关岗位，合并写入 public/data/jobs-ai-pm.json。
 * 需要：已登录 BOSS 的 bb-browser、本仓库根目录执行。
 *
 *   npm run snapshot:ai-pm
 *
 * 节奏可通过环境变量调节，见 README「在线演示模式」。
 */

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outPath = path.join(root, "public", "data", "jobs-ai-pm.json");
const scriptPath = path.join(
  root,
  "tools",
  "bb_browser_boss",
  "collect_boss_jobs.js",
);

const KEYWORDS = [
  "AI产品经理",
  "人工智能产品经理",
  "AIGC产品经理",
  "大模型产品经理",
  "LLM产品经理",
];

const CITIES = [
  { code: "101010100", label: "北京" },
  { code: "101020100", label: "上海" },
  { code: "101280100", label: "广州" },
  { code: "101280600", label: "深圳" },
  { code: "101210100", label: "杭州" },
  { code: "101190400", label: "苏州" },
  { code: "101190100", label: "南京" },
];

function parseEnvPositiveInt(key, fallback) {
  const raw = process.env[key];
  if (raw == null || !String(raw).trim()) return fallback;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function parseEnvSecondsToMs(key, defaultSeconds) {
  const raw = process.env[key];
  if (raw == null || !String(raw).trim()) {
    return Math.round(Number(defaultSeconds) * 1000);
  }
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) {
    return Math.round(Number(defaultSeconds) * 1000);
  }
  return Math.round(n * 1000);
}

function parseEnvRatio(key, defaultRatio) {
  const raw = process.env[key];
  if (raw == null || !String(raw).trim()) return defaultRatio;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n)) return defaultRatio;
  return Math.min(1, Math.max(0, n));
}

const PAGES = parseEnvPositiveInt("JOBHUNTER_SNAPSHOT_PAGES", 3);
const MAX_JOBS = parseEnvPositiveInt("JOBHUNTER_SNAPSHOT_MAX_JOBS", 40);
const COMBO_SLEEP_MS = parseEnvSecondsToMs("JOBHUNTER_SNAPSHOT_COMBO_SLEEP", 20);
const COOLDOWN_MS = parseEnvSecondsToMs("JOBHUNTER_SNAPSHOT_COOLDOWN_SLEEP", 300);
const JITTER_RATIO = parseEnvRatio("JOBHUNTER_SNAPSHOT_JITTER_RATIO", 0.4);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sleepWithJitter(baseMs, jitterRatio) {
  const j = Math.min(1, Math.max(0, Number(jitterRatio) || 0));
  const r = j * (Math.random() * 2 - 1);
  const ms = Math.max(0, Math.round(baseMs * (1 + r)));
  return sleep(ms);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cuidLike() {
  return `c${randomBytes(12).toString("hex").slice(0, 24)}`;
}

function normUrl(u) {
  if (!u || typeof u !== "string") return "";
  return u.trim();
}

function dedupeKey(row) {
  const u = normUrl(row.job_url);
  if (u) return `url:${u}`;
  const t = String(row.job_name || "").trim();
  const c = String(row.company_name || "").trim();
  return `tc:${t}::${c}`;
}

function rowToJob(row, cityCode, snapshotAt, id) {
  const jd = String(row.jd || "").trim() || "（暂无 JD 文本）";
  const skills = Array.isArray(row.skills)
    ? row.skills.map((s) => String(s))
    : [];
  const url = normUrl(row.job_url) || null;
  return {
    id,
    title: String(row.job_name || "").trim() || "未命名岗位",
    company: String(row.company_name || "").trim() || "未知公司",
    salary: row.salary ? String(row.salary) : null,
    jdText: jd,
    requirements: skills,
    url,
    platform: "BOSS",
    companyInfo: {},
    createdAt: snapshotAt,
    updatedAt: snapshotAt,
    demoMeta: {
      city: String(row.city || "").trim() || undefined,
      experience: String(row.experience || "").trim() || "不限",
      education: String(row.degree || "").trim() || "不限",
      companySize: String(row.company_scale || "").trim() || "不限",
      searchKeyword: String(row.search_keyword || "").trim() || undefined,
      cityCode,
    },
  };
}

/**
 * @returns {Promise<{ risk: boolean; snapshotExport: unknown[]; message?: string }>}
 */
async function runOne(keyword, cityCode) {
  const node = process.execPath;
  const args = [
    scriptPath,
    "--keyword",
    keyword,
    "--city-code",
    cityCode,
    "--page-start",
    "1",
    "--pages",
    String(PAGES),
    "--max-jobs",
    String(MAX_JOBS),
    "--snapshot-export",
    "--fetch-details",
  ];
  const { stdout } = await execFileAsync(node, args, {
    cwd: root,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 20 * 60 * 1000,
    env: { ...process.env },
  });
  const body = JSON.parse(stdout);
  const exportRows = Array.isArray(body.snapshotExport) ? body.snapshotExport : [];
  if (!body.ok) {
    if (body.error === "boss_risk_triggered") {
      return {
        risk: true,
        snapshotExport: exportRows,
        message: body.message || body.error,
      };
    }
    throw new Error(body.message || body.error || "crawl failed");
  }
  return { risk: false, snapshotExport: exportRows };
}

function mergeRowsIntoMaps(rows, cityCode, snapshotAt, idByKey, merged) {
  for (const row of rows) {
    const key = dedupeKey(row);
    const prevId = idByKey.get(key);
    const id = prevId || merged.get(key)?.id || cuidLike();
    idByKey.set(key, id);
    merged.set(key, rowToJob(row, cityCode, snapshotAt, id));
  }
}

async function writeSnapshotFile(snapshotAt, merged, out) {
  const jobs = [...merged.values()]
    .map((j) => ({ ...j, updatedAt: snapshotAt }))
    .sort((a, b) =>
      `${a.company}${a.title}`.localeCompare(`${b.company}${b.title}`, "zh"),
    );
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(
    out,
    `${JSON.stringify({ snapshotAt, jobs }, null, 2)}\n`,
    "utf8",
  );
  return jobs.length;
}

async function main() {
  let existing = { snapshotAt: "", jobs: [] };
  try {
    const raw = await readFile(outPath, "utf8");
    existing = JSON.parse(raw);
  } catch {
    // no file yet
  }
  const idByKey = new Map();
  const merged = new Map();
  for (const j of existing.jobs || []) {
    const k = j.url ? `url:${j.url}` : `tc:${j.title}::${j.company}`;
    idByKey.set(k, j.id);
    merged.set(k, j);
  }

  const snapshotAt = new Date().toISOString();

  const combos = [];
  for (const kw of KEYWORDS) {
    for (const city of CITIES) {
      combos.push({ kw, city });
    }
  }
  shuffleInPlace(combos);
  const total = combos.length;

  let consecutiveRisk = 0;

  for (let i = 0; i < combos.length; i += 1) {
    const { kw, city } = combos[i];
    const { code, label } = city;
    const remainingAfter = total - i - 1;

    if (i > 0) {
      await sleepWithJitter(COMBO_SLEEP_MS, JITTER_RATIO);
    }

    console.error(
      `[snapshot-ai-pm] 组 ${i + 1}/${total}（本组后还剩 ${remainingAfter} 组）关键词「${kw}」${label} (${code}) · 当前累积 ${merged.size} 条`,
    );

    try {
      const result = await runOne(kw, code);
      if (result.risk) {
        consecutiveRisk += 1;
        console.error(
          `[snapshot-ai-pm] ⚠ BOSS 风控触发（boss_risk_triggered），本组部分结果已保留。连续第 ${consecutiveRisk} 次。`,
        );
        if (result.message) {
          console.error(`[snapshot-ai-pm]   ${result.message}`);
        }
        mergeRowsIntoMaps(
          result.snapshotExport,
          code,
          snapshotAt,
          idByKey,
          merged,
        );
        console.error(
          `[snapshot-ai-pm] 合并后累积 ${merged.size} 条（含部分抓取）`,
        );

        if (consecutiveRisk >= 2) {
          const n = await writeSnapshotFile(snapshotAt, merged, outPath);
          console.error(
            `[snapshot-ai-pm] 已连续两次触发风控，停止后续组。已写入 ${n} 条到 ${outPath}。请 10–30 分钟后再跑，或换账号登录 bb-browser，或增大 JOBHUNTER_SNAPSHOT_COMBO_SLEEP（如 60）。`,
          );
          process.exit(2);
        }

        console.error(
          `[snapshot-ai-pm] 进入冷却 ${Math.round(COOLDOWN_MS / 1000)}s 后继续…`,
        );
        await sleep(COOLDOWN_MS);
        continue;
      }

      consecutiveRisk = 0;
      mergeRowsIntoMaps(
        result.snapshotExport,
        code,
        snapshotAt,
        idByKey,
        merged,
      );
      console.error(
        `[snapshot-ai-pm] 本组完成，累积 ${merged.size} 条`,
      );
    } catch (e) {
      console.error(
        `[snapshot-ai-pm] 跳过 ${kw} @ ${label}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  const n = await writeSnapshotFile(snapshotAt, merged, outPath);
  console.error(`[snapshot-ai-pm] 全部完成，共 ${n} 条，写入 ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
