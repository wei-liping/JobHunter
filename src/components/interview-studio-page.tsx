"use client";

import { useEffect, useMemo, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAiHeaders } from "@/lib/client/fetch-with-ai";
import { isDemoModeClient } from "@/lib/demo/mode";
import {
  listDemoResumes,
  listDemoInterviews,
  upsertDemoInterview,
} from "@/lib/client/demo-local-store";

type JobRow = {
  id: string;
  job: {
    id: string;
    title: string;
    company: string;
    jdText: string;
  };
};

type ResumeRow = {
  id: string;
  title: string;
  rawMarkdown: string;
  sourceLabel?: string | null;
};

type InterviewSession = {
  id: string;
  title?: string | null;
  summary?: string | null;
  transcript: Array<{
    role: "user" | "assistant";
    content: string;
    createdAt?: string;
  }>;
  job: { id: string; title: string; company: string; jdText: string };
  resume: { id: string; title: string; rawMarkdown: string };
  updatedAt: string;
};

export function InterviewStudioPage() {
  const searchParams = useSearchParams();
  const isDemo = isDemoModeClient();
  const [savedJobs, setSavedJobs] = useState<JobRow[]>([]);
  const [resumes, setResumes] = useState<ResumeRow[]>([]);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === sessionId) ?? null,
    [sessionId, sessions],
  );
  const selectedJob = useMemo(
    () => savedJobs.find((item) => item.job.id === selectedJobId)?.job ?? null,
    [savedJobs, selectedJobId],
  );
  const selectedResume = useMemo(
    () => resumes.find((item) => item.id === selectedResumeId) ?? null,
    [resumes, selectedResumeId],
  );

  async function refresh() {
    const jobsRes = await fetchWithAiHeaders("/api/saved-jobs");
    if (jobsRes.ok) setSavedJobs((await jobsRes.json()) as JobRow[]);
    if (isDemo) {
      setResumes(
        listDemoResumes().map((r) => ({
          id: r.id,
          title: r.title,
          rawMarkdown: r.rawMarkdown,
          sourceLabel: r.sourceLabel,
        })),
      );
      setSessions(listDemoInterviews() as InterviewSession[]);
      return;
    }
    const [resumesRes, sessionsRes] = await Promise.all([
      fetchWithAiHeaders("/api/resumes"),
      fetchWithAiHeaders("/api/interviews"),
    ]);
    if (resumesRes.ok) setResumes((await resumesRes.json()) as ResumeRow[]);
    if (sessionsRes.ok) {
      setSessions((await sessionsRes.json()) as InterviewSession[]);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 首次加载即可
  }, []);

  useEffect(() => {
    const jobId = searchParams?.get("jobId");
    const resumeId = searchParams?.get("resumeId");
    const existingSessionId = searchParams?.get("sessionId");
    if (jobId) setSelectedJobId(jobId);
    if (resumeId) setSelectedResumeId(resumeId);
    if (existingSessionId) setSessionId(existingSessionId);
  }, [searchParams]);

  async function startInterview() {
    if (!selectedJobId || !selectedResumeId) {
      setNotice("开始前需要先选一个岗位和一份简历。");
      return;
    }
    if (!selectedJob?.jdText?.trim() || !selectedResume?.rawMarkdown.trim()) {
      setNotice("请确认岗位 JD 与简历内容都已加载。");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (isDemo) {
        const createRes = await fetchWithAiHeaders(
          "/api/interviews/ephemeral",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phase: "start",
              jobId: selectedJobId,
              resumeId: selectedResumeId,
              jobTitle: selectedJob.title,
              company: selectedJob.company,
              jdText: selectedJob.jdText,
              resumeMarkdown: selectedResume.rawMarkdown,
              resumeTitle: selectedResume.title,
              title: `${selectedJob.title} 模拟面试`,
            }),
          },
        );
        const replyBody = (await createRes.json()) as {
          error?: string;
          session?: InterviewSession;
        };
        if (!createRes.ok || !replyBody.session) {
          throw new Error(replyBody.error ?? "无法开始模拟面试");
        }
        upsertDemoInterview(replyBody.session);
        await refresh();
        setSessionId(replyBody.session.id);
        setNotice("模拟面试已经开始（记录保存在本浏览器）。");
        return;
      }

      const createRes = await fetchWithAiHeaders("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${selectedJob?.title ?? "目标岗位"} 模拟面试`,
          jobId: selectedJobId,
          resumeId: selectedResumeId,
        }),
      });
      const created = (await createRes.json()) as InterviewSession;
      if (!createRes.ok) throw new Error("无法创建模拟面试");

      const replyRes = await fetchWithAiHeaders(
        `/api/interviews/${created.id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "请根据当前岗位和简历，开始第一轮模拟面试。",
          }),
        },
      );
      const replyBody = (await replyRes.json()) as {
        error?: string;
        session?: InterviewSession;
      };
      if (!replyRes.ok || !replyBody.session) {
        throw new Error(replyBody.error ?? "无法开始模拟面试");
      }
      await refresh();
      setSessionId(replyBody.session.id);
      setNotice("模拟面试已经开始。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "启动失败");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!sessionId || !draft.trim()) {
      setNotice("先开始一场模拟面试，再发送回答。");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (isDemo) {
        const sess = sessions.find((s) => s.id === sessionId) ?? currentSession;
        if (!sess) {
          throw new Error("会话已失效，请重新开始。");
        }
        const res = await fetchWithAiHeaders("/api/interviews/ephemeral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: "reply",
            sessionId,
            jobId: sess.job.id,
            resumeId: sess.resume.id,
            jobTitle: sess.job.title,
            company: sess.job.company,
            jdText: sess.job.jdText,
            resumeMarkdown: sess.resume.rawMarkdown,
            resumeTitle: sess.resume.title,
            transcript: sess.transcript,
            message: draft.trim(),
          }),
        });
        const body = (await res.json()) as {
          error?: string;
          session?: InterviewSession;
        };
        if (!res.ok || !body.session) {
          throw new Error(body.error ?? "发送失败");
        }
        upsertDemoInterview(body.session);
        setDraft("");
        await refresh();
        setSessionId(body.session.id);
        return;
      }

      const res = await fetchWithAiHeaders(
        `/api/interviews/${sessionId}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: draft.trim() }),
        },
      );
      const body = (await res.json()) as {
        error?: string;
        session?: InterviewSession;
      };
      if (!res.ok || !body.session) {
        throw new Error(body.error ?? "发送失败");
      }
      setDraft("");
      await refresh();
      setSessionId(body.session.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="space-y-4 rounded-[2rem] border border-sky-100 bg-white/92 p-5 shadow-[0_12px_40px_rgba(59,130,246,0.08)]">
        {isDemo ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
            演示版：对话仅保存在本浏览器；请先填好右上角 API Key。
          </p>
        ) : null}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-[-0.03em]">面试配置</h2>
          <p className="text-sm text-muted-foreground">
            先选岗位和简历，再开始一场真实的文字模拟面试。
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">岗位</label>
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

        <div className="space-y-2">
          <label className="text-sm font-medium">简历版本</label>
          <select
            className="h-11 w-full rounded-2xl border border-sky-100 bg-sky-50/70 px-4 text-sm outline-none"
            value={selectedResumeId}
            onChange={(event) => setSelectedResumeId(event.target.value)}
          >
            <option value="">请选择简历</option>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          className="w-full rounded-full bg-sky-600 text-white hover:bg-sky-700"
          onClick={() => void startInterview()}
          disabled={busy}
        >
          {busy ? "准备中..." : "开始模拟面试"}
        </Button>

        <div className="space-y-3 rounded-[1.5rem] bg-sky-50/80 p-4 text-sm text-muted-foreground">
          <h3 className="font-medium text-foreground">当前上下文</h3>
          <p>
            岗位：
            {selectedJob
              ? `${selectedJob.title} · ${selectedJob.company}`
              : "未选择"}
          </p>
          <p>简历：{selectedResume ? selectedResume.title : "未选择"}</p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">历史面试</h3>
          <div className="space-y-2">
            {sessions.length === 0 ? (
              <p className="rounded-[1.5rem] bg-sky-50/80 px-4 py-6 text-sm text-muted-foreground">
                还没有模拟面试记录。
              </p>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    setSessionId(session.id);
                    setSelectedJobId(session.job.id);
                    setSelectedResumeId(session.resume.id);
                  }}
                  className={`w-full rounded-[1.25rem] border p-4 text-left ${
                    sessionId === session.id
                      ? "border-sky-200 bg-white"
                      : "border-sky-100 bg-sky-50/80"
                  }`}
                >
                  <p className="font-medium text-foreground">
                    {session.title || `${session.job.title} 模拟面试`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {session.summary || "暂无总结"}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-[2rem] border border-sky-100 bg-white/92 p-5 shadow-[0_12px_40px_rgba(59,130,246,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.03em]">
              模拟对话
            </h2>
            <p className="text-sm text-muted-foreground">
              {isDemo
                ? "每次问一题，逐轮追问；演示版记录保存在本浏览器。"
                : "每次问一题，逐轮追问，记录会自动进入内容管理。"}
            </p>
          </div>
          {!isDemo ? (
            <Button asChild variant="outline" className="rounded-full">
              <a href="/content?tab=interviews">去内容管理查看记录</a>
            </Button>
          ) : null}
        </div>

        {notice ? (
          <div className="rounded-[1.25rem] bg-sky-50/80 px-4 py-3 text-sm text-muted-foreground">
            {notice}
          </div>
        ) : null}

        <div className="min-h-[30rem] space-y-3 rounded-[1.5rem] bg-sky-50/80 p-4">
          {currentSession?.transcript?.length ? (
            currentSession.transcript.map((item, index) => (
              <div
                key={`${item.role}-${index}-${item.createdAt ?? ""}`}
                className={`max-w-[85%] rounded-[1.5rem] px-4 py-3 text-sm leading-7 ${
                  item.role === "assistant"
                    ? "bg-white text-foreground shadow-sm"
                    : "ml-auto bg-sky-600 text-white"
                }`}
              >
                <p className="whitespace-pre-wrap">{item.content}</p>
              </div>
            ))
          ) : (
            <p className="px-2 py-6 text-sm text-muted-foreground">
              选择岗位和简历后点击“开始模拟面试”，系统会先抛出第一问。
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="在这里回答面试问题，或者输入“结束面试”让系统给出总结。"
            className="min-h-[8rem] rounded-[1.5rem] border-sky-100 bg-sky-50/30 p-4 text-sm leading-7"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              className="rounded-full bg-sky-600 text-white hover:bg-sky-700"
              onClick={() => void sendMessage()}
              disabled={busy || !sessionId}
            >
              <SendHorizonal className="mr-1.5 h-4 w-4" />
              {busy ? "发送中..." : "发送回答"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
