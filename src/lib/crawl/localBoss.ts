import path from "node:path";

/** BOSS 列表页 URL（与 crawl_boss.py 使用的 web/geek/jobs 一致） */
export function buildBossListUrl(keyword: string, cityCode: string): string {
  const q = encodeURIComponent(keyword.trim());
  const city = cityCode.trim() || "101280600";
  return `https://www.zhipin.com/web/geek/jobs?query=${q}&city=${city}`;
}

/** 子进程用的 Python 可执行文件（venv）；可被 JOBHUNTER_CRAWL_PYTHON 覆盖 */
export function resolveCrawlPythonExecutable(projectRoot: string): string {
  const override = process.env.JOBHUNTER_CRAWL_PYTHON?.trim();
  if (override) return override;
  const win = process.platform === "win32";
  const rel = win
    ? path.join("tools", "boss_zhipin_crawl", ".venv", "Scripts", "python.exe")
    : path.join("tools", "boss_zhipin_crawl", ".venv", "bin", "python");
  return path.join(projectRoot, rel);
}

export function crawlBossScriptPath(projectRoot: string): string {
  return path.join(projectRoot, "tools", "boss_zhipin_crawl", "crawl_boss.py");
}

export function isLocalCrawlAllowed(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.JOBHUNTER_ALLOW_LOCAL_CRAWL === "1"
  );
}
