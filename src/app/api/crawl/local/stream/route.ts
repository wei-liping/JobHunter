import { spawn } from "node:child_process";
import { z } from "zod";
import {
  buildBossListUrl,
  crawlBossScriptPath,
  isLocalCrawlAllowed,
  resolveCrawlPythonExecutable,
} from "@/lib/crawl/localBoss";

export const runtime = "nodejs";

const querySchema = z.object({
  keyword: z.string().min(1).max(200),
  platform: z.enum(["boss", "other"]).default("boss"),
  cityCode: z.string().min(1).max(32).default("101280600"),
  pages: z.coerce.number().int().min(1).max(20).default(2),
  maxJobs: z.coerce.number().int().min(1).max(100).default(2),
  fetchDetails: z
    .enum(["1", "0", "true", "false"])
    .optional()
    .transform((v) => (v ? v === "1" || v === "true" : true)),
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

function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function toEvent(line: string): { event: string; data: unknown } {
  try {
    const parsed = JSON.parse(line) as { type?: string; data?: unknown };
    if (parsed && typeof parsed.type === "string") {
      return { event: parsed.type, data: parsed.data ?? {} };
    }
  } catch {
    // Non-JSON lines are treated as log.
  }
  return { event: "log", data: { line } };
}

export async function GET(req: Request) {
  if (!isLocalCrawlAllowed()) {
    return new Response(
      sseLine("error", {
        error: "forbidden",
        message:
          "本地爬虫仅允许在 NODE_ENV=development 或设置 JOBHUNTER_ALLOW_LOCAL_CRAWL=1 时使用。",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      },
    );
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    keyword: url.searchParams.get("keyword") ?? "",
    platform: url.searchParams.get("platform") ?? "boss",
    cityCode: url.searchParams.get("cityCode") ?? "101280600",
    pages: url.searchParams.get("pages") ?? "2",
    maxJobs: url.searchParams.get("maxJobs") ?? "2",
    fetchDetails: url.searchParams.get("fetchDetails") ?? "true",
  });

  if (!parsed.success) {
    return new Response(
      sseLine("error", {
        error: "invalid_request",
        issues: parsed.error.issues,
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      },
    );
  }

  const { keyword, platform, cityCode, pages, maxJobs } = parsed.data;
  const fetchDetails = parsed.data.fetchDetails ?? true;

  if (platform === "other") {
    return new Response(
      sseLine("error", {
        error: "not_implemented",
        message: "「其他」平台爬虫尚未接入；请先用 BOSS。",
      }),
      {
        status: 501,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      },
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
    "--stream",
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const child = spawn(py, args, {
        cwd: projectRoot,
        env: { ...process.env },
      });

      controller.enqueue(
        encoder.encode(
          sseLine("start", {
            mode: "sse",
            keyword,
            cityCode,
            pages,
            fetchDetails,
          }),
        ),
      );

      const onAbort = () => {
        child.kill("SIGTERM");
        controller.enqueue(
          encoder.encode(
            sseLine("done", {
              aborted: true,
              message: "client disconnected",
            }),
          ),
        );
        controller.close();
      };
      req.signal.addEventListener("abort", onAbort);

      child.stdout.setEncoding("utf8");
      let stdoutBuf = "";
      child.stdout.on("data", (chunk: string) => {
        stdoutBuf += chunk;
        const lines = stdoutBuf.split(/\r?\n/);
        stdoutBuf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const evt = toEvent(trimmed);
          controller.enqueue(encoder.encode(sseLine(evt.event, evt.data)));
        }
      });

      child.stderr.setEncoding("utf8");
      let stderrBuf = "";
      child.stderr.on("data", (chunk: string) => {
        stderrBuf += chunk;
        const lines = stderrBuf.split(/\r?\n/);
        stderrBuf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          controller.enqueue(
            encoder.encode(
              sseLine("log", {
                stream: "stderr",
                line: trimmed,
              }),
            ),
          );
        }
      });

      child.on("error", (err) => {
        controller.enqueue(
          encoder.encode(
            sseLine("error", {
              stage: "spawn",
              message: err.message,
            }),
          ),
        );
      });

      child.on("close", (code, signal) => {
        req.signal.removeEventListener("abort", onAbort);
        controller.enqueue(
          encoder.encode(
            sseLine("done", {
              exitCode: code,
              signal,
              ok: code === 0,
            }),
          ),
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
