import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoModeServer } from "@/lib/demo/mode";
import { runInterviewReply, type InterviewTurn } from "@/lib/ai/interview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const startSchema = z.object({
  phase: z.literal("start"),
  jobId: z.string().min(1),
  resumeId: z.string().min(1),
  jobTitle: z.string().min(1),
  company: z.string().min(1),
  jdText: z.string().min(1),
  resumeMarkdown: z.string().min(1),
  resumeTitle: z.string().optional(),
  title: z.string().optional(),
});

const replySchema = z.object({
  phase: z.literal("reply"),
  sessionId: z.string().min(1),
  jobId: z.string().min(1),
  resumeId: z.string().min(1),
  jobTitle: z.string().min(1),
  company: z.string().min(1),
  jdText: z.string().min(1),
  resumeMarkdown: z.string().min(1),
  resumeTitle: z.string().optional(),
  transcript: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      createdAt: z.string().optional(),
    }),
  ),
  message: z.string().min(1),
});

function buildSession(args: {
  id: string;
  title: string;
  summary: string;
  transcript: InterviewTurn[];
  jobId: string;
  jobTitle: string;
  company: string;
  jdText: string;
  resumeId: string;
  resumeTitle: string;
  resumeMarkdown: string;
}) {
  const now = new Date().toISOString();
  return {
    id: args.id,
    title: args.title,
    summary: args.summary,
    transcript: args.transcript,
    job: {
      id: args.jobId,
      title: args.jobTitle,
      company: args.company,
      jdText: args.jdText,
    },
    resume: {
      id: args.resumeId,
      title: args.resumeTitle,
      rawMarkdown: args.resumeMarkdown,
    },
    updatedAt: now,
  };
}

export async function POST(req: Request) {
  if (!isDemoModeServer()) {
    return NextResponse.json(
      { error: "not_available", message: "该接口仅在在线演示模式下可用。" },
      { status: 404 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const start = startSchema.safeParse(json);
  if (start.success) {
    const d = start.data;
    const now = new Date().toISOString();
    const userMessage = "请根据当前岗位和简历，开始第一轮模拟面试。";
    const transcript: InterviewTurn[] = [
      { role: "user", content: userMessage, createdAt: now },
    ];
    try {
      const reply = await runInterviewReply({
        req,
        jobTitle: d.jobTitle,
        company: d.company,
        jdText: d.jdText,
        resumeMarkdown: d.resumeMarkdown,
        transcript,
      });
      const nextTranscript: InterviewTurn[] = [
        ...transcript,
        {
          role: "assistant" as const,
          content: reply,
          createdAt: new Date().toISOString(),
        },
      ];
      const id = `demo_${crypto.randomUUID()}`;
      const session = buildSession({
        id,
        title: d.title ?? `${d.jobTitle} 模拟面试`,
        summary: "已创建模拟面试",
        transcript: nextTranscript,
        jobId: d.jobId,
        jobTitle: d.jobTitle,
        company: d.company,
        jdText: d.jdText,
        resumeId: d.resumeId,
        resumeTitle: d.resumeTitle ?? "简历",
        resumeMarkdown: d.resumeMarkdown,
      });
      return NextResponse.json({ reply, session });
    } catch (error) {
      const message = error instanceof Error ? error.message : "模拟面试失败";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const rep = replySchema.safeParse(json);
  if (!rep.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: rep.error.issues },
      { status: 400 },
    );
  }

  const d = rep.data;
  const now = new Date().toISOString();
  const previousTranscript = d.transcript as InterviewTurn[];
  const transcript: InterviewTurn[] = [
    ...previousTranscript,
    { role: "user", content: d.message, createdAt: now },
  ];

  try {
    const reply = await runInterviewReply({
      req,
      jobTitle: d.jobTitle,
      company: d.company,
      jdText: d.jdText,
      resumeMarkdown: d.resumeMarkdown,
      transcript,
    });
    const nextTranscript: InterviewTurn[] = [
      ...transcript,
      {
        role: "assistant" as const,
        content: reply,
        createdAt: new Date().toISOString(),
      },
    ];
    const session = buildSession({
      id: d.sessionId,
      title: `${d.jobTitle} 模拟面试`,
      summary:
        nextTranscript.length <= 2
          ? `围绕 ${d.jobTitle} 的模拟面试`
          : `已完成 ${Math.floor(nextTranscript.length / 2)} 轮问答`,
      transcript: nextTranscript,
      jobId: d.jobId,
      jobTitle: d.jobTitle,
      company: d.company,
      jdText: d.jdText,
      resumeId: d.resumeId,
      resumeTitle: d.resumeTitle ?? "简历",
      resumeMarkdown: d.resumeMarkdown,
    });
    return NextResponse.json({ reply, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模拟面试失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
