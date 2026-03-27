"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FilterBar, type FilterState } from "./FilterBar";
import { JobList } from "./JobList";
import type { ExplorerJob, JobPlatform } from "./types";
import {
  buildExplorerDocumentTitle,
  defaultDocumentTitle,
} from "@/lib/workflow-steps";
import { fetchWithAiHeaders } from "@/lib/client/fetch-with-ai";
import { DEFAULT_CRAWL_PAGES, DEFAULT_MAX_JOBS } from "@/lib/crawl/crawlTiming";

const defaultFilters: FilterState = {
  query: "",
  platform: "全部",
  cityCode: "101280600",
  education: "全部",
  experience: "全部",
  companySize: "全部",
};

function matchesFilters(job: ExplorerJob, f: FilterState): boolean {
  const q = f.query.trim().toLowerCase();
  if (q) {
    const hay = `${job.title} ${job.company}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.platform !== "全部" && job.platform !== f.platform) return false;
  if (f.education !== "全部" && job.education !== f.education) return false;
  if (f.experience !== "全部" && job.experience !== f.experience) return false;
  if (f.companySize !== "全部" && job.companySize !== f.companySize)
    return false;
  return true;
}

function buildWorkspaceHref(job: ExplorerJob): string {
  const params = new URLSearchParams();
  params.set("jobId", job.id);
  params.set("jobTitle", job.title);
  params.set("company", job.company);
  params.set("salary", job.salary);
  params.set("city", job.city);
  params.set("platform", job.platform);
  params.set("experience", job.experience);
  params.set("education", job.education);
  params.set("fromExplorer", "1");
  return `/workspace?${params.toString()}`;
}

type JobsApiItem = {
  id: string;
  title: string;
  company: string;
  salary: string | null;
  url?: string | null;
  platform: "BOSS" | "LIEPIN" | "JOB51" | "ZHILIAN" | "MANUAL";
  requirements?: string[] | null;
  companyInfo?: unknown;
};

function mapPlatform(platform: JobsApiItem["platform"]): JobPlatform {
  if (platform === "JOB51") return "51job";
  if (platform === "LIEPIN") return "猎聘";
  return "BOSS直聘";
}

function pickCompanyInfoText(
  info: unknown,
  keys: string[],
  fallback: string,
): string {
  if (!info || typeof info !== "object") return fallback;
  const dict = info as Record<string, unknown>;
  for (const key of keys) {
    const value = dict[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function mapJobFromApi(item: JobsApiItem): ExplorerJob {
  return {
    id: item.id,
    title: item.title,
    company: item.company,
    url: item.url ?? null,
    salary: item.salary ?? "薪资面议",
    city: pickCompanyInfoText(
      item.companyInfo,
      ["city", "location"],
      "未知城市",
    ),
    experience: pickCompanyInfoText(
      item.companyInfo,
      ["experience", "workYear"],
      "不限",
    ),
    education: pickCompanyInfoText(
      item.companyInfo,
      ["education", "degree"],
      "不限",
    ),
    companySize: pickCompanyInfoText(
      item.companyInfo,
      ["size", "companySize"],
      "不限",
    ),
    platform: mapPlatform(item.platform),
    score: 0,
  };
}

export function JobExplorerPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [jobs, setJobs] = useState<ExplorerJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [lastJobsCount, setLastJobsCount] = useState(0);
  const [searchStartAt, setSearchStartAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const sseFirstEventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pollBusyRef = useRef(false);
  const lastJobsCountRef = useRef(0);
  const searchStartAtRef = useRef<number | null>(null);
  const timeoutNoticeShownRef = useRef(false);
  const streamJobsInRunRef = useRef(0);
  const persistedIdByStreamRef = useRef<Record<string, string>>({});

  useEffect(() => {
    document.title = buildExplorerDocumentTitle();
    return () => {
      stopPolling();
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (sseFirstEventTimerRef.current) {
        clearTimeout(sseFirstEventTimerRef.current);
        sseFirstEventTimerRef.current = null;
      }
      document.title = defaultDocumentTitle();
    };
  }, []);

  const filtered = useMemo(
    () => jobs.filter((j) => matchesFilters(j, filters)),
    [jobs, filters],
  );
  const queryOnlyMatchCount = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    if (!q) return jobs.length;
    return jobs.filter((j) =>
      `${j.title} ${j.company}`.toLowerCase().includes(q),
    ).length;
  }, [jobs, filters.query]);

  function looksLikePrismaCuid(id: string): boolean {
    return /^c[a-z0-9]{20,30}$/i.test(id);
  }

  function applyPersistedJobId(streamId: string, persistedId: string) {
    if (!streamId || !persistedId) return;
    persistedIdByStreamRef.current[streamId] = persistedId;
    setJobs((prev) =>
      prev.map((job) =>
        job.id === streamId ? { ...job, id: persistedId } : job,
      ),
    );
  }

  async function resolvePersistedJobId(
    job: ExplorerJob,
  ): Promise<string | null> {
    const res = await fetchWithAiHeaders("/api/jobs");
    if (!res.ok) return null;
    const rows = (await res.json()) as JobsApiItem[];
    const byUrl = rows.find((row) => {
      const rowUrl = typeof row.url === "string" ? row.url : "";
      return rowUrl.includes(job.id);
    });
    if (byUrl?.id) return byUrl.id;
    const byText = rows.find(
      (row) =>
        row.title === job.title &&
        row.company === job.company &&
        (row.salary ?? "薪资面议") === job.salary,
    );
    return byText?.id ?? null;
  }

  async function onEnterPanel(job: ExplorerJob) {
    const persistedId = persistedIdByStreamRef.current[job.id];
    if (persistedId) {
      router.push(buildWorkspaceHref({ ...job, id: persistedId }));
      return;
    }
    if (looksLikePrismaCuid(job.id)) {
      router.push(buildWorkspaceHref(job));
      return;
    }
    if (loading || polling) {
      setNotice("岗位仍在抓取入库中，请等待“搜索完成”后再进入定制面板。");
      return;
    }
    await loadJobs({ silent: true });
    const resolvedId = await resolvePersistedJobId(job);
    if (!resolvedId) {
      setNotice("该岗位仍在入库中，请稍后再试。");
      return;
    }
    router.push(buildWorkspaceHref({ ...job, id: resolvedId }));
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  async function loadJobs(opts?: { silent?: boolean }) {
    const res = await fetchWithAiHeaders("/api/jobs");
    if (!res.ok) {
      if (!opts?.silent) {
        setNotice(`岗位加载失败（HTTP ${res.status}）`);
      }
      return -1;
    }
    const raw = (await res.json()) as JobsApiItem[];
    const mapped = raw.map(mapJobFromApi);
    const currentQuery = filters.query.trim().toLowerCase();
    setJobs(mapped);
    return mapped.length;
  }

  function stopPolling(reason?: string) {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollBusyRef.current = false;
    setPolling(false);
  }

  function closeSse() {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (sseFirstEventTimerRef.current) {
      clearTimeout(sseFirstEventTimerRef.current);
      sseFirstEventTimerRef.current = null;
    }
  }

  function mergeIncomingJobs(incoming: ExplorerJob[]) {
    setJobs((prev) => {
      const seen = new Set(prev.map((j) => j.id));
      const next = [...prev];
      for (const job of incoming) {
        if (!seen.has(job.id)) {
          seen.add(job.id);
          next.unshift(job);
        }
      }
      return next;
    });
  }

  function parseSseJob(raw: unknown): ExplorerJob | null {
    if (!raw || typeof raw !== "object") return null;
    const data = raw as Record<string, unknown>;
    const id = typeof data.id === "string" ? data.id : "";
    const title = typeof data.title === "string" ? data.title : "";
    const company = typeof data.company === "string" ? data.company : "";
    if (!id || !title || !company) return null;
    const platform =
      data.platform === "51job" || data.platform === "猎聘"
        ? (data.platform as JobPlatform)
        : "BOSS直聘";
    const streamUrl =
      typeof data.url === "string" && data.url.trim() ? data.url.trim() : null;
    return {
      id,
      title,
      company,
      url: streamUrl,
      salary:
        typeof data.salary === "string" && data.salary
          ? data.salary
          : "薪资面议",
      city: typeof data.city === "string" && data.city ? data.city : "未知城市",
      experience:
        typeof data.experience === "string" && data.experience
          ? data.experience
          : "不限",
      education:
        typeof data.education === "string" && data.education
          ? data.education
          : "不限",
      companySize:
        typeof data.companySize === "string" && data.companySize
          ? data.companySize
          : "不限",
      platform,
      score: typeof data.score === "number" ? data.score : 0,
    };
  }

  function startPolling(initialCount: number) {
    stopPolling("restart");
    setPolling(true);
    setPollCount(0);
    setLastJobsCount(initialCount);
    setSearchStartAt(Date.now());
    lastJobsCountRef.current = initialCount;
    searchStartAtRef.current = Date.now();
    timeoutNoticeShownRef.current = false;

    pollTimerRef.current = setInterval(() => {
      if (pollBusyRef.current) return;
      pollBusyRef.current = true;
      void (async () => {
        try {
          setPollCount((prev) => prev + 1);
          const count = await loadJobs({ silent: true });
          if (count >= 0 && count > lastJobsCountRef.current) {
            const delta = count - lastJobsCountRef.current;
            setNotice(`新增 ${delta} 条岗位，正在继续抓取...`);
            lastJobsCountRef.current = count;
            setLastJobsCount(count);
          }
          const elapsedMs = searchStartAtRef.current
            ? Date.now() - searchStartAtRef.current
            : 0;
          if (elapsedMs > 180_000 && !timeoutNoticeShownRef.current) {
            timeoutNoticeShownRef.current = true;
            setNotice("抓取时间较长，仍在后台抓取，列表会继续自动刷新...");
          }
          if (elapsedMs > 600_000) {
            stopPolling("hard_timeout");
            setLoading(false);
            setNotice("抓取超时（10分钟），已停止自动刷新。可重试搜索。");
          }
        } finally {
          pollBusyRef.current = false;
        }
      })();
    }, 1300);
  }

  async function runSearch() {
    if (!filters.query.trim()) {
      setNotice("请输入职位关键词后再搜索。");
      return;
    }
    if (filters.platform === "51job" || filters.platform === "猎聘") {
      setNotice(`${filters.platform} 爬取即将支持，当前请先使用 BOSS直聘。`);
      return;
    }

    setLoading(true);
    setSearched(true);
    streamJobsInRunRef.current = 0;
    setNotice("正在抓取岗位，列表会自动刷新...");
    closeSse();
    const fallbackToLegacy = async (why: string) => {
      closeSse();
      setNotice(`实时流式不可用（${why}），切换为轮询模式...`);
      startPolling(jobs.length);
      try {
        const res = await fetchWithAiHeaders("/api/crawl/local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: filters.query.trim(),
            platform: "boss",
            cityCode: filters.cityCode,
            pages: DEFAULT_CRAWL_PAGES,
            maxJobs: DEFAULT_MAX_JOBS,
            fetchDetails: true,
          }),
        });
        const body = (await res.json()) as { message?: string; error?: string };
        if (!res.ok) {
          stopPolling("crawl_non_ok");
          setNotice(
            body.message ?? body.error ?? `搜索失败（HTTP ${res.status}）`,
          );
          return;
        }
        await loadJobs({ silent: true });
        stopPolling("crawl_ok");
        setNotice("搜索完成（轮询模式），已更新岗位列表。");
      } catch (error: unknown) {
        stopPolling("crawl_exception");
        const msg = error instanceof Error ? error.message : String(error);
        setNotice(`搜索失败：${msg}`);
      } finally {
        setLoading(false);
      }
    };

    const params = new URLSearchParams({
      keyword: filters.query.trim(),
      platform: "boss",
      cityCode: filters.cityCode,
      pages: String(DEFAULT_CRAWL_PAGES),
      maxJobs: String(DEFAULT_MAX_JOBS),
      fetchDetails: "true",
    });
    const es = new EventSource(`/api/crawl/local/stream?${params.toString()}`);
    sseRef.current = es;

    let receivedFirstEvent = false;
    sseFirstEventTimerRef.current = setTimeout(() => {
      if (!receivedFirstEvent) {
        void fallbackToLegacy("SSE 首事件超时");
      }
    }, 5000);

    es.addEventListener("start", () => {
      receivedFirstEvent = true;
      setNotice("正在实时抓取岗位...");
    });

    es.addEventListener("progress", (event) => {
      receivedFirstEvent = true;
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          phase?: string;
          page?: number;
          pages?: number;
          total?: number;
          index?: number;
        };
        if (payload.phase === "list") {
          setNotice(
            `列表抓取进度：第 ${payload.page ?? "-"} / ${payload.pages ?? "-"} 页，累计 ${payload.total ?? 0} 条`,
          );
        } else if (payload.phase === "detail") {
          setNotice(
            `详情抓取进度：${payload.index ?? 0} / ${payload.total ?? 0}`,
          );
        }
      } catch {
        // Ignore malformed event payload.
      }
    });

    es.addEventListener("job", (event) => {
      receivedFirstEvent = true;
      try {
        const payload = JSON.parse((event as MessageEvent).data) as unknown;
        const job = parseSseJob(payload);
        if (job) {
          streamJobsInRunRef.current += 1;
          mergeIncomingJobs([job]);
        }
      } catch {
        // Ignore malformed event payload.
      }
    });

    es.addEventListener("job_persisted", (event) => {
      receivedFirstEvent = true;
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          streamId?: string;
          persistedId?: string;
        };
        if (
          typeof payload.streamId === "string" &&
          typeof payload.persistedId === "string"
        ) {
          applyPersistedJobId(payload.streamId, payload.persistedId);
        }
      } catch {
        // Ignore malformed event payload.
      }
    });

    es.addEventListener("error", (event) => {
      const payloadText =
        event instanceof MessageEvent ? String(event.data ?? "") : "";
      if (!receivedFirstEvent) {
        es.close();
        void fallbackToLegacy(payloadText || "SSE 连接错误");
        return;
      }
      if (payloadText) {
        setNotice(`抓取异常：${payloadText}`);
      }
    });

    es.addEventListener("done", async (event) => {
      receivedFirstEvent = true;
      closeSse();
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          ok?: boolean;
          exitCode?: number | null;
        };
        await loadJobs({ silent: true });
        if (payload.ok === false || payload.exitCode) {
          setNotice(`抓取结束（exitCode=${payload.exitCode ?? "?"}）。`);
        } else {
          setNotice("搜索完成，已更新岗位列表。");
        }
      } finally {
        setLoading(false);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">岗位探索</span>
          <span className="text-sm text-muted-foreground">
            浏览职位后进入定制面板处理投递
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="default" className="rounded-full px-5">
            <Link href="/workspace">沉浸工作台</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>新线索: —</span>
        <span>准备投递: —</span>
        <span>待定: —</span>
        <span>待人工复核: —</span>
      </div>

      <FilterBar
        value={filters}
        onChange={setFilters}
        resultCount={filtered.length}
        onSearch={() => void runSearch()}
        searching={loading || polling}
      />
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      {polling && (
        <p className="text-xs text-muted-foreground">
          轮询中：第 {pollCount} 次刷新，当前共 {lastJobsCount} 条岗位
          {searchStartAt ? "（实时更新）" : ""}
        </p>
      )}

      <JobList
        jobs={filtered}
        loading={(loading || polling) && filtered.length === 0}
        emptyMessage={
          searched
            ? queryOnlyMatchCount > 0
              ? "当前筛选条件下暂无结果，请放宽学历/经验/规模等筛选。"
              : "未抓到岗位，请更换关键词后重试。"
            : "暂无岗位，请先搜索。"
        }
        onEnterPanel={(job) => void onEnterPanel(job)}
      />
    </div>
  );
}
