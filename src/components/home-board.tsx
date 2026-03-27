"use client";

import type { MouseEvent } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { fetchWithAiHeaders } from "@/lib/client/fetch-with-ai";
import { FileDropzone } from "@/components/file-dropzone";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { SimpleModal } from "@/components/ui/simple-modal";
import {
  loadDefaultResumeMarkdown,
  saveDefaultResumeMarkdown,
} from "@/lib/client/default-resume-markdown";
import {
  clearResumeUploadedFromSession,
  readResumeUploadedFromSession,
  writeResumeUploadedToSession,
} from "@/lib/client/resume-session";
import {
  buildHomeDocumentTitle,
  defaultDocumentTitle,
} from "@/lib/workflow-steps";

type ApplicationListItem = {
  id: string;
  status: string;
  job: {
    title: string;
    company: string;
    salary: string | null;
    url: string | null;
  };
  resume: { title: string };
  scores: { matchScore: number }[];
};

type ApplicationDetail = {
  id: string;
  job: {
    id: string;
    title: string;
    company: string;
    salary: string | null;
    jdText: string;
  };
  resume: { id: string; rawMarkdown: string };
};

const statusLabel: Record<string, string> = {
  NEW: "新建",
  SCORED_HIGH: "高匹配",
  SCORED_LOW: "待提升",
  REVIEWED: "已审阅",
  READY_TO_APPLY: "准备投递",
};

const EXPLORER_PARAM_KEYS = [
  "jobId",
  "jobTitle",
  "company",
  "salary",
  "city",
  "platform",
  "experience",
  "education",
  "fromExplorer",
] as const;

