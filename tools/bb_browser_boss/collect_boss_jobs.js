#!/usr/bin/env node

const { execFileSync } = require("child_process");

const BB_BROWSER_BIN = process.env.JOBHUNTER_BB_BROWSER_BIN || "bb-browser";
const BB_PORT = process.env.BB_PORT || "19999";

class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

function parseArgs(argv) {
  const options = {
    keyword: "",
    cityCode: "101280600",
    pageStart: 1,
    pages: 1,
    maxJobs: 30,
    importBase: "",
    stream: false,
    fetchDetails: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--keyword" && next) {
      options.keyword = next;
      index += 1;
    } else if (arg === "--page-start" && next) {
      options.pageStart = Math.max(1, Number(next) || 1);
      index += 1;
    } else if (arg === "--city-code" && next) {
      options.cityCode = next;
      index += 1;
    } else if (arg === "--pages" && next) {
      options.pages = Math.max(1, Number(next) || 1);
      index += 1;
    } else if (arg === "--max-jobs" && next) {
      options.maxJobs = Math.max(1, Number(next) || 10);
      index += 1;
    } else if (arg === "--import-base" && next) {
      options.importBase = next;
      index += 1;
    } else if (arg === "--stream") {
      options.stream = true;
    } else if (arg === "--fetch-details") {
      options.fetchDetails = true;
    } else if (arg === "--no-fetch-details") {
      options.fetchDetails = false;
    }
  }

  if (!options.keyword.trim()) {
    throw new AppError("invalid_request", "缺少关键词参数 --keyword");
  }

  return options;
}

function emitEvent(enabled, type, data) {
  if (!enabled) return;
  process.stdout.write(`${JSON.stringify({ type, data }, null, 0)}\n`);
}

function writeJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeInline(value) {
  return value == null
    ? ""
    : String(value)
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n+/g, " / ")
        .trim();
}

function normalizeBlock(value) {
  return value == null
    ? ""
    : String(value)
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function runBbBrowser(args) {
  const fullArgs = ["--port", BB_PORT, ...args, "--json"];
  try {
    const stdout = execFileSync(BB_BROWSER_BIN, fullArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsed = JSON.parse(stdout);
    if (!parsed.success) {
      throw new AppError("bb_browser_failed", parsed.error || "bb-browser command failed");
    }
    return parsed.data;
  } catch (error) {
    const stderr = normalizeInline(error.stderr || "");
    const stdout = normalizeInline(error.stdout || "");
    const rawMessage = stderr || stdout || error.message || "bb-browser command failed";
    if (String(rawMessage).includes("not found") || String(error.code || "").includes("ENOENT")) {
      throw new AppError(
        "bb_browser_missing",
        "未检测到 bb-browser。请先安装并确认命令可在终端里直接执行。",
      );
    }
    throw new AppError("bb_browser_failed", rawMessage);
  }
}

async function runBbBrowserWithRetry(args, retries = 2, delayMs = 800) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return runBbBrowser(args);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}

function extractSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const from = text.slice(start + startMarker.length);
  const end = endMarker ? from.indexOf(endMarker) : -1;
  return normalizeInline(end === -1 ? from : from.slice(0, end));
}

function extractSectionRaw(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const from = text.slice(start + startMarker.length);
  const end = endMarker ? from.indexOf(endMarker) : -1;
  return end === -1 ? from : from.slice(0, end);
}

function cleanFallbackJD(rawText) {
  const lines = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const cleaned = [];
  let started = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] || "";
    if (line === "职位描述") continue;
    if (/(刚刚活跃|今日活跃|\d+日内活跃)$/.test(line)) break;
    if (/^(竞争力分析|查看完整个人竞争力|个人综合排名：|你在？位置|一般 良好 优秀 极好|BOSS 安全提示)$/.test(line)) break;
    if (/^[\u4e00-\u9fa5]{1,4}(女士|先生|老师)$/.test(line) && /(刚刚活跃|今日活跃|\d+日内活跃)$/.test(nextLine)) {
      break;
    }

    const looksLikeTag =
      !started &&
      line.length <= 20 &&
      !/[：:，。,；;、0-9]/.test(line) &&
      /(产品|运营|内容|社交|直播|中后台|B端|C端|AI|工具|海外|社区)/.test(line);

    if (looksLikeTag) continue;
    started = true;
    cleaned.push(line);
  }

  return normalizeBlock(cleaned.join("\n"));
}

