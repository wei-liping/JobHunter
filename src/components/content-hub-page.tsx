"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAiHeaders } from "@/lib/client/fetch-with-ai";

type ContentTab = "jobs" | "resumes" | "applications" | "interviews" | "reviews";

type SavedJobRow = {
  id: string;
  note?: string | null;
  job: {
    id: string;
    title: string;
    company: string;
    salary: string | null;
    jdText: string;
    url: string | null;
    companyInfo?: unknown;
    applications?: Array<{ id: string }>;
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

type ApplicationRow = {
  id: string;
  status: string;
  reviewNotes?: string | null;
  reviewSummary?: string | null;
  updatedAt: string;
  job: {
    id: string;
    title: string;
    company: string;
    salary: string | null;
    url: string | null;
    jdText?: string;
  };
  resume: {
    id: string;
    title: string;
    rawMarkdown?: string;
  };
  scores: Array<{ matchScore: number }>;
};

type InterviewSession = {
  id: string;
  title?: string | null;
  summary?: string | null;
  updatedAt: string;
  transcript: Array<{ role: "user" | "assistant"; content: string; createdAt?: string }>;
  job: { id: string; title: string; company: string };
  resume: { id: string; title: string };
};

const TABS: Array<{ id: ContentTab; label: string }> = [
  { id: "jobs", label: "岗位库" },
  { id: "resumes", label: "简历库" },
  { id: "applications", label: "投递进展" },
  { id: "interviews", label: "面试记录" },
  { id: "reviews", label: "复盘记录" },
];

const statusOptions = [
  { value: "NEW", label: "新建" },
  { value: "SCORED_HIGH", label: "高匹配" },
  { value: "SCORED_LOW", label: "待提升" },
  { value: "REVIEWED", label: "已审阅" },
  { value: "READY_TO_APPLY", label: "准备投递" },
] as const;

function sourceLabel(resume: ResumeRow) {
  if (resume.sourceLabel?.trim()) return resume.sourceLabel.trim();
  if (resume.sourceType === "TAILORED") return "岗位润色";
  if (resume.sourceType === "OCR") return "截图识别";
  if (resume.sourceType === "IMPORTED") return "导入文件";
  return "手动填写";
}

export function ContentHubPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ContentTab>("jobs");
  const [savedJobs, setSavedJobs] = useState<SavedJobRow[]>([]);
  const [resumes, setResumes] = useState<ResumeRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [interviews, setInterviews] = useState<InterviewSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createJobId, setCreateJobId] = useState("");
  const [createResumeId, setCreateResumeId] = useState("");
  const [reviewSummaryDraft, setReviewSummaryDraft] = useState("");
  const [reviewNotesDraft, setReviewNotesDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("NEW");
  const [jobTitleDraft, setJobTitleDraft] = useState("");
  const [resumeTitleDraft, setResumeTitleDraft] = useState("");
  const [newResumeTitle, setNewResumeTitle] = useState("新简历");
  const [newResumeMarkdown, setNewResumeMarkdown] = useState("");

  const reviewApplications = useMemo(
    () =>
      applications.filter(
        (item) => item.reviewNotes?.trim() || item.reviewSummary?.trim(),
      ),
    [applications],
  );

  async function refresh() {
    const [savedRes, resumeRes, appRes, interviewRes] = await Promise.all([
      fetchWithAiHeaders("/api/saved-jobs"),
      fetchWithAiHeaders("/api/resumes"),
      fetchWithAiHeaders("/api/applications"),
      fetchWithAiHeaders("/api/interviews"),
    ]);
    if (savedRes.ok) setSavedJobs((await savedRes.json()) as SavedJobRow[]);
    if (resumeRes.ok) setResumes((await resumeRes.json()) as ResumeRow[]);
    if (appRes.ok) setApplications((await appRes.json()) as ApplicationRow[]);
    if (interviewRes.ok) setInterviews((await interviewRes.json()) as InterviewSession[]);
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const nextTab = searchParams?.get("tab");
    if (
      nextTab === "jobs" ||
      nextTab === "resumes" ||
      nextTab === "applications" ||
      nextTab === "interviews" ||
      nextTab === "reviews"
    ) {
      setTab(nextTab);
    }
  }, [searchParams]);

  useEffect(() => {
    setSelectedId(null);
  }, [tab]);

  const selectedSavedJob =
    tab === "jobs" ? savedJobs.find((item) => item.id === selectedId) ?? null : null;
  const selectedResume =
    tab === "resumes" ? resumes.find((item) => item.id === selectedId) ?? null : null;
  const selectedApplication =
    tab === "applications" || tab === "reviews"
      ? applications.find((item) => item.id === selectedId) ?? null
      : null;
  const selectedInterview =
    tab === "interviews" ? interviews.find((item) => item.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!selectedApplication) return;
    setReviewSummaryDraft(selectedApplication.reviewSummary ?? "");
    setReviewNotesDraft(selectedApplication.reviewNotes ?? "");
    setStatusDraft(selectedApplication.status);
  }, [selectedApplication]);

  useEffect(() => {
    setJobTitleDraft(selectedSavedJob?.job.title ?? "");
  }, [selectedSavedJob]);

  useEffect(() => {
    setResumeTitleDraft(selectedResume?.title ?? "");
  }, [selectedResume]);

  async function createApplication() {
    if (!createJobId || !createResumeId) {
      setNotice("先选岗位和简历，再创建投递进展。");
      return;
    }
    const res = await fetchWithAiHeaders("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: createJobId, resumeId: createResumeId }),
    });
    if (!res.ok) {
      setNotice("创建投递记录失败。");
      return;
    }
    await refresh();
    setNotice("投递进展已创建。");
    setTab("applications");
  }

  async function createResume() {
    const title = newResumeTitle.trim() || "新简历";
    const rawMarkdown = newResumeMarkdown.trim();
    if (!rawMarkdown) {
      setNotice("先填写简历内容，再保存到简历库。");
      return;
    }
    const res = await fetchWithAiHeaders("/api/resumes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        rawMarkdown,
        sourceType: "MANUAL",
        sourceLabel: "内容管理手动新建",
      }),
    });
    if (!res.ok) {
      setNotice("新建简历失败。");
      return;
    }
    const created = (await res.json()) as ResumeRow;
    await refresh();
    setSelectedId(created.id);
    setNewResumeTitle("新简历");
    setNewResumeMarkdown("");
    setNotice("新简历已保存到简历库。");
  }

  async function saveReview() {
    if (!selectedApplication) return;
    const res = await fetchWithAiHeaders(`/api/applications/${selectedApplication.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: statusDraft,
        reviewSummary: reviewSummaryDraft,
        reviewNotes: reviewNotesDraft,
      }),
    });
    if (!res.ok) {
      setNotice("保存复盘失败。");
      return;
    }
    await refresh();
    setNotice("投递进展和复盘已经保存。");
  }

  async function removeSavedJob(id: string) {
    const res = await fetchWithAiHeaders(`/api/saved-jobs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setNotice("移出岗位库失败。");
      return;
    }
    await refresh();
    setSelectedId(null);
    setNotice("岗位已从内容管理移除。");
  }

  async function renameSavedJob() {
    if (!selectedSavedJob) return;
    const nextTitle = jobTitleDraft.trim();
    if (!nextTitle) {
      setNotice("岗位名称不能为空。");
      return;
    }
    const res = await fetchWithAiHeaders(`/api/jobs/${selectedSavedJob.job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: nextTitle }),
    });
    if (!res.ok) {
      setNotice("岗位重命名失败。");
      return;
    }
    await refresh();
    setNotice("岗位名称已更新。");
  }

  async function deleteSavedJobCompletely() {
    if (!selectedSavedJob) return;
    const res = await fetchWithAiHeaders(`/api/jobs/${selectedSavedJob.job.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setNotice("删除岗位失败。");
      return;
    }
    await refresh();
    setSelectedId(null);
    setNotice("岗位及其关联记录已删除。");
  }

  async function renameResume() {
    if (!selectedResume) return;
    const nextTitle = resumeTitleDraft.trim();
    if (!nextTitle) {
      setNotice("简历名称不能为空。");
      return;
    }
    const res = await fetchWithAiHeaders(`/api/resumes/${selectedResume.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: nextTitle }),
    });
    if (!res.ok) {
      setNotice("简历重命名失败。");
      return;
    }
    await refresh();
    setNotice("简历名称已更新。");
  }

  async function deleteResume(id: string) {
    const res = await fetchWithAiHeaders(`/api/resumes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setNotice("删除简历失败。");
      return;
    }
    await refresh();
    setSelectedId(null);
    setNotice("简历及其关联记录已删除。");
  }

  async function deleteInterview(id: string) {
    const res = await fetchWithAiHeaders(`/api/interviews/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setNotice("删除面试记录失败。");
      return;
    }
    await refresh();
    setSelectedId(null);
    setNotice("面试记录已删除。");
  }

  const listItems =
    tab === "jobs"
      ? savedJobs.map((item) => ({
          id: item.id,
          title: item.job.title,
          subtitle: `${item.job.company}${item.job.salary ? ` · ${item.job.salary}` : ""}`,
        }))
      : tab === "resumes"
        ? resumes.map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: sourceLabel(item),
          }))
        : tab === "applications"
          ? applications.map((item) => ({
              id: item.id,
              title: `${item.job.title} · ${item.job.company}`,
              subtitle: `${item.resume.title} · ${statusOptions.find((s) => s.value === item.status)?.label ?? item.status}`,
            }))
          : tab === "interviews"
            ? interviews.map((item) => ({
                id: item.id,
                title: item.title || `${item.job.title} 模拟面试`,
                subtitle: item.summary || "暂无总结",
              }))
            : reviewApplications.map((item) => ({
                id: item.id,
                title: `${item.job.title} · ${item.job.company}`,
                subtitle: item.reviewSummary || "有复盘内容待查看",
              }));

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              tab === item.id
                ? "bg-sky-600 text-white shadow-[0_10px_24px_rgba(59,130,246,0.18)]"
                : "border border-sky-100 bg-white text-muted-foreground hover:text-sky-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </section>

      {notice ? (
        <div className="rounded-[1.5rem] bg-sky-50/80 px-4 py-3 text-sm text-muted-foreground">
          {notice}
        </div>
      ) : null}

      {tab === "applications" ? (
        <section className="rounded-[2rem] border border-sky-100 bg-white/92 p-5 shadow-[0_12px_40px_rgba(59,130,246,0.08)]">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <select
              className="h-11 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 text-sm outline-none"
              value={createJobId}
              onChange={(event) => setCreateJobId(event.target.value)}
            >
              <option value="">选择岗位</option>
              {savedJobs.map((item) => (
                <option key={item.job.id} value={item.job.id}>
                  {item.job.title} · {item.job.company}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 text-sm outline-none"
              value={createResumeId}
              onChange={(event) => setCreateResumeId(event.target.value)}
            >
              <option value="">选择简历</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.title}
                </option>
              ))}
            </select>
            <Button
              type="button"
              className="rounded-full bg-sky-600 text-white hover:bg-sky-700"
              onClick={() => void createApplication()}
            >
              新建投递记录
            </Button>
          </div>
        </section>
      ) : null}

      {tab === "resumes" ? (
        <section className="rounded-[2rem] border border-sky-100 bg-white/92 p-5 shadow-[0_12px_40px_rgba(59,130,246,0.08)]">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                手动新增简历
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                直接在这里写标题和内容，保存后就会进入简历库。
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">简历名称</label>
              <input
                value={newResumeTitle}
                onChange={(event) => setNewResumeTitle(event.target.value)}
                className="h-11 w-full rounded-2xl border border-sky-100 bg-sky-50/70 px-4 text-sm outline-none"
                placeholder="例如：产品岗主简历"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">简历内容</label>
              <Textarea
                value={newResumeMarkdown}
                onChange={(event) => setNewResumeMarkdown(event.target.value)}
                className="min-h-[10rem] rounded-[1.5rem] border-sky-100 bg-sky-50/30 p-4 text-sm leading-7"
                placeholder="# 个人简介&#10;- 在这里手动填写你的简历内容"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                className="rounded-full bg-sky-600 text-white hover:bg-sky-700"
                onClick={() => void createResume()}
              >
                保存到简历库
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-3 rounded-[2rem] border border-sky-100 bg-white/92 p-5 shadow-[0_12px_40px_rgba(59,130,246,0.08)]">
          {listItems.length === 0 ? (
            <p className="rounded-[1.5rem] bg-sky-50/80 px-4 py-8 text-sm text-muted-foreground">
              当前还没有内容。
            </p>
          ) : (
            listItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-[1.5rem] p-4 text-left ${
                  selectedId === item.id
                    ? "border border-sky-200 bg-white shadow-sm"
                    : "bg-sky-50/80"
                }`}
              >
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
              </button>
            ))
          )}
        </div>

        <div className="rounded-[2rem] border border-sky-100 bg-white/92 p-5 shadow-[0_12px_40px_rgba(59,130,246,0.08)]">
          {selectedSavedJob ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.03em]">{selectedSavedJob.job.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedSavedJob.job.company}
                    {selectedSavedJob.job.salary ? ` · ${selectedSavedJob.job.salary}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href={`/resume?jobId=${encodeURIComponent(selectedSavedJob.job.id)}`}>
                      进入简历优化
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href={`/interview?jobId=${encodeURIComponent(selectedSavedJob.job.id)}`}>
                      去模拟面试
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void removeSavedJob(selectedSavedJob.id)}
                  >
                    移出岗位库
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void deleteSavedJobCompletely()}
                  >
                    删除岗位
                  </Button>
                </div>
              </div>
              <div className="space-y-3 rounded-[1.5rem] bg-sky-50/80 p-4">
                <label className="text-sm font-medium">岗位名称</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={jobTitleDraft}
                    onChange={(event) => setJobTitleDraft(event.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-2xl border border-sky-100 bg-white px-4 text-sm outline-none"
                    placeholder="修改岗位名称"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void renameSavedJob()}
                  >
                    重命名
                  </Button>
                </div>
              </div>
              <div className="rounded-[1.5rem] bg-sky-50/80 p-4 text-sm leading-7 text-foreground">
                <p className="whitespace-pre-wrap">{selectedSavedJob.job.jdText}</p>
              </div>
              {selectedSavedJob.job.url ? (
                <a
                  href={selectedSavedJob.job.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                >
                  打开原链接
                </a>
              ) : null}
            </div>
          ) : null}

          {selectedResume ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.03em]">{selectedResume.title}</h2>
                  <p className="text-sm text-muted-foreground">{sourceLabel(selectedResume)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href={`/resume?resumeId=${encodeURIComponent(selectedResume.id)}`}>
                      在简历优化中打开
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void deleteResume(selectedResume.id)}
                  >
                    删除简历
                  </Button>
                </div>
              </div>
              <div className="space-y-3 rounded-[1.5rem] bg-sky-50/80 p-4">
                <label className="text-sm font-medium">简历名称</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={resumeTitleDraft}
                    onChange={(event) => setResumeTitleDraft(event.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-2xl border border-sky-100 bg-white px-4 text-sm outline-none"
                    placeholder="修改简历名称"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void renameResume()}
                  >
                    重命名
                  </Button>
                </div>
              </div>
              <div className="rounded-[1.5rem] bg-sky-50/80 p-4 text-sm leading-7 text-foreground">
                <p className="whitespace-pre-wrap">{selectedResume.rawMarkdown}</p>
              </div>
            </div>
          ) : null}

          {selectedApplication ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                  {selectedApplication.job.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedApplication.job.company} · {selectedApplication.resume.title}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] bg-sky-50/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    当前状态
                  </p>
                  <select
                    className="mt-3 h-11 w-full rounded-2xl border border-sky-100 bg-white px-4 text-sm outline-none"
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-4 text-sm text-muted-foreground">
                    最新分数：{selectedApplication.scores[0]?.matchScore ?? "暂无"}
                  </p>
                </div>
                <div className="rounded-[1.5rem] bg-sky-50/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    跳转
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="rounded-full">
                      <Link href={`/resume?jobId=${encodeURIComponent(selectedApplication.job.id)}&resumeId=${encodeURIComponent(selectedApplication.resume.id)}`}>
                        打开简历优化
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full">
                      <Link href={`/interview?jobId=${encodeURIComponent(selectedApplication.job.id)}&resumeId=${encodeURIComponent(selectedApplication.resume.id)}`}>
                        打开模拟面试
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">复盘标题</label>
                <Textarea
                  value={reviewSummaryDraft}
                  onChange={(event) => setReviewSummaryDraft(event.target.value)}
                  className="min-h-[5rem] rounded-[1.5rem] border-sky-100 bg-sky-50/30 p-4 text-sm"
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">复盘内容</label>
                <Textarea
                  value={reviewNotesDraft}
                  onChange={(event) => setReviewNotesDraft(event.target.value)}
                  className="min-h-[12rem] rounded-[1.5rem] border-sky-100 bg-sky-50/30 p-4 text-sm leading-7"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="rounded-full bg-sky-600 text-white hover:bg-sky-700"
                  onClick={() => void saveReview()}
                >
                  保存进展与复盘
                </Button>
              </div>
            </div>
          ) : null}

          {selectedInterview ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                    {selectedInterview.title || `${selectedInterview.job.title} 模拟面试`}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedInterview.summary || "暂无总结"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href={`/interview?sessionId=${encodeURIComponent(selectedInterview.id)}`}>
                      继续对话
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void deleteInterview(selectedInterview.id)}
                  >
                    删除记录
                  </Button>
                </div>
              </div>
              <div className="space-y-3 rounded-[1.5rem] bg-sky-50/80 p-4">
                {selectedInterview.transcript.map((item, index) => (
                  <div
                    key={`${item.role}-${index}-${item.createdAt ?? ""}`}
                    className={`max-w-[85%] rounded-[1.25rem] px-4 py-3 text-sm leading-7 ${
                      item.role === "assistant"
                        ? "bg-white text-foreground shadow-sm"
                        : "ml-auto bg-sky-600 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{item.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!selectedSavedJob && !selectedResume && !selectedApplication && !selectedInterview ? (
            <div className="rounded-[1.5rem] bg-sky-50/80 px-4 py-8 text-sm text-muted-foreground">
              从左边选一条内容后，这里会显示详细信息。
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
