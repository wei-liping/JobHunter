import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const patchBody = z.object({
  title: z.string().optional(),
  rawMarkdown: z.string().min(1).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resume = await prisma.resume.findUnique({ where: { id } });
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
    data,
  });
  return NextResponse.json(resume);
}