function isWeakJD(text) {
  const normalized = normalizeInline(text);
  if (!normalized) return true;
  if (normalized.length < 20) return true;
  if (!/[：:，。,；;、]/.test(normalized) && normalized.length < 40) return true;
  return false;
}

function uniqueJobKey(job) {
  return (
    normalizeInline(job.url) ||
    normalizeInline(job.job_url) ||
    normalizeInline(job.securityId) ||
    `${normalizeInline(job.name)}::${normalizeInline(job.company)}::${normalizeInline(job.salary)}`
  );
}

function mapDisplayJob(row) {
  return {
    id: row.security_id,
    title: row.job_name,
    company: row.company_name || "待确认公司",
    salary: row.salary || "薪资面议",
    city: row.city || row.location || "未知城市",
    experience: row.experience || "不限",
    education: row.degree || "不限",
    companySize: row.company_scale || "不限",
    platform: "BOSS直聘",
    url: row.job_url || null,
    score: 0,
    detailStatus: row.crawl_status || "",
    order: typeof row.order_index === "number" ? row.order_index : undefined,
  };
}

async function fetchPageFallback(url) {
  runBbBrowser(["open", url]);
  await sleep(2200);
  const evalResult = await runBbBrowserWithRetry(["eval", "document.body.innerText"], 2, 1000);
  const rawText = String(evalResult?.result || "");
  const text = normalizeInline(rawText);
  return {
    jd: cleanFallbackJD(extractSectionRaw(rawText, "职位描述", "BOSS 安全提示")),
    company_intro: extractSection(text, "公司介绍", "工商信息"),
    address: extractSection(text, "工作地址", "点击查看地图"),
  };
}

function buildListSummary(job) {
  const lines = [
    `职位：${normalizeInline(job.name)}`,
    `公司：${normalizeInline(job.company)}`,
    `薪资：${normalizeInline(job.salary)}`,
    `城市：${normalizeInline(job.city)}`,
    `经验：${normalizeInline(job.experience)}`,
    `学历：${normalizeInline(job.degree)}`,
  ].filter(Boolean);
  return normalizeBlock(lines.join("\n"));
}

function mergeDetailAndFallback(detailDescription, pageFallbackJd, listSummary) {
  const detailText = normalizeBlock(detailDescription);
  const fallbackText = normalizeBlock(pageFallbackJd);
  if (!isWeakJD(detailText)) return detailText;
  if (!isWeakJD(fallbackText)) return fallbackText;
  return [detailText, fallbackText, listSummary].filter(Boolean).join("\n\n");
}

function looksLikeLoggedOut(homeState) {
  const text = normalizeInline(homeState?.text || "");
  if (!text) return false;
  const hasLoginMarker = /(登录|注册|扫码登录|密码登录|短信登录)/.test(text);
  const hasLoggedInMarker = /(推荐职位|在线简历|牛人|我的|职位搜索)/.test(text);
  return hasLoginMarker && !hasLoggedInMarker;
}

async function ensureBossSessionReady(stream) {
  runBbBrowser(["open", "https://www.zhipin.com"]);
  await sleep(1800);
  const evalResult = await runBbBrowserWithRetry(
    [
      "eval",
      "JSON.stringify({ url: window.location.href, text: document.body.innerText.slice(0, 2500) })",
    ],
    2,
    800,
  );
  let homeState = null;
  try {
    homeState = JSON.parse(String(evalResult?.result || "{}"));
  } catch {
    homeState = { text: String(evalResult?.result || "") };
  }
  if (looksLikeLoggedOut(homeState)) {
    emitEvent(stream, "error", {
      error: "boss_not_logged_in",
      message: "未检测到可用的 BOSS 登录会话。请先在本机浏览器中登录 BOSS 后再搜索。",
    });
    throw new AppError(
      "boss_not_logged_in",
      "未检测到可用的 BOSS 登录会话。请先在本机浏览器中登录 BOSS 后再搜索。",
    );
  }
}

