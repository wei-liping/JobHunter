import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ResumeSourceType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchBody = z.object({
  title: z.string().optional(),
  rawMarkdown: z.string().min(1).optional(),
  sourceType: z.enum(["MANUAL", "IMPORTED", "OCR", "TAILORED"]).optional(),
  sourceLabel: z.string().optional().nullable(),
  sourceJobId: z.string().optional().nullable(),
  parentResumeId: z.string().optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resume = await prisma.resume.findUnique({
    where: { id },
    include: {
      sourceJob: true,
      parentResume: true,
      childResumes: true,
      applications: {
        include: {
          job: true,
          scores: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      interviewSessions: {
        include: { job: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!resume)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(resume);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await req.json();
  const data = patchBody.parse(json);
  const resume = await prisma.resume.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.rawMarkdown !== undefined && { rawMarkdown: data.rawMarkdown }),
      ...(data.sourceType !== undefined && {
        sourceType: data.sourceType as ResumeSourceType,
      }),
      ...(data.sourceLabel !== undefined && { sourceLabel: data.sourceLabel }),
      ...(data.sourceJobId !== undefined && { sourceJobId: data.sourceJobId }),
      ...(data.parentResumeId !== undefined && {
        parentResumeId: data.parentResumeId,
      }),
    },
  });
  return NextResponse.json(resume);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.resume.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
