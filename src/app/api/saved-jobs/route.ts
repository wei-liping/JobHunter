import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createBody = z.object({
  jobId: z.string().min(1),
  note: z.string().optional(),
});

export async function GET() {
  const savedJobs = await prisma.savedJob.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      job: {
        include: {
          applications: {
            include: {
              resume: true,
              scores: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  return NextResponse.json(savedJobs, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(req: Request) {
  const json = await req.json();
  const data = createBody.parse(json);
  const savedJob = await prisma.savedJob.upsert({
    where: { jobId: data.jobId },
    update: {
      note: data.note,
    },
    create: {
      jobId: data.jobId,
      note: data.note,
    },
    include: {
      job: true,
    },
  });
  return NextResponse.json(savedJob);
}