function toCompanyInfo(row) {
  return {
    city: row.city || "",
    location: row.location || "",
    experience: row.experience || "",
    degree: row.degree || "",
    size: row.company_scale || "",
    stage: row.company_stage || "",
    industry: row.company_industry || "",
    bossName: row.boss_name || "",
    bossTitle: row.boss_title || "",
    crawlStatus: row.crawl_status || "",
    address: row.address || "",
    companyIntro: row.company_intro || "",
    welfare: row.welfare || [],
    skills: row.skills || [],
    securityId: row.security_id || "",
    order: typeof row.order_index === "number" ? row.order_index : undefined,
  };
}

function buildRowFromListJob(job, keyword, orderIndex) {
  const listSummary = buildListSummary(job);
  return {
    order_index: orderIndex,
    search_keyword: keyword,
    city: normalizeInline(job.city),
    job_name: normalizeInline(job.name),
    company_name: normalizeInline(job.company),
    salary: normalizeInline(job.salary),
    experience: normalizeInline(job.experience),
    degree: normalizeInline(job.degree),
    location: normalizeInline(job.city),
    address: "",
    skills: Array.isArray(job.skills) ? job.skills : [],
    welfare: Array.isArray(job.welfare) ? job.welfare : [],
    jd: listSummary,
    company_industry: normalizeInline(job.industry),
    company_scale: normalizeInline(job.scale),
    company_stage: normalizeInline(job.stage),
    company_intro: "",
    boss_name: normalizeInline(job.boss),
    boss_title: normalizeInline(job.bossTitle),
    job_url: normalizeInline(job.url),
    security_id: normalizeInline(job.securityId),
    crawl_status: "pending",
  };
}

