/**
 * 演示模式：简历与模拟面试会话仅存浏览器，不经过服务端数据库。
 */

const RESUMES_KEY = "jobhunter:v1:demo-resumes";
const INTERVIEWS_KEY = "jobhunter:v1:demo-interviews";

export type DemoResumeRow = {
  id: string;
  title: string;
  rawMarkdown: string;
  sourceType?: string;
  sourceLabel?: string | null;
  sourceJobId?: string | null;
  parentResumeId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DemoInterviewSession = {
  id: string;
  title?: string | null;
  summary?: string | null;
  updatedAt: string;
  transcript: Array<{
    role: "user" | "assistant";
    content: string;
    createdAt?: string;
  }>;
  job: {
    id: string;
    title: string;
    company: string;
    jdText: string;
  };
  resume: {
    id: string;
    title: string;
    rawMarkdown: string;
  };
};

function nowIso() {
  return new Date().toISOString();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function listDemoResumes(): DemoResumeRow[] {
  const rows = readJson<DemoResumeRow[]>(RESUMES_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function deleteDemoResume(id: string) {
  writeJson(
    RESUMES_KEY,
    listDemoResumes().filter((r) => r.id !== id),
  );
}

export function patchDemoResume(
  id: string,
  patch: Partial<Pick<DemoResumeRow, "title" | "rawMarkdown">>,
) {
  const t = nowIso();
  writeJson(
    RESUMES_KEY,
    listDemoResumes().map((r) =>
      r.id === id ? { ...r, ...patch, updatedAt: t } : r,
    ),
  );
}

export function createDemoResume(input: {
  title: string;
  rawMarkdown: string;
  sourceType?: string;
  sourceLabel?: string | null;
  sourceJobId?: string | null;
  parentResumeId?: string | null;
}): DemoResumeRow {
  const id = `demo_${crypto.randomUUID()}`;
  const t = nowIso();
  const row: DemoResumeRow = {
    id,
    title: input.title.trim() || "我的简历",
    rawMarkdown: input.rawMarkdown,
    sourceType: input.sourceType ?? "MANUAL",
    sourceLabel: input.sourceLabel ?? null,
    sourceJobId: input.sourceJobId ?? null,
    parentResumeId: input.parentResumeId ?? null,
    createdAt: t,
    updatedAt: t,
  };
  const next = [row, ...listDemoResumes()].slice(0, 80);
  writeJson(RESUMES_KEY, next);
  return row;
}

export function listDemoInterviews(): DemoInterviewSession[] {
  const rows = readJson<DemoInterviewSession[]>(INTERVIEWS_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function upsertDemoInterview(session: DemoInterviewSession) {
  const list = listDemoInterviews();
  const idx = list.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    list[idx] = session;
  } else {
    list.unshift(session);
  }
  writeJson(INTERVIEWS_KEY, list.slice(0, 40));
}

export function deleteDemoInterview(id: string) {
  writeJson(
    INTERVIEWS_KEY,
    listDemoInterviews().filter((s) => s.id !== id),
  );
}
