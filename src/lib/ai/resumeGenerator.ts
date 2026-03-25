import { getOpenAI, getChatModel } from "@/lib/ai/openai";
import { RESUME_SYSTEM, buildResumeUser } from "@/prompts/resume";

export type TailoredResume = {
  sections: { title: string; bullets: string[] }[];
  fullMarkdown: string;
};

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
    return JSON.parse(text) as TailoredResume;
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
