import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { JobPlatform } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

const patchBody = z.object({
  title: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  salary: z.string().optional().nullable(),
  jdText: z.string().min(1).optional(),
  requirements: z.array(z.string()).optional(),
  url: z.string().optional().nullable(),
  platform: z.enum(["BOSS", "LIEPIN", "JOB51", "ZHILIAN", "MANUAL"]).optional(),
  companyInfo: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { applications: { include: { resume: true, scores: true } } },
  });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await req.json();
  const data = patchBody.parse(json);
  const job = await prisma.job.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.company !== undefined && { company: data.company }),
      ...(data.salary !== undefined && { salary: data.salary }),
      ...(data.jdText !== undefined && { jdText: data.jdText }),
      ...(data.requirements !== undefined && {
        requirements: data.requirements,
      }),
      ...(data.url !== undefined && { url: data.url }),
      ...(data.platform !== undefined && {
        platform: data.platform as JobPlatform,
      }),
      ...(data.companyInfo !== undefined && {
        companyInfo:
          data.companyInfo === null
            ? Prisma.JsonNull
            : (data.companyInfo as Prisma.InputJsonValue),
      }),
    },
  });
  return NextResponse.json(job);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.job.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
