"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, FileUp, Save, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/file-dropzone";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { fetchWithAiHeaders } from "@/lib/client/fetch-with-ai";
import { isDemoModeClient } from "@/lib/demo/mode";
import {
  createDemoResume,
  listDemoResumes,
  type DemoResumeRow,
} from "@/lib/client/demo-local-store";

type SavedJobRow = {
  id: string;
  job: {
    id: string;
    title: string;
    company: string;
    salary: string | null;
    jdText: string;
    url: string | null;
    companyInfo?: unknown;
  };
};

type ResumeRow = {
  id: string;
  title: string;
  rawMarkdown: string;
  sourceType?: string;
  sourceLabel?: string | null;
  sourceJob?: { id: string; title: string; company: string } | null;
  parentResume?: { id: string; title: string } | null;
};

type ScoreResult = {
  matchScore: number;
  jdKeywords: string[];
  hitKeywords: string[];
  missingKeywords: string[];
  weakPoints: string[];
  gapProjects: {
    title: string;
    goal: string;
    techStack: string[];
    deliverables: string[];
    eta: string;
  }[];
  summary: string;
};

type TailorResult = {
  sections: { title: string; bullets: string[] }[];
  fullMarkdown: string;
};

type ResultTab = "score" | "tailor" | "cover";

