import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchBody = z.object({
  title: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  transcript: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
        createdAt: z.string().optional(),
      }),
    )
    .optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  return NextResponse.json(session);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await req.json();
  const data = patchBody.parse(json);
  const session = await prisma.interviewSession.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.summary !== undefined && { summary: data.summary }),
      ...(data.transcript !== undefined && {
        transcript: data.transcript as Prisma.InputJsonValue,
      }),
    },
    include: {
      job: true,
      resume: true,
    },
  });
  return NextResponse.json(session);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.interviewSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
