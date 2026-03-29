import { getChatModel, getOpenAI } from "@/lib/ai/openai";
import { buildInterviewUser, INTERVIEW_SYSTEM } from "@/prompts/interview";

export type InterviewTurn = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export async function runInterviewReply(args: {
  req: Request;
  jobTitle: string;
  company: string;
  jdText: string;
  resumeMarkdown: string;
  transcript: InterviewTurn[];
}) {
  const openai = getOpenAI(args.req);
  const completion = await openai.chat.completions.create({
    model: getChatModel(args.req),
    messages: [
      { role: "system", content: INTERVIEW_SYSTEM },
      {
        role: "user",
        content: buildInterviewUser({
          jobTitle: args.jobTitle,
          company: args.company,
          jdText: args.jdText,
          resumeMarkdown: args.resumeMarkdown,
          transcript: args.transcript.map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }),
      },
    ],
  });

  return (completion.choices[0]?.message?.content ?? "").trim();
}