function pickText(info: unknown, keys: string[]) {
  if (!info || typeof info !== "object") return "";
  const dict = info as Record<string, unknown>;
  for (const key of keys) {
    const value = dict[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function downloadMarkdown(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildScoreMarkdown(jobTitle: string, result: ScoreResult) {
  const lines = [
    `# ${jobTitle} - AI 评估`,
    "",
    `- 匹配分数：${result.matchScore} 分`,
    `- 已覆盖：${result.hitKeywords.length ? result.hitKeywords.join("、") : "暂无"}`,
    `- 缺失点：${result.missingKeywords.length ? result.missingKeywords.join("、") : "暂无"}`,
    "",
    "## 评估总结",
    "",
    result.summary,
    "",
    "## 当前薄弱点",
    "",
    ...(result.weakPoints.length
      ? result.weakPoints.map((item) => `- ${item}`)
      : ["- 暂无"]),
    "",
    "## 建议补的短项目",
    "",
  ];

  if (!result.gapProjects.length) {
    lines.push("- 暂无");
  } else {
    for (const project of result.gapProjects) {
      lines.push(`### ${project.title}`);
      lines.push("");
      lines.push(`- 目标：${project.goal}`);
      lines.push(`- 建议技术栈：${project.techStack.join("、") || "暂无"}`);
      lines.push(`- 建议产出：${project.deliverables.join("；") || "暂无"}`);
      lines.push(`- 预计时长：${project.eta}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

const studioColumnClass =
  "rounded-[2rem] border border-sky-100 bg-white/92 p-5 shadow-[0_12px_40px_rgba(59,130,246,0.08)] xl:flex xl:h-[calc(100vh-8.5rem)] xl:min-h-[44rem] xl:flex-col xl:overflow-hidden";

const resultCardClass = "rounded-[1.25rem] bg-white p-4";
const resultViewportClass =
  "h-[62vh] min-h-[22rem] max-h-[42rem] xl:h-full xl:min-h-0 xl:max-h-none";
const panelScrollClass =
  "overflow-y-auto overscroll-contain min-h-0 [scrollbar-gutter:stable] [webkit-overflow-scrolling:touch]";

function mapDemoResumeToRow(r: DemoResumeRow): ResumeRow {
  return {
    id: r.id,
    title: r.title,
    rawMarkdown: r.rawMarkdown,
    sourceType: r.sourceType,
    sourceLabel: r.sourceLabel,
    sourceJob: null,
    parentResume: null,
  };
}

export function ResumeStudioPage() {
  const searchParams = useSearchParams();
  const isDemo = isDemoModeClient();
  const [savedJobs, setSavedJobs] = useState<SavedJobRow[]>([]);
  const [resumes, setResumes] = useState<ResumeRow[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [resumeTitle, setResumeTitle] = useState("我的简历");
  const [resumeMarkdown, setResumeMarkdown] = useState("");
  const [editorSourceType, setEditorSourceType] = useState("MANUAL");
  const [editorSourceLabel, setEditorSourceLabel] = useState("手动填写");
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [tailorResult, setTailorResult] = useState<TailorResult | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>("score");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedJob = useMemo(
    () => savedJobs.find((item) => item.job.id === selectedJobId)?.job ?? null,
    [savedJobs, selectedJobId],
  );
  const selectedResume = useMemo(
    () => resumes.find((item) => item.id === selectedResumeId) ?? null,
    [resumes, selectedResumeId],
  );

  async function loadSavedJobs() {
    const res = await fetchWithAiHeaders("/api/saved-jobs");
    if (!res.ok) return;
    const rows = (await res.json()) as SavedJobRow[];
    setSavedJobs(rows);
  }

  async function loadResumes() {
    if (isDemo) {
      setResumes(listDemoResumes().map(mapDemoResumeToRow));
      return;
    }
    const res = await fetchWithAiHeaders("/api/resumes");
    if (!res.ok) return;
    const rows = (await res.json()) as ResumeRow[];
    setResumes(rows);
  }

  useEffect(() => {
    void loadSavedJobs();
    void loadResumes();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 首次加载即可
  }, []);

  useEffect(() => {
    const jobId = searchParams?.get("jobId");
    const resumeId = searchParams?.get("resumeId");

    if (jobId) {
      setSelectedJobId(jobId);
      void (async () => {
        const exists = savedJobs.some((item) => item.job.id === jobId);
        if (exists) return;
        const res = await fetchWithAiHeaders(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const job = (await res.json()) as SavedJobRow["job"];
        setSavedJobs((prev) => [{ id: `temp-${job.id}`, job }, ...prev]);
      })();
    }

    if (resumeId) {
      setSelectedResumeId(resumeId);
    }
  }, [savedJobs, searchParams]);

  useEffect(() => {
    if (!selectedResume) return;
    setResumeTitle(selectedResume.title);
    setResumeMarkdown(selectedResume.rawMarkdown);
    setEditorSourceType(selectedResume.sourceType ?? "MANUAL");
    setEditorSourceLabel(selectedResume.sourceLabel ?? selectedResume.title);
  }, [selectedResume]);

  async function runScore() {
    if (!selectedJobId || !resumeMarkdown.trim()) {
      setNotice("先选择岗位并准备一份简历。");
      return;
    }
    setBusyKey("score");
    setActiveResultTab("score");
    setNotice(null);
    try {
      const res = await fetchWithAiHeaders("/api/resume-studio/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJobId,
          resumeMarkdown,
        }),
      });
      const body = (await res.json()) as ScoreResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "评估失败");
      setScoreResult(body);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "评估失败");
    } finally {
      setBusyKey(null);
    }
  }

  async function runTailor() {
    if (!selectedJobId || !resumeMarkdown.trim()) {
      setNotice("先选择岗位并准备一份简历。");
      return;
    }
    setBusyKey("tailor");
    setActiveResultTab("tailor");
    setNotice(null);
    try {
      const res = await fetchWithAiHeaders("/api/resume-studio/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJobId,
          resumeMarkdown,
        }),
      });
      const body = (await res.json()) as {
        tailored?: TailorResult;
        error?: string;
      };
      if (!res.ok || !body.tailored) throw new Error(body.error ?? "润色失败");
      setTailorResult(body.tailored);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "润色失败");
    } finally {
      setBusyKey(null);
    }
  }

  async function runCoverLetter() {
    if (!selectedJobId || !resumeMarkdown.trim()) {
      setNotice("先选择岗位并准备一份简历。");
      return;
    }
    setBusyKey("cover");
    setActiveResultTab("cover");
    setNotice(null);
    try {
      const res = await fetchWithAiHeaders("/api/resume-studio/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJobId,
          resumeMarkdown,
        }),
      });
      const body = (await res.json()) as {
        coverLetter?: string;
        error?: string;
      };
      if (!res.ok || !body.coverLetter)
        throw new Error(body.error ?? "开场白生成失败");
      setCoverLetter(body.coverLetter);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "开场白生成失败");
    } finally {
      setBusyKey(null);
    }
  }

  async function importResumeFile(file: File) {
    const form = new FormData();
    form.set("file", file);
    form.set("persist", "0");
    const res = await fetchWithAiHeaders("/api/resume-import", {
      method: "POST",
      body: form,
    });
    const body = (await res.json()) as {
      rawMarkdown?: string;
      message?: string;
      error?: string;
    };
    if (!res.ok || !body.rawMarkdown) {
      setNotice(body.message ?? body.error ?? "导入失败");
      return;
    }
    setResumeMarkdown(body.rawMarkdown);
    setEditorSourceType(file.type.startsWith("image/") ? "OCR" : "IMPORTED");
    setEditorSourceLabel(file.name || "导入识别");
    setNotice("已识别为 Markdown，可以继续修改后再决定是否保存。");
  }

  async function saveCurrentResume() {
    if (!resumeMarkdown.trim()) {
      setNotice("当前没有可保存的简历内容。");
      return;
    }
    setBusyKey("saveCurrent");
    setNotice(null);
    try {
      if (isDemo) {
        const body = createDemoResume({
          title: resumeTitle.trim() || "我的简历",
          rawMarkdown: resumeMarkdown,
          sourceType: editorSourceType,
          sourceLabel: editorSourceLabel,
          sourceJobId: selectedJobId || null,
          parentResumeId: selectedResumeId || null,
        });
        await loadResumes();
        setSelectedResumeId(body.id);
        setNotice("当前简历已保存到本浏览器（演示版不落库）。");
        return;
      }
      const res = await fetchWithAiHeaders("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: resumeTitle.trim() || "我的简历",
          rawMarkdown: resumeMarkdown,
          sourceType: editorSourceType,
          sourceLabel: editorSourceLabel,
          sourceJobId: selectedJobId || null,
          parentResumeId: selectedResumeId || null,
        }),
      });
      const body = (await res.json()) as ResumeRow;
      if (!res.ok) throw new Error("保存失败");
      await loadResumes();
      setSelectedResumeId(body.id);
      setNotice("当前简历已保存为新版本。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveTailoredResume() {
    if (!tailorResult?.fullMarkdown.trim()) {
      setNotice("先生成一份润色结果，再保存。");
      return;
    }
    setBusyKey("saveTailored");
    setNotice(null);
    try {
      if (isDemo) {
        const body = createDemoResume({
          title: `${selectedJob?.title ?? "岗位"} - 定制简历`,
          rawMarkdown: tailorResult.fullMarkdown,
          sourceType: "TAILORED",
          sourceLabel: `针对 ${selectedJob?.title ?? "目标岗位"} 的润色版本`,
          sourceJobId: selectedJobId || null,
          parentResumeId: selectedResumeId || null,
        });
        await loadResumes();
        setNotice("润色结果已保存到本浏览器（演示版不落库）。");
        setSelectedResumeId(body.id);
        return;
      }
      const res = await fetchWithAiHeaders("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${selectedJob?.title ?? "岗位"} - 定制简历`,
          rawMarkdown: tailorResult.fullMarkdown,
          sourceType: "TAILORED",
          sourceLabel: `针对 ${selectedJob?.title ?? "目标岗位"} 的润色版本`,
          sourceJobId: selectedJobId || null,
          parentResumeId: selectedResumeId || null,
        }),
      });
      const body = (await res.json()) as ResumeRow;
      if (!res.ok) throw new Error("保存失败");
      await loadResumes();
      setNotice("润色结果已保存为新版本。");
      setSelectedResumeId(body.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusyKey(null);
    }
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(successMessage);
    } catch {
      setNotice("复制失败，请重试。");
    }
  }

  function hasResult(tab: ResultTab) {
    if (tab === "score") return Boolean(scoreResult);
    if (tab === "tailor") return Boolean(tailorResult);
    return Boolean(coverLetter);
  }

  function selectResultTab(tab: ResultTab) {
    if (busyKey !== null) return;
    if (tab === "score" && !scoreResult) {
      void runScore();
      return;
    }
    if (tab === "tailor" && !tailorResult) {
      void runTailor();
      return;
    }
    if (tab === "cover" && !coverLetter) {
      void runCoverLetter();
      return;
    }
    setActiveResultTab(tab);
  }

  function renderResultPanel() {
    if (activeResultTab === "score") {
      if (!scoreResult) {
        return (
          <div
            className={`flex min-h-0 flex-1 overflow-hidden ${resultViewportClass}`}
          >
            <div
              className={`h-full w-full rounded-[1.5rem] bg-sky-50/70 p-5 text-sm text-muted-foreground ${panelScrollClass}`}
            >
              先点一次“AI
              评估”，这里会显示匹配分数、已覆盖、缺失点、一句话判断、当前薄弱点和建议补充短项目。
            </div>
          </div>
        );
      }

      return (
        <div
          className={`flex min-h-0 flex-1 overflow-hidden ${resultViewportClass}`}
        >
          <div className={`h-full w-full pr-1 ${panelScrollClass}`}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">AI 评估</h3>
                  <p className="text-sm text-muted-foreground">
                    按阅读顺序往下看，每段都用更平直的横向排法。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void runScore()}
                    disabled={busyKey !== null}
                  >
                    {busyKey === "score" ? "评估中..." : "重新生成"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      downloadMarkdown(
                        `${selectedJob?.title ?? "resume-score"}.md`,
                        buildScoreMarkdown(
                          selectedJob?.title ?? "目标岗位",
                          scoreResult,
                        ),
                      )
                    }
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    导出 Markdown
                  </Button>
                </div>
              </div>

              <div className={`${resultCardClass} space-y-3`}>
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
                  <div className="w-24 shrink-0 text-sm font-semibold text-slate-900">
                    匹配分数
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <span className="text-4xl font-semibold tracking-[-0.06em] text-sky-700">
                      {scoreResult.matchScore}
                    </span>
                    <span className="pb-1 text-sm font-medium text-slate-500">
                      / 100
                    </span>
                    <span className="pb-1 text-sm text-muted-foreground">
                      基于岗位要求与当前简历的整体贴合度
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
                  <div className="w-24 shrink-0 text-sm font-semibold text-slate-900">
                    已覆盖
                  </div>
                  <div className="flex-1 space-y-2">
                    {scoreResult.hitKeywords.length ? (
                      scoreResult.hitKeywords.map((item) => (
                        <div
                          key={item}
                          className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-sm text-slate-800"
                        >
                          <span className="mt-1 h-2 w-2 rounded-full bg-sky-500" />
                          <span className="font-medium leading-6">{item}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="w-24 shrink-0 text-sm font-semibold text-slate-900">
                    缺失点
                  </div>
                  <div className="flex-1 space-y-2">
                    {scoreResult.missingKeywords.length ? (
                      scoreResult.missingKeywords.map((item) => (
                        <div
                          key={item}
                          className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50/80 px-3 py-2 text-sm text-slate-800"
                        >
                          <span className="mt-1 h-2 w-2 rounded-full bg-rose-500" />
                          <span className="font-medium leading-6">{item}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无</p>
                    )}
                  </div>
                </div>
              </div>

              <div className={resultCardClass}>
                <p className="text-sm font-semibold text-slate-900">
                  一句话判断
                </p>
                <p className="mt-2 text-sm leading-7 text-foreground">
                  {scoreResult.summary}
                </p>
              </div>

              <div className={resultCardClass}>
                <p className="text-sm font-semibold text-slate-900">
                  当前薄弱点
                </p>
                <div className="mt-3 space-y-2">
                  {scoreResult.weakPoints.length ? (
                    scoreResult.weakPoints.map((point) => (
                      <div
                        key={point}
                        className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-700"
                      >
                        <span className="mt-1 h-2 w-2 rounded-full bg-slate-400" />
                        <span className="leading-6">{point}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无</p>
                  )}
                </div>
              </div>

              <div className={resultCardClass}>
                <p className="text-sm font-semibold text-slate-900">
                  建议补充短项目
                </p>
                <div className="mt-3 space-y-3">
                  {scoreResult.gapProjects.length ? (
                    scoreResult.gapProjects.map((project) => (
                      <div
                        key={project.title}
                        className="rounded-[1rem] border border-sky-100 bg-sky-50/60 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">
                              {project.title}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {project.goal}
                            </p>
                          </div>
                          <span className="rounded-full border border-sky-100 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                            {project.eta}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {project.techStack.map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-sky-100 bg-white px-2.5 py-1 text-xs text-slate-600"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {project.deliverables.map((item) => (
                            <div
                              key={item}
                              className="flex items-start gap-2 text-sm text-slate-700"
                            >
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                              <span className="leading-6">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无。</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeResultTab === "tailor") {
      if (!tailorResult) {
        return (
          <div
            className={`flex min-h-0 flex-1 overflow-hidden ${resultViewportClass}`}
          >
            <div
              className={`h-full w-full rounded-[1.5rem] bg-sky-50/70 p-5 text-sm text-muted-foreground ${panelScrollClass}`}
            >
              先点一次“简历润色”，这里会只显示润色后的版本。导出和保存逻辑保持不变。
            </div>
          </div>
        );
      }

      return (
        <div
          className={`flex min-h-0 flex-1 overflow-hidden ${resultViewportClass}`}
        >
          <div className="flex h-full w-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">润色结果</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void runTailor()}
                  disabled={busyKey !== null}
                >
                  {busyKey === "tailor" ? "润色中..." : "重新生成"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() =>
                    downloadMarkdown(
                      `${selectedJob?.title ?? "tailored-resume"}.md`,
                      tailorResult.fullMarkdown,
                    )
                  }
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  导出 Markdown
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void saveTailoredResume()}
                  disabled={busyKey !== null}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {busyKey === "saveTailored" ? "保存中..." : "保存为新版本"}
                </Button>
              </div>
            </div>
            <div className="mt-4 min-h-0 flex-1">
              <div
                className={`h-full rounded-[1.25rem] border border-sky-100 bg-white p-4 text-sm leading-7 text-foreground ${panelScrollClass}`}
              >
                <p className="whitespace-pre-wrap">
                  {tailorResult.fullMarkdown}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!coverLetter) {
      return (
        <div
          className={`flex min-h-0 flex-1 overflow-hidden ${resultViewportClass}`}
        >
          <div
            className={`h-full w-full rounded-[1.5rem] bg-sky-50/70 p-5 text-sm text-muted-foreground ${panelScrollClass}`}
          >
            先点一次“开场白”，这里会只显示这次生成的结果，并支持导出 Markdown。
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex min-h-0 flex-1 overflow-hidden ${resultViewportClass}`}
      >
        <div className="flex h-full w-full min-h-0 flex-col">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">开场白</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => void runCoverLetter()}
                disabled={busyKey !== null}
              >
                {busyKey === "cover" ? "生成中..." : "重新生成"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  downloadMarkdown("opening-message.md", coverLetter)
                }
              >
                <FileUp className="mr-1.5 h-4 w-4" />
                导出 Markdown
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => void copyText(coverLetter, "开场白已复制。")}
              >
                <Copy className="mr-1.5 h-4 w-4" />
                复制
              </Button>
            </div>
          </div>
          <div
            className={`mt-4 min-h-0 flex-1 rounded-[1.25rem] bg-white p-4 text-sm leading-7 text-foreground ${panelScrollClass}`}
          >
            <p className="whitespace-pre-wrap">{coverLetter}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isDemo ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          演示版：简历保存到本浏览器；评估与润色会调用你填写的 API Key。
        </div>
      ) : null}
      <div className="grid gap-6 xl:items-stretch xl:grid-cols-[0.9fr_1.05fr_0.95fr]">
        <section className={studioColumnClass}>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-[-0.03em]">
              目标岗位
            </h2>
            <p className="text-sm text-muted-foreground">
              可以从岗位看板选择，也可以直接接收岗位探索页带过来的目标岗位。
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">岗位选择</label>
            <select
              className="h-11 w-full rounded-2xl border border-sky-100 bg-sky-50/70 px-4 text-sm outline-none"
              value={selectedJobId}
              onChange={(event) => setSelectedJobId(event.target.value)}
            >
              <option value="">请选择岗位</option>
              {savedJobs.map((item) => (
                <option key={item.job.id} value={item.job.id}>
                  {item.job.title} · {item.job.company}
                </option>
              ))}
            </select>
          </div>

          <div className="min-h-0 flex-1">
            {selectedJob ? (
              <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] bg-sky-50/80 p-4">
                <div>
                  <h3 className="text-lg font-semibold">{selectedJob.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedJob.company}
                    {selectedJob.salary ? ` · ${selectedJob.salary}` : ""}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-sky-100 bg-white px-2.5 py-1">
                    {pickText(selectedJob.companyInfo, ["city", "location"]) ||
                      "未知城市"}
                  </span>
                  <span className="rounded-full border border-sky-100 bg-white px-2.5 py-1">
                    {pickText(selectedJob.companyInfo, ["experience"]) ||
                      "不限经验"}
                  </span>
                  <span className="rounded-full border border-sky-100 bg-white px-2.5 py-1">
                    {pickText(selectedJob.companyInfo, ["degree"]) ||
                      "不限学历"}
                  </span>
                </div>
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-[1.25rem] bg-white p-4 text-sm leading-7 text-foreground">
                  <p className="whitespace-pre-wrap">{selectedJob.jdText}</p>
                </div>
                {selectedJob.url ? (
                  <a
                    href={selectedJob.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-4 text-sm text-muted-foreground underline-offset-2 hover:underline"
                  >
                    打开原链接
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full min-h-[20rem] items-center rounded-[1.5rem] bg-sky-50/80 px-4 py-6 text-sm text-muted-foreground">
                先选一个岗位，右侧结果会围绕它来生成。
              </div>
            )}
          </div>
        </section>

        <section className={studioColumnClass}>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-[-0.03em]">
              简历输入
            </h2>
            <p className="text-sm text-muted-foreground">
              手填、从内容管理导入、粘贴截图、上传图片或 PDF 都可以。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium">版本标题</label>
              <Input
                value={resumeTitle}
                onChange={(event) => setResumeTitle(event.target.value)}
                placeholder="例如：产品岗主简历"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">从内容管理导入简历</label>
              <select
                className="h-10 w-full rounded-xl border border-sky-100 bg-sky-50/70 px-3 text-sm outline-none"
                value={selectedResumeId}
                onChange={(event) => setSelectedResumeId(event.target.value)}
              >
                <option value="">不使用已有版本</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <FileDropzone
            title="导入为 Markdown"
            description="支持拖拽、选择本地图片或 PDF，也支持先聚焦后直接粘贴截图。导入后只会填入编辑区，不会自动保存版本。"
            accept=".pdf,image/*"
            onFile={(file) => void importResumeFile(file)}
          />

          <div className="min-h-0 flex-1">
            <Textarea
              value={resumeMarkdown}
              onChange={(event) => {
                setResumeMarkdown(event.target.value);
                if (!selectedResume) {
                  setEditorSourceType("MANUAL");
                  setEditorSourceLabel("手动填写");
                }
              }}
              placeholder="把你的简历 Markdown 放在这里，或者用上面的导入方式识别后填入。"
              className="h-full min-h-[24rem] rounded-[1.5rem] border-sky-100 bg-sky-50/30 p-4 text-sm leading-7"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => void saveCurrentResume()}
              disabled={busyKey !== null}
            >
              <Save className="mr-1.5 h-4 w-4" />
              {busyKey === "saveCurrent" ? "保存中..." : "保存当前简历为新版本"}
            </Button>
            <span className="self-center text-xs text-muted-foreground">
              当前来源：{editorSourceLabel}
            </span>
          </div>
        </section>

        <section className={studioColumnClass}>
          <div className="inline-flex flex-wrap gap-1 rounded-full border border-sky-100 bg-sky-50/70 p-1">
            <Button
              type="button"
              variant={activeResultTab === "score" ? "secondary" : "ghost"}
              className={
                activeResultTab === "score"
                  ? "rounded-full border border-sky-200 bg-white text-sky-700 shadow-sm hover:bg-white"
                  : "rounded-full text-slate-600 hover:bg-white/70"
              }
              onClick={() => selectResultTab("score")}
              disabled={busyKey !== null}
            >
              {busyKey === "score" && activeResultTab === "score"
                ? "评估中..."
                : "AI 评估"}
            </Button>
            <Button
              type="button"
              variant={activeResultTab === "tailor" ? "secondary" : "ghost"}
              className={
                activeResultTab === "tailor"
                  ? "rounded-full border border-sky-200 bg-white text-sky-700 shadow-sm hover:bg-white"
                  : "rounded-full text-slate-600 hover:bg-white/70"
              }
              onClick={() => selectResultTab("tailor")}
              disabled={busyKey !== null}
            >
              {busyKey === "tailor" && activeResultTab === "tailor"
                ? "润色中..."
                : hasResult("tailor")
                  ? "简历润色"
                  : "生成润色"}
            </Button>
            <Button
              type="button"
              variant={activeResultTab === "cover" ? "secondary" : "ghost"}
              className={
                activeResultTab === "cover"
                  ? "rounded-full border border-sky-200 bg-white text-sky-700 shadow-sm hover:bg-white"
                  : "rounded-full text-slate-600 hover:bg-white/70"
              }
              onClick={() => selectResultTab("cover")}
              disabled={busyKey !== null}
            >
              {busyKey === "cover" && activeResultTab === "cover"
                ? "生成中..."
                : hasResult("cover")
                  ? "开场白"
                  : "生成开场白"}
            </Button>
          </div>

          {notice ? (
            <div className="rounded-[1.25rem] bg-sky-50/80 px-4 py-3 text-sm text-muted-foreground">
              {notice}
            </div>
          ) : null}
          <div className="min-h-0 flex-1">{renderResultPanel()}</div>
        </section>
      </div>
    </div>
  );
}
