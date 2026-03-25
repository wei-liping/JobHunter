import { getOpenAI, getChatModel } from "@/lib/ai/openai";
import {
  COVER_LETTER_SYSTEM,
  buildCoverLetterUser,
} from "@/prompts/coverLetter";

export async function runCoverLetter(
  jdText: string,
  resumeSummary: string,
  req?: Request,
): Promise<string> {
  const openai = getOpenAI(req);
  const completion = await openai.chat.completions.create({
    model: getChatModel(req),
    messages: [
      { role: "system", content: COVER_LETTER_SYSTEM },
      { role: "user", content: buildCoverLetterUser(jdText, resumeSummary) },
    ],
  });
  return (completion.choices[0]?.message?.content ?? "").trim();
}
