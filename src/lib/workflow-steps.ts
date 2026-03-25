/** Shared workflow labels and browser tab titles (emoji prefix). */

export const BRAND_SUFFIX = "JobHunter";

export const WORKFLOW_STEPS = [
  {
    id: "prepare" as const,
    title: "准备材料",
    shortTitle: "简历与 JD",
    emoji: "\u{1F4DD}",
  },
  {
    id: "workspace" as const,
    title: "智能工作台",
    shortTitle: "匹配与改写",
    emoji: "\u{1F4CB}",
  },
  {
    id: "finish" as const,
    title: "导出与投递",
    shortTitle: "完成",
    emoji: "\u{2705}",
  },
] as const;

export type WorkflowStepId = (typeof WORKFLOW_STEPS)[number]["id"];

export function buildHomeDocumentTitle(): string {
  return `${WORKFLOW_STEPS[0].emoji} 准备投递 | ${BRAND_SUFFIX}`;
}

export function buildWorkspaceDocumentTitle(
  jobTitle: string,
  company: string,
): string {
  const safe = `${jobTitle} · ${company}`.slice(0, 80);
  return `${WORKFLOW_STEPS[1].emoji} ${safe} | ${BRAND_SUFFIX}`;
}

export function defaultDocumentTitle(): string {
  return BRAND_SUFFIX;
}
