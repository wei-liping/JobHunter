import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import {
  isLocalCrawlAllowed,
  inspectBbBrowserAvailability,
  localBossBbScriptPath,
  resolveBbBrowserCommand,
  resolveLocalNodeExecutable,
} from "@/lib/crawl/localBoss";
import { isDemoModeServer } from "@/lib/demo/mode";
import {
  DEFAULT_CRAWL_PAGES,
  DEFAULT_MAX_JOBS,
  MAX_JOBS_PER_RUN,
} from "@/lib/crawl/crawlTiming";

const execFileAsync = promisify(execFile);

const bodySchema = z.object({
  keyword: z.string().min(1).max(200),
  platform: z.enum(["boss", "other"]),
  cityCode: z.string().min(1).max(32).optional().default("101280600"),
  pageStart: z.number().int().min(1).max(200).optional().default(1),
  pages: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(DEFAULT_CRAWL_PAGES),
  maxJobs: z
    .number()
    .int()
    .min(1)
    .max(MAX_JOBS_PER_RUN)
    .optional()
    .default(DEFAULT_MAX_JOBS),
  fetchDetails: z.boolean().optional().default(true),
});

function parseHostPort(hostHeader: string | null): {
  host: string;
  port: string;
} {
  const raw = hostHeader?.trim() || "localhost:3000";
  const idx = raw.lastIndexOf(":");
  if (idx > 0 && idx < raw.length - 1) {
    const port = raw.slice(idx + 1).replace(/[^0-9].*$/, "") || "3000";
    return { host: raw.slice(0, idx), port };
  }
  return { host: raw, port: process.env.PORT || "3000" };
}

export async function POST(req: Request) {
  if (isDemoModeServer()) {
    return NextResponse.json(
      {
        ok: false,
        error: "demo_forbidden",
        message:
          "在线演示版使用静态岗位快照，不支持本地抓取。请在本地完整版中搜索，或运行 npm run snapshot:ai-pm 更新快照。",
      },
      { status: 403 },
    );
  }
  if (!isLocalCrawlAllowed()) {
    return NextResponse.json(
      {
        error: "forbidden",
        message:
          "本地爬虫仅允许在 NODE_ENV=development 或设置 JOBHUNTER_ALLOW_LOCAL_CRAWL=1 时使用。",
      },
      { status: 403 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const {
    keyword,
    platform,
    cityCode,
    pageStart,
    pages,
    maxJobs,
    fetchDetails,
  } = parsed.data;

  if (platform === "other") {
    return NextResponse.json(
      {
        error: "not_implemented",
        message: "「其他」平台爬虫尚未接入；请先用 BOSS 或命令行脚本。",
      },
      { status: 501 },
    );
  }

  const availability = inspectBbBrowserAvailability();
  if (!availability.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: availability.error ?? "bb_browser_unavailable",
        message:
          availability.message ??
          "本机浏览器工具当前不可用，请检查安装和命令路径。",
      },
      { status: 503 },
    );
  }

  const projectRoot = process.cwd();
  const node = resolveLocalNodeExecutable();
  const script = localBossBbScriptPath(projectRoot);
  const bbBrowser = resolveBbBrowserCommand();

  const { port } = parseHostPort(req.headers.get("host"));
  const importBase = `http://127.0.0.1:${port}`;

  const args = [
    script,
    "--keyword",
    keyword,
    "--city-code",
    cityCode,
    "--page-start",
    String(pageStart),
    "--pages",
    String(pages),
    "--max-jobs",
    String(maxJobs),
    "--import-base",
    importBase,
    fetchDetails ? "--fetch-details" : "--no-fetch-details",
  ];

  const maxBuffer = 24 * 1024 * 1024;
  const timeout = 12 * 60 * 1000;
  try {
    const { stdout } = await execFileAsync(node, args, {
      cwd: projectRoot,
      maxBuffer,
      timeout,
      env: { ...process.env, JOBHUNTER_BB_BROWSER_BIN: bbBrowser },
    });
    let body: unknown = null;
    try {
      body = JSON.parse(stdout);
    } catch {
      body = {
        ok: false,
        error: "invalid_script_output",
        message: "本地 BOSS 搜索脚本返回了无法识别的结果。",
        stdout: stdout.slice(-8000),
      };
    }
    return NextResponse.json(body);
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: string | number | null;
    };
    const stdout =
      typeof err.stdout === "string" ? err.stdout.slice(-8000) : "";
    const stderr =
      typeof err.stderr === "string" ? err.stderr.slice(-4000) : "";
    let body: Record<string, unknown> = {
      ok: false,
      error: "crawl_failed",
      message: err.message ?? String(e),
      code: err.code,
      stdout,
      stderr,
    };
    if (stdout) {
      try {
        body = JSON.parse(stdout) as Record<string, unknown>;
      } catch {
        // keep fallback payload
      }
    }
    return NextResponse.json(body, { status: 500 });
  }
}
