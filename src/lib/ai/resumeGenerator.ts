import { getOpenAI, getChatModel } from "@/lib/ai/openai";
import { RESUME_SYSTEM, buildResumeUser } from "@/prompts/resume";

export type TailoredResume = {
  sections: { title: string; bullets: string[] }[];
  fullMarkdown: string;
};

function stripStarMarkers(text: string): string {
  return text
    .replace(/^\s*根据\s*STAR\s*原则[整理改写如下：:\s-]*/gim, "")
    .replace(/^\s*STAR\s*改写[如下：:\s-]*/gim, "")
    .replace(/^[\-\u2022]?\s*(S|Situation)\s*[：:]\s*/i, "")
    .replace(/\s*[；;]?\s*(T|Task)\s*[：:]\s*/gi, "；")
    .replace(/\s*[；;]?\s*(A|Action)\s*[：:]\s*/gi, "；")
    .replace(/\s*[；;]?\s*(R|Result)\s*[：:]\s*/gi, "；")
    .replace(/；{2,}/g, "；")
    .replace(/\s+；/g, "；")
    .replace(/；\s+/g, "；")
    .trim();
}

function normalizeTailoredResume(result: TailoredResume): TailoredResume {
  return {
    sections: Array.isArray(result.sections)
      ? result.sections.map((section) => ({
          title: section.title,
          bullets: Array.isArray(section.bullets)
            ? section.bullets.map((bullet) => stripStarMarkers(bullet)).filter(Boolean)
            : [],
        }))
      : [],
    fullMarkdown: String(result.fullMarkdown || "")
      .split("\n")
      .map((line) => stripStarMarkers(line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

export async function runResumeTailor(
  jdText: string,
  rawResumeMarkdown: string,
  req?: Request,
): Promise<TailoredResume> {
  const openai = getOpenAI(req);
  const model = getChatModel(req);
  const messages = [
    { role: "system" as const, content: RESUME_SYSTEM },
    {
      role: "user" as const,
      content: buildResumeUser(jdText, rawResumeMarkdown),
    },
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
  try {
    return normalizeTailoredResume(JSON.parse(text) as TailoredResume);
  } catch {
    return {
      sections: [
        {
          title: "改写失败",
          bullets: ["模型返回格式异常，请重试。"],
        },
      ],
      fullMarkdown: rawResumeMarkdown,
    };
  }
}
