import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus } from "@/generated/prisma/enums";
import {
  safeSyncApplication,
  sendWorkflowNotification,
} from "@/lib/feishu/sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchBody = z.object({
  status: z
    .enum(["NEW", "SCORED_HIGH", "SCORED_LOW", "REVIEWED", "READY_TO_APPLY"])
    .optional(),
  tailoredResumeJson: z.string().optional().nullable(),
  coverLetter: z.string().optional().nullable(),
  reviewNotes: z.string().optional().nullable(),
  reviewSummary: z.string().optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      job: true,
      resume: true,
      scores: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!application) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(application);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await req.json();
  const data = patchBody.parse(json);
  const application = await prisma.application.update({
    where: { id },
    data: {
      ...(data.status !== undefined && {
        status: data.status as ApplicationStatus,
      }),
      ...(data.tailoredResumeJson !== undefined && {
        tailoredResumeJson: data.tailoredResumeJson,
      }),
      ...(data.coverLetter !== undefined && { coverLetter: data.coverLetter }),
      ...(data.reviewNotes !== undefined && { reviewNotes: data.reviewNotes }),
      ...(data.reviewSummary !== undefined && {
        reviewSummary: data.reviewSummary,
      }),
    },
    include: { job: true, resume: true },
  });
  if (data.status !== undefined) {
    void safeSyncApplication(id);
    void sendWorkflowNotification(
      `状态更新：${application.job.title} @ ${application.job.company}\n状态：${application.status}`,
    ).catch((e) => console.error("[feishu] notify failed:", e));
  }
  return NextResponse.json(application);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.application.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
