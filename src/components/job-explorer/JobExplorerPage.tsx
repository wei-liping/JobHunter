"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/ui/simple-modal";
import { FilterBar, type FilterState } from "./FilterBar";
import { JobList } from "./JobList";
import type { ExplorerJob, JobPlatform } from "./types";
import { fetchWithAiHeaders } from "@/lib/client/fetch-with-ai";
import {
  DEFAULT_CRAWL_PAGES,
  DEFAULT_MAX_JOBS,
  MAX_JOBS_PER_RUN,
} from "@/lib/crawl/crawlTiming";

const defaultFilters: FilterState = {
  query: "",
  platform: "全部",
  cityCode: "101280600",
  resultLimit: DEFAULT_MAX_JOBS as FilterState["resultLimit"],
  education: "全部",
  experience: "全部",
  companySize: "全部",
};

type JobsApiItem = {
  id: string;
  title: string;
  company: string;
  salary: string | null;
  url?: string | null;
  platform: "BOSS" | "LIEPIN" | "JOB51" | "ZHILIAN" | "MANUAL";
  companyInfo?: unknown;
};

type JobDetail = JobsApiItem & {
  jdText: string;
  requirements?: string[] | null;
};

type SavedJobItem = {
  id: string;
  jobId: string;
  note?: string | null;
};

type SearchErrorPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  exitCode?: number | null;
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
    city: pickCompanyInfoText(item.companyInfo, ["city", "location"], "未知城市"),
    experience: pickCompanyInfoText(item.companyInfo, ["experience", "workYear"], "不限"),
    education: pickCompanyInfoText(item.companyInfo, ["education", "degree"], "不限"),
    companySize: pickCompanyInfoText(item.companyInfo, ["size", "companySize"], "不限"),
    platform: mapPlatform(item.platform),
    score: 0,
  };
}

