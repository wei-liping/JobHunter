import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { isDemoModeServer } from "@/lib/demo/mode";
import { requireNotDemo } from "@/lib/demo/require-not-demo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createBody = z.object({
  jobId: z.string().min(1),
  resumeId: z.string().min(1),
  status: z
    .enum(["NEW", "SCORED_HIGH", "SCORED_LOW", "REVIEWED", "READY_TO_APPLY"])
    .optional(),
  reviewNotes: z.string().optional(),
  reviewSummary: z.string().optional(),
});

export async function GET() {
  if (isDemoModeServer()) {
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
  const applications = await prisma.application.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      job: true,
      resume: true,
      scores: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return NextResponse.json(applications, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(req: Request) {
  const blocked = requireNotDemo();
  if (blocked) return blocked;
  try {
    const json = await req.json();
    const data = createBody.parse(json);
    const existing = await prisma.application.findFirst({
      where: {
        jobId: data.jobId,
        resumeId: data.resumeId,
      },
      include: {
        job: true,
        resume: true,
        scores: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (existing) {
      return NextResponse.json(existing);
    }
    const application = await prisma.application.create({
      data: {
        jobId: data.jobId,
        resumeId: data.resumeId,
        status: (data.status ?? ApplicationStatus.NEW) as ApplicationStatus,
        reviewNotes: data.reviewNotes,
        reviewSummary: data.reviewSummary,
      },
      include: { job: true, resume: true },
    });
    return NextResponse.json(application);
  } catch (e: unknown) {
    throw e;
  }
}
