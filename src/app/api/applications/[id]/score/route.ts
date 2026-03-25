import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runJobScoring } from "@/lib/ai/scoring";
import { getChatModel } from "@/lib/ai/openai";
import { applicationStatusFromScore } from "@/lib/workflow";
import {
  safeSyncApplication,
  sendWorkflowNotification,
} from "@/lib/feishu/sync";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const application = await prisma.application.findUnique({
      where: { id },
      include: { job: true, resume: true },
    });
    if (!application) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const result = await runJobScoring(
      application.job.jdText,
      application.resume.rawMarkdown,
      req,
    );

    const score = await prisma.score.create({
      data: {
        applicationId: id,
        matchScore: result.matchScore,
        analysisJson: JSON.parse(JSON.stringify(result)) as object,
        model: getChatModel(req),
      },
    });

    const nextStatus = applicationStatusFromScore(result.matchScore);

    await prisma.application.update({
      where: { id },
      data: { status: nextStatus },
    });

    void safeSyncApplication(id);
    void sendWorkflowNotification(
      `评分完成：${application.job.title} @ ${application.job.company}\n分数：${result.matchScore}\n状态：${nextStatus}`,
    ).catch((e) => console.error("[feishu] notify failed:", e));

    return NextResponse.json({ score, status: nextStatus });
  } catch (e) {
    console.error("[api/applications/score]", e);
    const message = e instanceof Error ? e.message : "评分失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