function matchesFilters(job: ExplorerJob, f: FilterState): boolean {
  const q = f.query.trim().toLowerCase();
  if (q) {
    const hay = `${job.title} ${job.company}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.platform !== "全部" && job.platform !== f.platform) return false;
  if (f.education !== "全部" && job.education !== f.education) return false;
  if (f.experience !== "全部" && job.experience !== f.experience) return false;
  if (f.companySize !== "全部" && job.companySize !== f.companySize) return false;
  return true;
}

export function JobExplorerPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [jobs, setJobs] = useState<ExplorerJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<JobDetail | null>(null);
  const [savedJobs, setSavedJobs] = useState<SavedJobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [setupHelp, setSetupHelp] = useState<{ title: string; message: string } | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const sseFirstEventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistedIdByStreamRef = useRef<Record<string, string>>({});

  const filtered = useMemo(
    () => jobs.filter((job) => matchesFilters(job, filters)),
    [jobs, filters],
  );

  const savedJobIds = useMemo(() => new Set(savedJobs.map((item) => item.jobId)), [savedJobs]);

  const selectedJob =
    filtered.find((job) => job.id === selectedJobId) ??
    jobs.find((job) => job.id === selectedJobId) ??
    null;

  useEffect(() => {
    return () => {
      if (sseRef.current) {
        sseRef.current.close();
      }
      if (sseFirstEventTimerRef.current) {
        clearTimeout(sseFirstEventTimerRef.current);
      }
    };
  }, []);

  function resolveSearchPages(resultLimit: number): number {
    if (resultLimit <= 10) return DEFAULT_CRAWL_PAGES;
    return Math.min(3, Math.ceil(resultLimit / 10));
  }

  const loadSavedJobs = useCallback(async () => {
    const res = await fetchWithAiHeaders("/api/saved-jobs");
    if (!res.ok) return;
    const rows = (await res.json()) as Array<{ id: string; note?: string | null; job: { id: string } }>;
    setSavedJobs(
      rows.map((row) => ({
        id: row.id,
        note: row.note ?? null,
        jobId: row.job.id,
      })),
    );
  }, []);

  useEffect(() => {
    void loadSavedJobs();
  }, [loadSavedJobs]);

  const loadJobDetail = useCallback(async (jobId: string) => {
    const persistedId = persistedIdByStreamRef.current[jobId] ?? jobId;
    const res = await fetchWithAiHeaders(`/api/jobs/${persistedId}`);
    if (!res.ok) {
      setSelectedJobDetail(null);
      return;
    }
    setSelectedJobDetail((await res.json()) as JobDetail);
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJobDetail(null);
      return;
    }
    void loadJobDetail(selectedJobId);
  }, [loadJobDetail, selectedJobId]);

  function parseErrorPayload(raw: string): SearchErrorPayload | null {
    if (!raw.trim()) return null;
    try {
      return JSON.parse(raw) as SearchErrorPayload;
    } catch {
      return { message: raw };
    }
  }

  function showSetupHelp(error?: string, message?: string) {
    if (error === "bb_browser_missing" || error === "bb_browser_unavailable") {
      setSetupHelp({
        title: "需要先准备本地浏览器工具",
        message:
          message ??
          "系统没有找到 bb-browser。请先确认它已经安装，并且在终端里可以直接执行，然后再回来搜索。",
      });
      return true;
    }
    if (error === "boss_not_logged_in") {
      setSetupHelp({
        title: "需要先登录 BOSS",
        message:
          message ??
          "系统没有检测到可用的 BOSS 登录状态。请先在本机浏览器中登录 BOSS 职位页面，再回来搜索。",
      });
      return true;
    }
    return false;
  }

  function mergeIncomingJobs(incoming: ExplorerJob[]) {
    setJobs((prev) => {
      const seen = new Set(prev.map((job) => job.id));
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
    return {
      id,
      title,
      company,
      salary: typeof data.salary === "string" && data.salary ? data.salary : "薪资面议",
      city: typeof data.city === "string" && data.city ? data.city : "未知城市",
      experience: typeof data.experience === "string" && data.experience ? data.experience : "不限",
      education: typeof data.education === "string" && data.education ? data.education : "不限",
      companySize:
        typeof data.companySize === "string" && data.companySize ? data.companySize : "不限",
      platform:
        data.platform === "51job" || data.platform === "猎聘"
          ? (data.platform as JobPlatform)
          : "BOSS直聘",
      score: typeof data.score === "number" ? data.score : 0,
      url: typeof data.url === "string" && data.url.trim() ? data.url.trim() : null,
    };
  }

  function applyPersistedJobId(streamId: string, persistedId: string) {
    if (!streamId || !persistedId) return;
    persistedIdByStreamRef.current[streamId] = persistedId;
    setJobs((prev) =>
      prev.map((job) => (job.id === streamId ? { ...job, id: persistedId } : job)),
    );
    setSelectedJobId((current) => (current === streamId ? persistedId : current));
  }

  async function resolvePersistedJobId(job: ExplorerJob): Promise<string | null> {
    const known = persistedIdByStreamRef.current[job.id];
    if (known) return known;
    if (/^c[a-z0-9]{20,30}$/i.test(job.id)) return job.id;
    const res = await fetchWithAiHeaders("/api/jobs");
    if (!res.ok) return null;
    const rows = (await res.json()) as JobsApiItem[];
    const byUrl = rows.find((row) => row.url && job.url && row.url === job.url);
    if (byUrl?.id) return byUrl.id;
    const byText = rows.find(
      (row) =>
        row.title === job.title &&
        row.company === job.company &&
        (row.salary ?? "薪资面议") === job.salary,
    );
    return byText?.id ?? null;
  }

  async function saveJob(job: ExplorerJob) {
    const persistedId = await resolvePersistedJobId(job);
    if (!persistedId) {
      setNotice("这个岗位还在入库，请稍等几秒再加入内容管理。");
      return;
    }
    const res = await fetchWithAiHeaders("/api/saved-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: persistedId }),
    });
    if (!res.ok) {
      setNotice("加入内容管理失败，请重试。");
      return;
    }
    await loadSavedJobs();
    setNotice("已加入职位看板，你可以在内容管理里继续查看。");
  }

  function goToResume(job: ExplorerJob) {
    const persistedId = persistedIdByStreamRef.current[job.id] ?? job.id;
    router.push(`/resume?jobId=${encodeURIComponent(persistedId)}`);
  }

  async function runSearch(options?: {
    resultLimit?: number;
    replaceNotice?: string;
  }) {
    if (!filters.query.trim()) {
      setNotice("请输入关键词后再搜索。");
      return;
    }
    if (filters.platform === "51job" || filters.platform === "猎聘") {
      setNotice(`${filters.platform} 这一轮还没接入，本期先使用 BOSS 直聘。`);
      return;
    }

    const resultLimit = options?.resultLimit ?? filters.resultLimit;
    const pages = resolveSearchPages(resultLimit);
    setSetupHelp(null);
    setSearched(true);
    setLoading(true);
    setNotice(options?.replaceNotice ?? "正在连接本机 BOSS，会把结果直接更新到列表里。");
    setJobs([]);
    setSelectedJobId(null);
    setSelectedJobDetail(null);

    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (sseFirstEventTimerRef.current) {
      clearTimeout(sseFirstEventTimerRef.current);
      sseFirstEventTimerRef.current = null;
    }

    const fallbackToSync = async (why: string) => {
      setNotice(`实时连接暂时不可用（${why}），正在改用备用方式...`);
      try {
        const res = await fetchWithAiHeaders("/api/crawl/local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: filters.query.trim(),
            platform: "boss",
            cityCode: filters.cityCode,
            pages,
            maxJobs: resultLimit,
            fetchDetails: true,
          }),
        });
        const body = (await res.json()) as SearchErrorPayload;
        if (!res.ok) {
          if (showSetupHelp(body.error, body.message)) {
            setNotice(body.message ?? "搜索前需要先完成本机环境准备。");
            return;
          }
          setNotice(body.message ?? body.error ?? "搜索失败。");
          return;
        }
        const jobsRes = await fetchWithAiHeaders("/api/jobs");
        if (jobsRes.ok) {
          const rows = (await jobsRes.json()) as JobsApiItem[];
          const mapped = rows.map(mapJobFromApi).filter((job) => job.title.includes(filters.query.trim()) || job.company.includes(filters.query.trim()));
          setJobs(mapped);
          setSelectedJobId(mapped[0]?.id ?? null);
          setNotice("搜索完成，结果已经更新。");
        }
      } finally {
        setLoading(false);
      }
    };

    const params = new URLSearchParams({
      keyword: filters.query.trim(),
      platform: "boss",
      cityCode: filters.cityCode,
      pages: String(pages),
      maxJobs: String(resultLimit),
      fetchDetails: "true",
    });

    const es = new EventSource(`/api/crawl/local/stream?${params.toString()}`);
    sseRef.current = es;
    let receivedFirstEvent = false;

    sseFirstEventTimerRef.current = setTimeout(() => {
      if (!receivedFirstEvent) {
        es.close();
        void fallbackToSync("首个事件超时");
      }
    }, 5000);

    es.addEventListener("start", () => {
      receivedFirstEvent = true;
      setNotice("已连接本机 BOSS，会继续补全职位详情。");
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
          setNotice(`正在找职位：第 ${payload.page ?? "-"} / ${payload.pages ?? "-"} 页，已拿到 ${payload.total ?? 0} 条。`);
        } else if (payload.phase === "detail") {
          setNotice(`正在补全职位详情：${payload.index ?? 0} / ${payload.total ?? 0}`);
        }
      } catch {
        // ignore
      }
    });

    es.addEventListener("job", (event) => {
      receivedFirstEvent = true;
      const job = parseSseJob(JSON.parse((event as MessageEvent).data));
      if (job) {
        mergeIncomingJobs([job]);
        setSelectedJobId((current) => current ?? job.id);
      }
    });

    es.addEventListener("job_persisted", (event) => {
      receivedFirstEvent = true;
      const payload = JSON.parse((event as MessageEvent).data) as {
        streamId?: string;
        persistedId?: string;
      };
      if (payload.streamId && payload.persistedId) {
        applyPersistedJobId(payload.streamId, payload.persistedId);
      }
    });

    es.addEventListener("error", (event) => {
      const payloadText = event instanceof MessageEvent ? String(event.data ?? "") : "";
      const payload = parseErrorPayload(payloadText);
      if (!receivedFirstEvent) {
        es.close();
        void fallbackToSync(payloadText || "连接异常");
        return;
      }
      if (payload && showSetupHelp(payload.error, payload.message)) {
        setNotice(payload.message ?? "搜索前需要先完成本机环境准备。");
        return;
      }
      if (payload?.message || payload?.error) {
        setNotice(payload.message ?? payload.error ?? "搜索中断。");
      }
    });

    es.addEventListener("done", (event) => {
      receivedFirstEvent = true;
      es.close();
      sseRef.current = null;
      setLoading(false);
      try {
        const payload = JSON.parse((event as MessageEvent).data) as SearchErrorPayload;
        if (payload.ok === false) {
          if (showSetupHelp(payload.error, payload.message)) {
            setNotice(payload.message ?? "搜索前需要先完成本机环境准备。");
            return;
          }
          setNotice(payload.message ?? "搜索结束，但没有成功返回结果。");
          return;
        }
      } catch {
        // ignore malformed payload
      }
      setNotice("搜索完成。可以继续查看详情、加入职位看板或进入简历优化。");
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-sky-100 bg-white/82 p-4 shadow-[0_12px_40px_rgba(59,130,246,0.08)] sm:p-6">
        <FilterBar
          value={filters}
          onChange={setFilters}
          resultCount={filtered.length}
          onSearch={() => void runSearch()}
          searching={loading}
        />
        {notice && <p className="px-1 pt-4 text-sm text-muted-foreground">{notice}</p>}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em]">搜索结果</h2>
              <p className="text-sm text-muted-foreground">
                搜到的岗位先看内容，再决定要不要加入内容管理。
              </p>
            </div>
            <div className="flex items-center gap-2">
              {searched && !loading && filters.resultLimit < MAX_JOBS_PER_RUN ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    const nextLimit = Math.min(MAX_JOBS_PER_RUN, filters.resultLimit + 5);
                    setFilters((prev) => ({
                      ...prev,
                      resultLimit: nextLimit as FilterState["resultLimit"],
                    }));
                    void runSearch({
                      resultLimit: nextLimit,
                      replaceNotice: `正在继续加载，准备把结果上限提高到 ${nextLimit} 条。`,
                    });
                  }}
                >
                  加载更多
                </Button>
              ) : null}
              <Button asChild variant="outline" className="rounded-full">
                <a href="/content">查看职位看板</a>
              </Button>
            </div>
          </div>
          <JobList
            jobs={filtered}
            loading={loading && filtered.length === 0}
            emptyMessage={searched ? "这次没有找到合适岗位，换个关键词再试。" : "先搜索一个岗位方向。"}
            selectedJobId={selectedJobId}
            savedJobIds={savedJobIds}
            onSelect={(job) => setSelectedJobId(job.id)}
            onSave={(job) => void saveJob(job)}
            onOptimize={goToResume}
          />
        </div>

        <aside className="xl:sticky xl:top-28 xl:self-start">
          <div className="rounded-[2rem] border border-sky-100 bg-white/92 p-6 shadow-[0_14px_40px_rgba(59,130,246,0.08)]">
            {selectedJob && selectedJobDetail ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
                        {selectedJobDetail.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">{selectedJobDetail.company}</p>
                    </div>
                    <p className="text-lg font-semibold text-foreground">
                      {selectedJobDetail.salary ?? "薪资面议"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-sky-100 bg-sky-50/40 px-2.5 py-1">{selectedJob.city}</span>
                    <span className="rounded-full border border-sky-100 bg-sky-50/40 px-2.5 py-1">{selectedJob.experience}</span>
                    <span className="rounded-full border border-sky-100 bg-sky-50/40 px-2.5 py-1">{selectedJob.education}</span>
                    <span className="rounded-full border border-sky-100 bg-sky-50/40 px-2.5 py-1">{selectedJob.companySize}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={savedJobIds.has(selectedJobDetail.id) ? "secondary" : "outline"}
                    className="rounded-full"
                    onClick={() => void saveJob(selectedJob)}
                  >
                    <FolderPlus className="mr-1.5 h-4 w-4" />
                    {savedJobIds.has(selectedJobDetail.id) ? "已在职位看板" : "加入内容管理"}
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full bg-sky-600 text-white hover:bg-sky-700"
                    onClick={() => goToResume(selectedJob)}
                  >
                    进入简历优化
                  </Button>
                  {selectedJobDetail.url ? (
                    <Button asChild variant="ghost" className="rounded-full">
                      <a href={selectedJobDetail.url} target="_blank" rel="noreferrer noopener">
                        <ExternalLink className="mr-1.5 h-4 w-4" />
                        打开原链接
                      </a>
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    JD 预览
                  </h3>
                  <div className="max-h-[32rem] overflow-auto rounded-[1.5rem] bg-sky-50/80 p-5">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                      {selectedJobDetail.jdText}
                    </p>
                  </div>
                </div>

                {selectedJobDetail.requirements?.length ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      关键要求
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedJobDetail.requirements.map((requirement) => (
                        <span
                          key={requirement}
                          className="rounded-full border border-sky-100 bg-white px-3 py-1 text-xs text-muted-foreground"
                        >
                          {requirement}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3 text-sm text-muted-foreground">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">岗位详情</h2>
                <p>先搜索一个岗位，或者从左侧结果里点开一条职位。</p>
              </div>
            )}
          </div>
        </aside>
      </section>

      <SimpleModal
        open={Boolean(setupHelp)}
        title={setupHelp?.title ?? ""}
        onClose={() => setSetupHelp(null)}
      >
        {setupHelp?.message}
      </SimpleModal>
    </div>
  );
}
