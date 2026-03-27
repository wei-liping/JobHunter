/** 本机默认简历 Markdown（与 AI 配置同为 localStorage，不上传） */
export const DEFAULT_RESUME_MARKDOWN_KEY = "jobhunter.defaultResumeMarkdown.v1";

export function loadDefaultResumeMarkdown(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(DEFAULT_RESUME_MARKDOWN_KEY);
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

export function saveDefaultResumeMarkdown(markdown: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!markdown.trim()) {
      window.localStorage.removeItem(DEFAULT_RESUME_MARKDOWN_KEY);
      return;
    }
    window.localStorage.setItem(DEFAULT_RESUME_MARKDOWN_KEY, markdown);
  } catch {
    // Quota or private mode — ignore
  }
}
