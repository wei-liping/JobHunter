import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus } from "@/generated/prisma/enums";

const createBody = z.object({
  jobId: z.string().min(1),
  resumeId: z.string().min(1),
  status: z
    .enum(["NEW", "SCORED_HIGH", "SCORED_LOW", "REVIEWED", "READY_TO_APPLY"])
    .optional(),
});

export async function GET() {
  const applications = await prisma.application.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      job: true,
      resume: true,
      scores: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return NextResponse.json(applications);
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const data = createBody.parse(json);
    const application = await prisma.application.create({
      data: {
        jobId: data.jobId,
        resumeId: data.resumeId,
        status: (data.status ?? ApplicationStatus.NEW) as ApplicationStatus,
      },
      include: { job: true, resume: true },
    });
    return NextResponse.json(application);
  } catch (e: unknown) {
    throw e;
  }
}
