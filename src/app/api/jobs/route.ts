import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { JobPlatform } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";

const platformEnum = z.enum(["BOSS", "LIEPIN", "JOB51", "ZHILIAN", "MANUAL"]);

const createBody = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  salary: z.string().optional(),
  jdText: z.string().min(1),
  requirements: z.array(z.string()).optional(),
  url: z.string().optional(),
  platform: platformEnum.optional(),
  companyInfo: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { applications: true } },
    },
  });
  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const data = createBody.parse(json);
    const job = await prisma.job.create({
      data: {
        title: data.title,
        company: data.company,
        salary: data.salary,
        jdText: data.jdText,
        requirements: data.requirements ?? [],
        url: data.url,
        platform: (data.platform ?? "MANUAL") as JobPlatform,
        companyInfo: data.companyInfo as Prisma.InputJsonValue | undefined,
      },
    });
    return NextResponse.json(job);
  } catch (e: unknown) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_request", issues: e.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: "server_error",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
