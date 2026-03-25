/**
 * AI 岗位匹配评分 — 提示词（与业务逻辑解耦）
 */

export const SCORING_SYSTEM = `你是资深技术猎头与简历优化专家。根据岗位 JD 与用户简历文本，输出 JSON 分析结果。
要求：
1. 给出 0-100 的整数匹配分 matchScore（越高越匹配）。
2. 提取 JD 中 5 个核心技术关键词到 jdKeywords。
3. 命中简历的关键词 hitKeywords，缺失但重要的关键词 missingKeywords。
4. 列出简历最薄弱的 3 个薄弱点 weakPoints（简短中文）。
5. 一段匹配分析 summary（中文，2-4 句）。

仅输出合法 JSON，不要 markdown 代码块。`;

export function buildScoringUser(jdText: string, resumeText: string) {
  return `【岗位 JD】\n${jdText}\n\n【用户简历】\n${resumeText}\n\n请输出 JSON，字段：
{
  "matchScore": number,
  "jdKeywords": string[],
  "hitKeywords": string[],
  "missingKeywords": string[],
  "weakPoints": string[],
  "summary": string
}`;
}
