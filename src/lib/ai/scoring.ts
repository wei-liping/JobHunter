import { getOpenAI, getChatModel } from "@/lib/ai/openai";
import { SCORING_SYSTEM, buildScoringUser } from "@/prompts/scoring";

export type ScoringResult = {
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

export async function runJobScoring(
  jdText: string,
  resumeText: string,
  req?: Request,
): Promise<ScoringResult> {
  const openai = getOpenAI(req);
  const model = getChatModel(req);
  const messages = [
    { role: "system" as const, content: SCORING_SYSTEM },
    { role: "user" as const, content: buildScoringUser(jdText, resumeText) },
  ];
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (
      !message.includes("json_object") ||
      !message.includes("not supported")
    ) {
      throw e;
    }
    completion = await openai.chat.completions.create({
      model,
      messages,
    });
  }
  const text = completion.choices[0]?.message?.content ?? "{}";
  let parsed: ScoringResult;
  try {
    parsed = JSON.parse(text) as ScoringResult;
  } catch {
    parsed = {
      matchScore: 0,
      jdKeywords: [],
      hitKeywords: [],
      missingKeywords: [],
      weakPoints: ["模型返回结果不可解析，请重试"],
      gapProjects: [],
      summary: "评分解析失败，请重试。",
    };
  }
  if (typeof parsed.matchScore !== "number") {
    parsed.matchScore = 0;
  }
  if (!Array.isArray(parsed.gapProjects)) {
    parsed.gapProjects = [];
  }
  parsed.matchScore = Math.min(100, Math.max(0, Math.round(parsed.matchScore)));
  return parsed;
}
