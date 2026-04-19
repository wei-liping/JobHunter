import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isDemoModeServer } from "@/lib/demo/mode";
import { listDemoJobsForApi } from "@/lib/demo/jobs-source";
import { requireNotDemo } from "@/lib/demo/require-not-demo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createBody = z.object({
  jobId: z.string().min(1),
  note: z.string().optional(),
});

export async function GET() {
  if (isDemoModeServer()) {
    const jobs = await listDemoJobsForApi();
    const now = new Date().toISOString();
    const savedJobs = jobs.map((job) => {
      const { _count, ...rest } = job;
      void _count;
      return {
        id: `demosj_${job.id}`,
        jobId: job.id,
        note: null as string | null,
        createdAt: now,
        updatedAt: now,
        job: {
          ...rest,
          applications: [] as Array<{ id: string }>,
        },
      };
    });
    return NextResponse.json(savedJobs, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
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
  const blocked = requireNotDemo();
  if (blocked) return blocked;
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
