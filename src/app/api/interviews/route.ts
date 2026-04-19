import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isDemoModeServer } from "@/lib/demo/mode";
import { requireNotDemo } from "@/lib/demo/require-not-demo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createBody = z.object({
  title: z.string().optional(),
  jobId: z.string().min(1),
  resumeId: z.string().min(1),
});

export async function GET() {
  if (isDemoModeServer()) {
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
  const sessions = await prisma.interviewSession.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      job: true,
      resume: true,
    },
  });
  return NextResponse.json(sessions, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(req: Request) {
  const blocked = requireNotDemo();
  if (blocked) return blocked;
  const json = await req.json();
  const data = createBody.parse(json);
  const session = await prisma.interviewSession.create({
    data: {
      title: data.title,
      jobId: data.jobId,
      resumeId: data.resumeId,
      summary: "已创建模拟面试",
      transcript: [],
    },
    include: {
      job: true,
      resume: true,
    },
  });
  return NextResponse.json(session);
}
