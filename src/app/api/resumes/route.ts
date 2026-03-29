import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ResumeSourceType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createBody = z.object({
  title: z.string().optional(),
  rawMarkdown: z.string().min(1),
  sourceType: z.enum(["MANUAL", "IMPORTED", "OCR", "TAILORED"]).optional(),
  sourceLabel: z.string().optional(),
  sourceJobId: z.string().optional().nullable(),
  parentResumeId: z.string().optional().nullable(),
});

export async function GET() {
  const resumes = await prisma.resume.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      sourceJob: true,
      parentResume: true,
      childResumes: true,
    },
  });
  return NextResponse.json(resumes, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const data = createBody.parse(json);
    const resume = await prisma.resume.create({
      data: {
        title: data.title ?? "我的简历",
        rawMarkdown: data.rawMarkdown,
        sourceType: (data.sourceType ?? "MANUAL") as ResumeSourceType,
        sourceLabel: data.sourceLabel,
        sourceJobId: data.sourceJobId ?? null,
        parentResumeId: data.parentResumeId ?? null,
      },
    });
    return NextResponse.json(resume);
  } catch (e: unknown) {
    throw e;
  }
}
