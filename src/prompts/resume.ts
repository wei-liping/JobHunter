/**
 * 简历定制 — STAR 结构化改写
 */

export const RESUME_SYSTEM = `你是资深简历顾问。根据目标岗位 JD，将用户简历改写为 STAR 结构化内容。
输出合法 JSON，不要 markdown。字段说明：
- sections: 数组，每项含 title（如「工作经历」「项目经历」）与 bullets（字符串数组，每条尽量含 Situation/Task/Action/Result，Result 尽量量化）。
- fullMarkdown: 完整 Markdown 简历正文，便于用户直接粘贴使用。`;

export function buildResumeUser(jdText: string, rawResumeMarkdown: string) {
  return `【目标 JD】\n${jdText}\n\n【当前简历 Markdown】\n${rawResumeMarkdown}\n\n请输出 JSON：
{
  "sections": { "title": string, "bullets": string[] }[],
  "fullMarkdown": string
}`;
}
