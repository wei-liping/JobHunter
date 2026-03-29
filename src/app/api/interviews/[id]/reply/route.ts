import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { runInterviewReply, type InterviewTurn } from "@/lib/ai/interview";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await prisma.interviewSession.findUnique({
      where: { id },
      include: {
        job: true,
        resume: true,
      },
    });
    if (!session) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      message?: string;
    };
    const userMessage = typeof body.message === "string" ? body.message.trim() : "";
    if (!userMessage) {
      return NextResponse.json(
        { error: "missing_message", message: "请输入回答内容。" },
        { status: 400 },
      );
    }

    const previousTranscript = Array.isArray(session.transcript)
      ? (session.transcript as unknown as InterviewTurn[])
      : [];
    const now = new Date().toISOString();
    const transcript = [
      ...previousTranscript,
      { role: "user" as const, content: userMessage, createdAt: now },
    ];

    const reply = await runInterviewReply({
      req,
      jobTitle: session.job.title,
      company: session.job.company,
      jdText: session.job.jdText,
      resumeMarkdown: session.resume.rawMarkdown,
      transcript,
    });

    const nextTranscript = [
      ...transcript,
      {
        role: "assistant" as const,
        content: reply,
        createdAt: new Date().toISOString(),
      },
    ];

    const updated = await prisma.interviewSession.update({
      where: { id },
      data: {
        transcript: nextTranscript as Prisma.InputJsonValue,
        summary:
          nextTranscript.length <= 2
            ? `围绕 ${session.job.title} 的模拟面试`
            : `已完成 ${Math.floor(nextTranscript.length / 2)} 轮问答`,
      },
      include: {
        job: true,
        resume: true,
      },
    });

    return NextResponse.json({
      reply,
      session: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模拟面试失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
