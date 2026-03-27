/** Explorer / API 默认：单页、每轮最多 5 条（与路由 zod max 一致） */
export const DEFAULT_CRAWL_PAGES = 1;
export const DEFAULT_MAX_JOBS = 5;
export const MAX_JOBS_PER_RUN = 5;

export const DEFAULT_LIST_SLEEP = 10;
export const DEFAULT_DETAIL_SLEEP = 1;
/** 略增默认等待，给详情页 DOM/脚本留出时间（可通过 JOBHUNTER_CRAWL_DETAIL_DOM_WAIT 覆盖） */
export const DEFAULT_DETAIL_DOM_WAIT = 7;
export const DEFAULT_DETAIL_LISTEN_TIMEOUT = 35;

export type CrawlTimingOverrides = {
  listSleep?: number;
  detailSleep?: number;
  detailDomWait?: number;
  detailListenTimeout?: number;
};

export type ResolvedCrawlTiming = {
  listSleep: number;
  detailSleep: number;
  detailDomWait: number;
  detailListenTimeout: number;
};

function parseEnvFloat(key: string, fallback: number): number {
  const v = process.env[key]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** 仅从环境变量读取（无 query/body 覆盖时） */
export function resolveCrawlTimingFromEnv(): ResolvedCrawlTiming {
  return {
    listSleep: parseEnvFloat("JOBHUNTER_CRAWL_LIST_SLEEP", DEFAULT_LIST_SLEEP),
    detailSleep: parseEnvFloat(
      "JOBHUNTER_CRAWL_DETAIL_SLEEP",
      DEFAULT_DETAIL_SLEEP,
    ),
    detailDomWait: parseEnvFloat(
      "JOBHUNTER_CRAWL_DETAIL_DOM_WAIT",
      DEFAULT_DETAIL_DOM_WAIT,
    ),
    detailListenTimeout: parseEnvFloat(
      "JOBHUNTER_CRAWL_DETAIL_LISTEN_TIMEOUT",
      DEFAULT_DETAIL_LISTEN_TIMEOUT,
    ),
  };
}

/**
 * Query/body 中显式传入的字段覆盖 env，未传的字段沿用 env。
 */
export function mergeCrawlTiming(
  overrides: CrawlTimingOverrides,
): ResolvedCrawlTiming {
  const env = resolveCrawlTimingFromEnv();
  return {
    listSleep: overrides.listSleep ?? env.listSleep,
    detailSleep: overrides.detailSleep ?? env.detailSleep,
    detailDomWait: overrides.detailDomWait ?? env.detailDomWait,
    detailListenTimeout:
      overrides.detailListenTimeout ?? env.detailListenTimeout,
  };
}

function clipOptionalNumber(
  raw: string | null,
  min: number,
  max: number,
): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

/** SSE query 中可选 timing 参数（显式覆盖 env） */
export function parseOptionalQueryTimingOverrides(
  searchParams: URLSearchParams,
): CrawlTimingOverrides {
  return {
    listSleep: clipOptionalNumber(searchParams.get("listSleep"), 0, 60),
    detailSleep: clipOptionalNumber(searchParams.get("detailSleep"), 0, 60),
    detailDomWait: clipOptionalNumber(
      searchParams.get("detailDomWait"),
      0.5,
      30,
    ),
    detailListenTimeout: clipOptionalNumber(
      searchParams.get("detailListenTimeout"),
      5,
      120,
    ),
  };
}

/** 与 `crawl_boss.py` argparse 兼容的 spawn 参数（顺序与现有行为一致） */
export function buildBossCrawlSpawnArgs(options: {
  script: string;
  listUrl: string;
  pages: number;
  maxJobs: number;
  importBase: string;
  /** SSE 为 true；同步 POST 为 false */
  stream: boolean;
  fetchDetails: boolean;
  timing: ResolvedCrawlTiming;
  resumeId?: string;
}): string[] {
  const out = [
    options.script,
    "--url",
    options.listUrl,
    "--pages",
    String(options.pages),
    "--max-jobs",
    String(options.maxJobs),
    "--sleep",
    String(options.timing.listSleep),
    "--import",
    options.importBase,
  ];
  if (options.stream) {
    out.push("--stream");
  }
  if (options.fetchDetails) {
    out.push(
      "--fetch-details",
      "--max-details",
      String(options.maxJobs),
      "--detail-sleep",
      String(options.timing.detailSleep),
      "--detail-dom-wait",
      String(options.timing.detailDomWait),
      "--detail-listen-timeout",
      String(options.timing.detailListenTimeout),
    );
  }
  if (options.resumeId) {
    out.push("--resume-id", options.resumeId);
  }
  return out;
}
