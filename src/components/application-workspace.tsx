"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchWithAiHeaders } from "@/lib/client/fetch-with-ai";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { SimpleModal } from "@/components/ui/simple-modal";
import {
  buildWorkspaceDocumentTitle,
  defaultDocumentTitle,
} from "@/lib/workflow-steps";

type ScoreAnalysis = {
  matchScore?: number;
  jdKeywords?: string[];
  hitKeywords?: string[];
  missingKeywords?: string[];
  weakPoints?: string[];
  summary?: string;
};

type ApplicationDTO = {
  id: string;
  status: string;
  tailoredResumeJson: string | null;
  coverLetter: string | null;
  job: {
    id: string;
    title: string;
    company: string;
    salary: string | null;
    jdText: string;
    url: string | null;
  };
  resume: { id: string; title: string; rawMarkdown: string };
  scores: {
    id: string;
    matchScore: number;
    analysisJson: ScoreAnalysis;
    createdAt: string;
  }[];
};

const statusLabel: Record<string, string> = {
  NEW: "新建",
  SCORED_HIGH: "高匹配",
  SCORED_LOW: "待提升",
  REVIEWED: "已审阅",
  READY_TO_APPLY: "准备投递",
};

export function ApplicationWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<ApplicationDTO | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [tailoredPreview, setTailoredPreview] = useState("");
  const [cover, setCover] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resumeGateOpen, setResumeGateOpen] = useState(false);

  function parseJsonSafely(raw: string): unknown {
    if (!raw.trim()) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }

  const load = useCallback(async () => {
    const res = await fetchWithAiHeaders(`/api/applications/${id}`);
    if (!res.ok) {
      setErr("加载失败");
      return;
    }
    const j = (await res.json()) as ApplicationDTO;
    setData(j);
    setResumeText(j.resume.rawMarkdown);
    setCover(j.coverLetter ?? "");
    if (j.tailoredResumeJson) {
      try {
        const t = JSON.parse(j.tailoredResumeJson) as { fullMarkdown?: string };
        setTailoredPreview(t.fullMarkdown ?? "");
      } catch {
        setTailoredPreview("");
      }
    } else {
      setTailoredPreview("");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    document.title = buildWorkspaceDocumentTitle(
      data.job.title,
      data.job.company,
    );
    return () => {
      document.title = defaultDocumentTitle();
    };
  }, [data]);

  async function deleteApplication() {
    if (!window.confirm("确定删除该投递？删除后将返回首页，此操作不可撤销。")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetchWithAiHeaders(`/api/applications/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setErr("删除失败");
        return;
      }
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  async function saveResume() {
    if (!data) return;
    setBusy(true);
    try {
      await fetchWithAiHeaders(`/api/resumes/${data.resume.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawMarkdown: resumeText }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function patchStatus(status: string) {
    setBusy(true);
    try {
      await fetchWithAiHeaders(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  function requireResumeForAi(run: () => void) {
    if (!resumeText.trim()) {
      setResumeGateOpen(true);
      return;
    }
    run();
  }

  async function runScore() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchWithAiHeaders(`/api/applications/${id}/score`, {
        method: "POST",
      });
      const scoreRaw = await res.text();
      const parsed = parseJsonSafely(scoreRaw);
      const j = (parsed ?? {}) as { error?: string };
      if (!res.ok) {
        throw new Error(
          j.error ??
            (scoreRaw.trim() ? scoreRaw : `评分失败（HTTP ${res.status}）`),
        );
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "错误");
    } finally {
      setBusy(false);
    }
  }

  async function runTailor() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchWithAiHeaders(
        `/api/applications/${id}/tailor-resume`,
        {
          method: "POST",
        },
      );
      const tailorRaw = await res.text();
      const parsed = parseJsonSafely(tailorRaw);
      const j = (parsed ?? {}) as {
        error?: string;
        tailored?: { fullMarkdown?: string };
      };
      if (!res.ok) {
        throw new Error(
          j.error ??
            (tailorRaw.trim() ? tailorRaw : `改写失败（HTTP ${res.status}）`),
        );
      }
      if (j.tailored?.fullMarkdown) setTailoredPreview(j.tailored.fullMarkdown);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "错误");
    } finally {
      setBusy(false);
    }
  }

  async function runCover() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchWithAiHeaders(
        `/api/applications/${id}/cover-letter`,
        {
          method: "POST",
        },
      );
      const coverRaw = await res.text();
      const parsed = parseJsonSafely(coverRaw);
      const j = (parsed ?? {}) as { error?: string; coverLetter?: string };
      if (!res.ok) {
        throw new Error(
          j.error ??
            (coverRaw.trim() ? coverRaw : `生成失败（HTTP ${res.status}）`),
        );
      }
      setCover(j.coverLetter ?? "");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "错误");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        {err ?? "加载中…"}
      </div>
    );
  }

  const latest = data.scores[0];
  const analysis = latest?.analysisJson;
  const finishComplete = data.status === "READY_TO_APPLY";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/">返回探索</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/workspace?applicationId=${encodeURIComponent(id)}`}>
                上一步：编辑简历与 JD
              </Link>
            </Button>
            <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <span className="font-medium">
                {data.job.title} · {data.job.company}
              </span>
              {data.job.salary && (
                <span className="text-base font-semibold text-orange-600 dark:text-orange-400">
                  {data.job.salary}
                </span>
              )}
            </div>
            <Badge variant="secondary">
              {statusLabel[data.status] ?? data.status}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={saveResume}
              disabled={busy}
            >
              保存简历
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void deleteApplication()}
              disabled={busy}
            >
              删除此投递
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a
                href={`/api/applications/${id}/export/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                导出 PDF
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a
                href={`/api/applications/${id}/export/docx`}
                target="_blank"
                rel="noreferrer"
              >
                导出 Word
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a
                href={`/api/applications/${id}/export/md`}
                target="_blank"
                rel="noreferrer"
              >
                导出 Markdown
              </a>
            </Button>
          </div>
        </div>
        <WorkflowStepper
          className="mt-4"
          activeIndex={1}
          applicationId={id}
          finishComplete={finishComplete}
        />
      </header>

      <SimpleModal
        open={resumeGateOpen}
        title="请先上传简历"
        onClose={() => setResumeGateOpen(false)}
        primaryLabel="我知道了"
        onPrimary={() => {}}
      >
        <p>
          用于生成个性化投递内容。请返回上一步在「简历」模块上传或粘贴简历后再使用
          AI 功能。
        </p>
      </SimpleModal>

      {err && (
        <div className="bg-destructive/10 px-6 py-2 text-sm text-destructive">
          {err}
        </div>
      )}

      <div className="grid flex-1 gap-0 lg:grid-cols-[280px_1fr_340px]">
        <aside className="border-r bg-muted/20 p-4">
          <h2 className="mb-3 text-sm font-semibold">岗位信息</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">薪资 </span>
              <span className="text-orange-600 font-medium">
                {data.job.salary ?? "—"}
              </span>
            </div>
            {data.job.url && (
              <a
                href={data.job.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                原链接
              </a>
            )}
          </div>
          <Separator className="my-4" />
          <ScrollArea className="h-[55vh]">
            <pre className="whitespace-pre-wrap text-xs leading-relaxed">
              {data.job.jdText}
            </pre>
          </ScrollArea>
          <Separator className="my-4" />
          <div className="space-y-2">
            <p className="text-xs font-medium">状态流转</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => patchStatus("REVIEWED")}
              >
                标为已审阅
              </Button>
              <Button size="sm" onClick={() => patchStatus("READY_TO_APPLY")}>
                准备投递
              </Button>
            </div>
          </div>
        </aside>

        <main className="flex flex-col border-r">
          <div className="border-b px-4 py-2 text-xs text-muted-foreground">
            简历编辑（中间栏）— 左侧为原始 Markdown，下方为 AI 定制预览
          </div>
          <div className="grid flex-1 gap-4 p-4 md:grid-rows-2">
            <div className="flex min-h-0 flex-col gap-2">
              <span className="text-sm font-medium">原始简历</span>
              <Textarea
                className="min-h-[200px] flex-1 font-mono text-xs"
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
              />
            </div>
            <div className="flex min-h-0 flex-col gap-2">
              <span className="text-sm font-medium">定制简历预览</span>
              <ScrollArea className="h-[240px] rounded-md border bg-muted/30 p-3">
                <pre className="whitespace-pre-wrap text-xs">
                  {tailoredPreview ||
                    "点击右侧「简历定制」生成 STAR 结构化内容"}
                </pre>
              </ScrollArea>
            </div>
          </div>
        </main>

        <aside className="bg-muted/10 p-4">
          <h2 className="mb-3 text-sm font-semibold">AI 分析</h2>
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => requireResumeForAi(() => void runScore())}
              disabled={busy}
            >
              AI 匹配评分
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => requireResumeForAi(() => void runTailor())}
              disabled={busy}
            >
              简历定制（STAR）
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={runCover}
              disabled={busy}
            >
              生成开场白
            </Button>
          </div>

          {latest && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  匹配分{" "}
                  <span className="text-orange-600">{latest.matchScore}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {analysis?.summary && (
                  <p className="text-muted-foreground">{analysis.summary}</p>
                )}
                <div>
                  <p className="mb-1 text-xs font-medium text-emerald-700">
                    命中关键词
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(analysis?.hitKeywords ?? []).map((k) => (
                      <Badge key={k} variant="success">
                        {k}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-red-700">
                    缺失关键词
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(analysis?.missingKeywords ?? []).map((k) => (
                      <Badge key={k} variant="destructive">
                        {k}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium">薄弱点</p>
                  <ul className="list-inside list-disc text-xs text-muted-foreground">
                    {(analysis?.weakPoints ?? []).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">开场白</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {cover || "点击「生成开场白」"}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