async function persistJob(importBase, row) {
  if (!importBase) return null;
  const payload = {
    title: row.job_name,
    company: row.company_name || "待确认公司",
    salary: row.salary || undefined,
    jdText: row.jd,
    requirements: row.skills || [],
    url: row.job_url || undefined,
    platform: "BOSS",
    companyInfo: toCompanyInfo(row),
  };
  const response = await fetch(`${importBase.replace(/\/$/, "")}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(
      "job_persist_failed",
      body?.message || body?.error || `写入职位失败（HTTP ${response.status}）`,
    );
  }
  return body;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  emitEvent(options.stream, "start", {
    mode: "bb-site",
    keyword: options.keyword,
    searchKeyword: options.keyword,
    cityCode: options.cityCode,
    pageStart: options.pageStart,
    pages: options.pages,
    maxJobs: options.maxJobs,
    fetchDetails: options.fetchDetails,
  });

  await ensureBossSessionReady(options.stream);

  const seen = new Set();
  const candidates = [];
  let pagesRead = 0;

  for (let page = options.pageStart; page < options.pageStart + options.pages; page += 1) {
    emitEvent(options.stream, "progress", {
      phase: "list",
      page,
      pages: options.pageStart + options.pages - 1,
      total: candidates.length,
      query: options.keyword,
    });
    const data = await runBbBrowserWithRetry(
      ["site", "boss/search", options.keyword, options.cityCode, String(page)],
      2,
      800,
    );
    pagesRead = page;
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
    let pageAdded = 0;
    for (const job of jobs) {
      const key = uniqueJobKey(job);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      candidates.push(job);
      pageAdded += 1;
      if (candidates.length >= options.maxJobs) break;
    }
    if (candidates.length >= options.maxJobs) break;
    if (jobs.length === 0 || pageAdded === 0) break;
  }

  if (!candidates.length) {
    throw new AppError(
      "no_results",
      "没有拿到任何职位搜索结果。请确认 BOSS 已登录，或换一个更明确的关键词后重试。",
    );
  }

  const rows = [];
  let persistedCount = 0;
  let detailedCount = 0;

  const listRows = candidates.slice(0, options.maxJobs).map((job, index) => {
    const row = buildRowFromListJob(job, options.keyword, index);
    rows.push(row);
    emitEvent(options.stream, "job", mapDisplayJob(row));
    return row;
  });

  for (let index = 0; index < listRows.length; index += 1) {
    const seedRow = listRows[index];
    const job = candidates[index];
    emitEvent(options.stream, "progress", {
      phase: "detail",
      index: index + 1,
      total: listRows.length,
    });

    let detail = null;
    let pageFallback = null;
    let status = "detail_ok";

    if (options.fetchDetails) {
      try {
        detail = await runBbBrowserWithRetry(["site", "boss/detail", job.securityId], 2, 600);
      } catch (error) {
        status = `detail_failed: ${normalizeInline(error.message || String(error))}`;
        try {
          pageFallback = await fetchPageFallback(job.url);
          if (pageFallback?.jd) {
            status = "page_fallback";
          }
        } catch (fallbackError) {
          status = `detail_failed / page_fallback_failed: ${normalizeInline(fallbackError.message || String(fallbackError))}`;
        }
      }
    } else {
      status = "list_only";
    }

    const detailJob = detail?.job || {};
    const detailCompany = detail?.company || {};
    const detailBoss = detail?.boss || {};
    const listSummary = buildListSummary(job);

    const row = {
      order_index: seedRow.order_index,
      search_keyword: options.keyword,
      city: normalizeInline(detailJob.location || job.city),
      job_name: normalizeInline(detailJob.name || job.name),
      company_name: normalizeInline(detailCompany.name || job.company),
      salary: normalizeInline(detailJob.salary || job.salary),
      experience: normalizeInline(detailJob.experience || job.experience),
      degree: normalizeInline(detailJob.degree || job.degree),
      location: normalizeInline(detailJob.location || job.city),
      address: normalizeInline(detailJob.address || pageFallback?.address),
      skills: Array.isArray(detailJob.skills)
        ? detailJob.skills
        : Array.isArray(job.skills)
          ? job.skills
          : [],
      welfare: Array.isArray(job.welfare) ? job.welfare : [],
      jd: mergeDetailAndFallback(
        detailJob.description,
        pageFallback?.jd,
        listSummary,
      ),
      company_industry: normalizeInline(detailCompany.industry || job.industry),
      company_scale: normalizeInline(detailCompany.scale || job.scale),
      company_stage: normalizeInline(detailCompany.stage || job.stage),
      company_intro: normalizeInline(detailCompany.intro || pageFallback?.company_intro),
      boss_name: normalizeInline(detailBoss.name || job.boss),
      boss_title: normalizeInline(detailBoss.title || job.bossTitle),
      job_url: normalizeInline(detailJob.url || job.url),
      security_id: normalizeInline(job.securityId),
      crawl_status: status,
    };

    emitEvent(options.stream, "job", mapDisplayJob(row));
    rows[index] = row;
    if (status === "detail_ok" || status === "page_fallback") {
      detailedCount += 1;
    }

    if (options.importBase) {
      const persisted = await persistJob(options.importBase, row);
      if (persisted?.id) {
        persistedCount += 1;
        emitEvent(options.stream, "job_persisted", {
          streamId: row.security_id,
          persistedId: persisted.id,
        });
      }
    }

    await sleep(150);
  }

  const summary = {
    ok: true,
    searchKeyword: options.keyword,
    pageStart: options.pageStart,
    actualPagesRead: pagesRead,
    lastPageRead: pagesRead,
    totalSearchResults: candidates.length,
    returnedJobs: rows.length,
    writtenRows: rows.length,
    persistedRows: persistedCount,
    detailedJobs: detailedCount,
    incompleteDetails: rows.length - detailedCount,
    jobs: rows.map(mapDisplayJob),
  };

  if (!options.stream) {
    writeJson(summary);
  }
  emitEvent(options.stream, "done", summary);
}

main().catch((error) => {
  const code = error instanceof AppError ? error.code : "script_failed";
  const message =
    error instanceof Error ? error.message : "本地 BOSS 搜索执行失败。";
  const payload = {
    ok: false,
    error: code,
    message,
  };
  if (process.argv.includes("--stream")) {
    emitEvent(true, "error", payload);
    emitEvent(true, "done", payload);
  } else {
    writeJson(payload);
  }
  process.exit(1);
});
