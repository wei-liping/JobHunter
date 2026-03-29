import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { JobPlatform } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  return NextResponse.json(jobs, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const data = createBody.parse(json);
    const platform = (data.platform ?? "MANUAL") as JobPlatform;
    const normalizedUrl = data.url?.trim();
    const existing = normalizedUrl
      ? await prisma.job.findFirst({
          where: { platform, url: normalizedUrl },
        })
      : await prisma.job.findFirst({
          where: {
            platform,
            title: data.title,
            company: data.company,
          },
        });

    const payload = {
      title: data.title,
      company: data.company,
      salary: data.salary,
      jdText: data.jdText,
      requirements: data.requirements ?? [],
      url: normalizedUrl,
      platform,
      companyInfo: data.companyInfo as Prisma.InputJsonValue | undefined,
    };

    const job = existing
      ? await prisma.job.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.job.create({
          data: payload,
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
