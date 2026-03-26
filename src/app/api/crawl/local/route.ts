import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import {
  buildBossListUrl,
  crawlBossScriptPath,
  isLocalCrawlAllowed,
  resolveCrawlPythonExecutable,
} from "@/lib/crawl/localBoss";

const execFileAsync = promisify(execFile);

const bodySchema = z.object({
  keyword: z.string().min(1).max(200),
  platform: z.enum(["boss", "other"]),
  cityCode: z.string().min(1).max(32).optional().default("101280600"),
  pages: z.number().int().min(1).max(20).optional().default(3),
  maxJobs: z.number().int().min(1).max(100).optional().default(2),
  fetchDetails: z.boolean().optional().default(true),
  resumeId: z.union([z.string().min(1), z.literal("auto")]).optional(),
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
    pages,
    maxJobs,
    fetchDetails,
    resumeId,
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

  const projectRoot = process.cwd();
  const py = resolveCrawlPythonExecutable(projectRoot);
  const script = crawlBossScriptPath(projectRoot);
  const listUrl = buildBossListUrl(keyword, cityCode);

  const { port } = parseHostPort(req.headers.get("host"));
  const importBase = `http://127.0.0.1:${port}`;

  const args: string[] = [
    script,
    "--url",
    listUrl,
    "--pages",
    String(pages),
    "--max-jobs",
    String(maxJobs),
    "--sleep",
    "10",
    "--import",
    importBase,
  ];
  if (fetchDetails) {
    args.push(
      "--fetch-details",
      "--max-details",
      String(maxJobs),
      "--detail-sleep",
      "1",
    );
  }
  if (resumeId) {
    args.push("--resume-id", resumeId);
  }

  const maxBuffer = 24 * 1024 * 1024;
  const timeout = 12 * 60 * 1000;
  try {
    const { stdout, stderr } = await execFileAsync(py, args, {
      cwd: projectRoot,
      maxBuffer,
      timeout,
      env: { ...process.env },
    });
    return NextResponse.json({
      ok: true,
      url: listUrl,
      stdout: stdout.slice(-8000),
      stderr: stderr.slice(-4000),
    });
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
    return NextResponse.json(
      {
        ok: false,
        error: "crawl_failed",
        message: err.message ?? String(e),
        code: err.code,
        stdout,
        stderr,
      },
      { status: 500 },
    );
  }
}
