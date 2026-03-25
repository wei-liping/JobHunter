"use client";

import type { MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  buildHomeDocumentTitle,
  defaultDocumentTitle,
} from "@/lib/workflow-steps";

type ApplicationListItem = {
  id: string;
  status: string;
  job: { title: string; company: string; salary: string | null };
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

export function HomeBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationIdFromQuery = searchParams.get("applicationId");

  const [applications, setApplications] = useState<ApplicationListItem[]>([]);
  const [resumeMd, setResumeMd] = useState(
    "## 张三\n\n### 工作经历\n- 某公司 · 工程师 · 2021-至今\n  - 负责后端与 AI 功能交付。\n",
  );
  const [jobTitle, setJobTitle] = useState("AI 产品经理");
  const [company, setCompany] = useState("示例医疗科技");
  const [salary, setSalary] = useState("20-30K");
  const [jdText, setJdText] = useState(
    "岗位职责：负责 AI 产品规划...\n任职要求：本科，5 年经验，熟悉大模型应用。",
  );
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
        router.replace("/");
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
      router.replace("/");
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
      }
      if (typeof data.resumeId === "string") setResumeId(data.resumeId);
      setResumeNotice("简历导入成功，已填充到文本框。");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setResumeNotice(`导入失败：${msg}`);
    } finally {
      resumeImportInFlight.current = false;
      setVisionBusy(false);
    }
  }

  const stepperApplicationId =
    editApplicationId ?? applicationIdFromQuery ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">岗位与投递</h1>
          <p className="text-sm text-muted-foreground">
            左侧维护简历与 JD，一键创建投递并在详情页进行 AI 评分与改写。
          </p>
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
          </CardHeader>
          <CardContent className="space-y-2">
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
