import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

/** BOSS 列表页 URL */
export function buildBossListUrl(keyword: string, cityCode: string): string {
  const q = encodeURIComponent(keyword.trim());
  const city = cityCode.trim() || "101280600";
  return `https://www.zhipin.com/web/geek/jobs?query=${q}&city=${city}`;
}

export function localBossBbScriptPath(projectRoot: string): string {
  return path.join(projectRoot, "tools", "bb_browser_boss", "collect_boss_jobs.js");
}

export function resolveLocalNodeExecutable(): string {
  return process.execPath;
}

export function resolveBbBrowserCommand(): string {
  const explicit = process.env.JOBHUNTER_BB_BROWSER_BIN?.trim();
  if (explicit) return explicit;

  const sibling = path.join(path.dirname(process.execPath), "bb-browser");
  if (fs.existsSync(sibling)) return sibling;

  return "bb-browser";
}

export function inspectBbBrowserAvailability(): {
  ok: boolean;
  error?: string;
  message?: string;
} {
  const command = resolveBbBrowserCommand();
  try {
    const result = spawnSync(command, ["--help"], {
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env },
    });
    if (result.error) {
      const code =
        typeof (result.error as NodeJS.ErrnoException).code === "string"
          ? (result.error as NodeJS.ErrnoException).code
          : "";
      if (code === "ENOENT") {
        return {
          ok: false,
          error: "bb_browser_missing",
          message:
            "未检测到 bb-browser。请先安装并确认命令可在终端里直接执行，然后重新搜索。",
        };
      }
      return {
        ok: false,
        error: "bb_browser_unavailable",
        message:
          result.error.message || "bb-browser 当前不可用，请检查本机安装和命令路径。",
      };
    }
    if (result.status !== 0) {
      return {
        ok: false,
        error: "bb_browser_unavailable",
        message:
          (result.stderr || result.stdout || "bb-browser 无法正常执行。").trim(),
      };
    }
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "bb-browser 当前不可用。";
    return {
      ok: false,
      error: "bb_browser_unavailable",
      message,
    };
  }
}

export function isLocalCrawlAllowed(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.JOBHUNTER_ALLOW_LOCAL_CRAWL === "1"
  );
}