export function HomeBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationIdFromQuery = searchParams.get("applicationId");

  const [applications, setApplications] = useState<ApplicationListItem[]>([]);
  const [resumeMd, setResumeMd] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [salary, setSalary] = useState("");
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [editApplicationId, setEditApplicationId] = useState<string | null>(
    null,
  );
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [visionBusy, setVisionBusy] = useState(false);
  const [visionNotice, setVisionNotice] = useState<string | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const resumeImportInFlight = useRef(false);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const [isResumeUploaded, setIsResumeUploaded] = useState(false);
  const [showPasteResume, setShowPasteResume] = useState(false);
  const [showResumeGateModal, setShowResumeGateModal] = useState(false);
  const [jobContextBanner, setJobContextBanner] = useState(false);
  const [contextCity, setContextCity] = useState<string | null>(null);
  const [contextPlatform, setContextPlatform] = useState<string | null>(null);
  const [contextJobUrl, setContextJobUrl] = useState<string | null>(null);

  const isEditMode = Boolean(editApplicationId && jobId && resumeId);

  const refresh = useCallback(async () => {
    const res = await fetchWithAiHeaders("/api/applications");
    if (res.ok) setApplications(await res.json());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    document.title = buildHomeDocumentTitle();
    return () => {
      document.title = defaultDocumentTitle();
    };
  }, []);

  /** 无 applicationId 时从本机预填默认简历；useLayoutEffect 避免与 debounce 竞态把服务器内容误写入 localStorage */
  useLayoutEffect(() => {
    if (applicationIdFromQuery) return;
    const saved = loadDefaultResumeMarkdown();
    setResumeMd(saved);
    if (saved.trim()) {
      setIsResumeUploaded(true);
      writeResumeUploadedToSession();
    } else {
      setIsResumeUploaded(false);
      clearResumeUploadedFromSession();
    }
  }, [applicationIdFromQuery]);

  useEffect(() => {
    if (applicationIdFromQuery) return;
    const t = window.setTimeout(() => {
      saveDefaultResumeMarkdown(resumeMd);
    }, 400);
    return () => clearTimeout(t);
  }, [resumeMd, applicationIdFromQuery]);

  useEffect(() => {
    if (applicationIdFromQuery) return;

    const jobIdParam = searchParams.get("jobId");
    const jobTitleParam = searchParams.get("jobTitle");
    if (!jobTitleParam && !jobIdParam) return;

    if (jobTitleParam) setJobTitle(jobTitleParam);
    const companyParam = searchParams.get("company");
    if (companyParam) setCompany(companyParam);
    const salaryParam = searchParams.get("salary");
    if (salaryParam) setSalary(salaryParam);
    const cityParam = searchParams.get("city");
    setContextCity(cityParam);
    const platformParam = searchParams.get("platform");
    setContextPlatform(platformParam);

    if (jobIdParam) {
      void (async () => {
        const jobRes = await fetchWithAiHeaders(`/api/jobs/${jobIdParam}`);
        if (!jobRes.ok) {
          setContextJobUrl(null);
          setJdText((prev) =>
            prev.trim() ? prev : "（来自岗位探索，请补充或粘贴完整 JD）",
          );
          return;
        }
        const job = (await jobRes.json()) as {
          title?: string;
          company?: string;
          salary?: string | null;
          jdText?: string;
          url?: string | null;
        };
        if (typeof job.title === "string" && job.title.trim()) {
          setJobTitle(job.title);
        }
        if (typeof job.company === "string" && job.company.trim()) {
          setCompany(job.company);
        }
        if (typeof job.salary === "string") {
          setSalary(job.salary);
        }
        setContextJobUrl(
          typeof job.url === "string" && job.url.trim() ? job.url.trim() : null,
        );
        if (typeof job.jdText === "string" && job.jdText.trim()) {
          setJdText(job.jdText);
        } else {
          setJdText((prev) =>
            prev.trim() ? prev : "（来自岗位探索，请补充或粘贴完整 JD）",
          );
        }
      })();
    } else {
      setJdText((prev) =>
        prev.trim() ? prev : "（来自岗位探索，请补充或粘贴完整 JD）",
      );
    }
    setJobContextBanner(true);

    if (
      searchParams.get("fromExplorer") === "1" &&
      !readResumeUploadedFromSession()
    ) {
      setShowResumeGateModal(true);
    }

    const next = new URLSearchParams(searchParams.toString());
    EXPLORER_PARAM_KEYS.forEach((k) => next.delete(k));
    const rest = next.toString();
    router.replace(rest ? `/workspace?${rest}` : "/workspace");
  }, [searchParams, router, applicationIdFromQuery]);

  useEffect(() => {
    if (!applicationIdFromQuery) {
      setEditApplicationId(null);
      setJobId(null);
      setEditLoadError(null);
      setEditLoading(false);
      return;
    }

    let cancelled = false;
    setEditLoading(true);
    setEditLoadError(null);

    void (async () => {
      const res = await fetchWithAiHeaders(
        `/api/applications/${applicationIdFromQuery}`,
      );
      if (cancelled) {
        setEditLoading(false);
        return;
      }
      if (!res.ok) {
        setEditLoadError("找不到该投递，请从列表重新进入。");
        setEditApplicationId(null);
        setJobId(null);
        setEditLoading(false);
        router.replace("/workspace");
        return;
      }
      const data = (await res.json()) as ApplicationDetail;
      setEditApplicationId(data.id);
      setJobId(data.job.id);
      setResumeId(data.resume.id);
      setJobTitle(data.job.title);
      setCompany(data.job.company);
      setSalary(data.job.salary ?? "");
      setJdText(data.job.jdText);
      setResumeMd(data.resume.rawMarkdown);
      setIsResumeUploaded(true);
      writeResumeUploadedToSession();
      setEditLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [applicationIdFromQuery, router]);

  async function ensureResume() {
    if (resumeId) return resumeId;
    const r = await fetchWithAiHeaders("/api/resumes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawMarkdown: resumeMd }),
    });
    const j = (await r.json()) as { id: string };
    setResumeId(j.id);
    return j.id;
  }

  function openResumeGate() {
    setShowResumeGateModal(true);
  }

  async function saveAndReturnToWorkspace() {
    if (!isEditMode || !jobId || !resumeId || !editApplicationId) return;
    setLoading(true);
    try {
      const titleTrim = jobTitle.trim();
      const jdTrim = jdText.trim();
      if (!titleTrim || !jdTrim) {
        alert("职位和 JD 不能为空");
        return;
      }
      const jobPatch = await fetchWithAiHeaders(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleTrim,
          company,
          salary: salary.trim() || null,
          jdText: jdTrim,
        }),
      });
      if (!jobPatch.ok) {
        const j = await jobPatch.json().catch(() => ({}));
        alert((j as { message?: string }).message ?? "保存岗位失败");
        return;
      }
      const resumePatch = await fetchWithAiHeaders(`/api/resumes/${resumeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawMarkdown: resumeMd }),
      });
      if (!resumePatch.ok) {
        alert("保存简历失败");
        return;
      }
      router.push(`/applications/${editApplicationId}`);
    } finally {
      setLoading(false);
    }
  }

  async function createJobAndApplication() {
    if (!isResumeUploaded || !resumeMd.trim()) {
      openResumeGate();
      return;
    }
    setLoading(true);
    try {
      const titleTrim = jobTitle.trim();
      const jdTrim = jdText.trim();
      if (!titleTrim || !jdTrim) {
        alert("职位和 JD 不能为空（抓取失败时请手动粘贴 JD）");
        return;
      }
      const rid = await ensureResume();
      const jobRes = await fetchWithAiHeaders("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleTrim,
          company,
          salary,
          jdText: jdTrim,
          platform: "MANUAL",
        }),
      });
      const job = (await jobRes.json()) as { id: string };
      const appRes = await fetchWithAiHeaders("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, resumeId: rid }),
      });
      const app = (await appRes.json()) as { id: string };
      router.push(`/applications/${app.id}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteApplication(e: MouseEvent, applicationId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (
      !window.confirm(
        "确定删除该投递？删除后可在首页重新创建；关联岗位若未被其他投递使用将保留在库中。",
      )
    ) {
      return;
    }
    const res = await fetchWithAiHeaders(`/api/applications/${applicationId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert("删除失败");
      return;
    }
    if (editApplicationId === applicationId) {
      router.replace("/workspace");
      setEditApplicationId(null);
      setJobId(null);
      setResumeId(null);
    }
    void refresh();
  }

  async function runVisionJob(file: File) {
    setVisionBusy(true);
    setVisionNotice("正在识别截图…");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetchWithAiHeaders("/api/vision/job-from-image", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setVisionNotice(data.message ?? data.error ?? "识别失败");
        return;
      }
      if (typeof data.title === "string" && data.title.trim())
        setJobTitle(data.title);
      if (typeof data.company === "string" && data.company.trim())
        setCompany(data.company);
      if (typeof data.salary === "string" && data.salary.trim())
        setSalary(data.salary);
      if (typeof data.jdText === "string" && data.jdText.trim())
        setJdText(data.jdText);
      setVisionNotice("截图识别成功，已自动填充岗位信息。");
    } finally {
      setVisionBusy(false);
    }
  }

  async function runResumeImport(file: File) {
    if (resumeImportInFlight.current) return;
    resumeImportInFlight.current = true;
    setVisionBusy(true);
    setResumeNotice("正在导入简历…");
    try {
      const form = new FormData();
      form.append("file", file);
      const signal =
        typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
          ? AbortSignal.timeout(120_000)
          : undefined;
      const res = await fetchWithAiHeaders("/api/resume-import", {
        method: "POST",
        body: form,
        signal,
      });
      const bodyText = await res.text();
      let data: {
        error?: string;
        message?: string;
        rawMarkdown?: string;
        resumeId?: string;
      };
      try {
        data = JSON.parse(bodyText) as typeof data;
      } catch {
        setResumeNotice(
          `导入失败（HTTP ${res.status}）：服务器返回非 JSON，请重试或检查接口路由。`,
        );
        return;
      }
      if (!res.ok) {
        setResumeNotice(data.message ?? data.error ?? "导入失败");
        return;
      }
      if (typeof data.rawMarkdown === "string" && data.rawMarkdown.trim()) {
        setResumeMd(data.rawMarkdown);
        saveDefaultResumeMarkdown(data.rawMarkdown);
      }
      if (typeof data.resumeId === "string") setResumeId(data.resumeId);
      setResumeNotice("简历导入成功，已填充到文本框。");
      setIsResumeUploaded(true);
      writeResumeUploadedToSession();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setResumeNotice(`导入失败：${msg}`);
    } finally {
      resumeImportInFlight.current = false;
      setVisionBusy(false);
    }
  }

  function confirmPastedResume() {
    if (!resumeMd.trim()) {
      setResumeNotice("请先粘贴或输入简历内容。");
      return;
    }
    saveDefaultResumeMarkdown(resumeMd);
    setIsResumeUploaded(true);
    writeResumeUploadedToSession();
    setResumeNotice("已确认使用当前简历内容。");
    setShowPasteResume(false);
  }

  const stepperApplicationId =
    editApplicationId ?? applicationIdFromQuery ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <SimpleModal
        open={showResumeGateModal}
        title="请先上传简历"
        onClose={() => setShowResumeGateModal(false)}
        primaryLabel="我知道了"
        onPrimary={() => {}}
      >
        <p>
          用于生成个性化投递内容。请在下方「简历」模块上传 PDF
          或粘贴简历后再继续。
        </p>
      </SimpleModal>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">岗位与投递</h1>
          <p className="text-sm text-muted-foreground">
            左侧维护简历与 JD，一键创建投递并在详情页进行 AI 评分与改写。
          </p>
          {jobContextBanner && (
            <Card className="mt-4 border-orange-200/80 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-950/20">
              <CardContent className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 text-sm">
                <span className="font-semibold text-foreground">
                  当前职位：{jobTitle || "—"}
                </span>
                {contextJobUrl && (
                  <a
                    href={contextJobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    BOSS 原文
                  </a>
                )}
                <span className="text-muted-foreground">{company || "—"}</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  {salary || "—"}
                </span>
                {(contextCity || contextPlatform) && (
                  <span className="text-xs text-muted-foreground">
                    {[contextCity, contextPlatform].filter(Boolean).join(" · ")}
                  </span>
                )}
              </CardContent>
            </Card>
          )}
          <WorkflowStepper
            className="mt-4"
            activeIndex={0}
            applicationId={stepperApplicationId}
            finishComplete={false}
          />
          {editLoading && (
            <p className="mt-2 text-sm text-muted-foreground">
              正在加载投递数据…
            </p>
          )}
          {editLoadError && (
            <p className="mt-2 text-sm text-destructive">{editLoadError}</p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. 简历（Markdown）</CardTitle>
            <p className="text-xs text-muted-foreground">
              默认简历仅保存在当前浏览器 localStorage，不上传数据库。
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {isResumeUploaded ? (
              <>
                <FileDropzone
                  title="上传/粘贴简历（PDF 或图片）"
                  description="支持 PDF 或图片；可拖拽/选择文件；粘贴图片请聚焦此区域后 Ctrl/Cmd+V。"
                  accept="application/pdf,image/*"
                  disabled={visionBusy || loading}
                  onFile={runResumeImport}
                />
                <Textarea
                  value={resumeMd}
                  onChange={(e) => setResumeMd(e.target.value)}
                  className="min-h-[160px] font-mono text-xs"
                />
              </>
            ) : (
              <div className="space-y-4 rounded-lg border border-dashed bg-muted/20 p-6">
                <p className="text-sm text-muted-foreground">
                  上传简历后可获得{" "}
                  <strong className="text-foreground">AI 匹配评分</strong> 和{" "}
                  <strong className="text-foreground">自动改写能力</strong>。
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={visionBusy || loading}
                    onClick={() => pdfInputRef.current?.click()}
                  >
                    上传 PDF
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={visionBusy || loading}
                    onClick={() => setShowPasteResume(true)}
                  >
                    粘贴简历
                  </Button>
                </div>
                <input
                  ref={pdfInputRef}
                  type="file"
                  className="hidden"
                  accept="application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void runResumeImport(file);
                  }}
                />
                {showPasteResume && (
                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="paste-resume">粘贴为 Markdown</Label>
                    <Textarea
                      id="paste-resume"
                      value={resumeMd}
                      onChange={(e) => setResumeMd(e.target.value)}
                      placeholder="在此粘贴简历文本或 Markdown…"
                      className="min-h-[160px] font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={confirmPastedResume}
                    >
                      确认使用此简历
                    </Button>
                  </div>
                )}
              </div>
            )}
            {resumeNotice && (
              <p className="text-xs text-muted-foreground">{resumeNotice}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. 岗位 JD</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>职位</Label>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>公司</Label>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>薪资</Label>
                <Input
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>职位描述</Label>
              <Textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>职位截图识别（推荐）</Label>
              <FileDropzone
                title="上传/粘贴职位截图"
                description="支持拖拽/选择文件；粘贴图片请聚焦此区域后 Ctrl/Cmd+V。"
                accept="image/*"
                disabled={visionBusy || loading}
                onFile={runVisionJob}
              />
              <p className="text-xs text-muted-foreground">
                需在右上角「API 设置」选择支持 Vision
                的模型（不同供应商命名不同）。
              </p>
              {visionNotice && (
                <p className="text-xs text-muted-foreground">{visionNotice}</p>
              )}
            </div>

            {isEditMode ? (
              <Button
                onClick={saveAndReturnToWorkspace}
                disabled={loading || editLoading}
              >
                {loading ? "处理中…" : "保存并返回工作台"}
              </Button>
            ) : (
              <Button
                onClick={createJobAndApplication}
                disabled={loading || editLoading}
              >
                {loading ? "处理中…" : "创建投递并进入工作台"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle className="text-base">投递列表</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <div className="space-y-2 p-4 pt-0">
                {applications.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    暂无投递，请先左侧创建。
                  </p>
                )}
                {applications.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-stretch gap-1 rounded-md border transition-colors hover:bg-muted/50"
                  >
                    <Link
                      href={`/applications/${a.id}`}
                      className="min-w-0 flex-1 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium leading-tight">
                            {a.job.title}
                          </div>
                          {a.job.url && /^https?:\/\//i.test(a.job.url) && (
                            <span
                              role="link"
                              tabIndex={0}
                              className="mt-0.5 inline-block cursor-pointer text-xs text-primary underline-offset-2 hover:underline"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open(
                                  a.job.url!,
                                  "_blank",
                                  "noopener,noreferrer",
                                );
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  window.open(
                                    a.job.url!,
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                                }
                              }}
                            >
                              BOSS 原文
                            </span>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {a.job.company}
                            {a.job.salary ? ` · ${a.job.salary}` : ""}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {statusLabel[a.status] ?? a.status}
                        </Badge>
                      </div>
                      {a.scores[0] && (
                        <div className="mt-2 text-xs text-orange-600">
                          匹配分 {a.scores[0].matchScore}
                        </div>
                      )}
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      title="删除投递"
                      onClick={(e) => void deleteApplication(e, a.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
