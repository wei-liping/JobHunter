import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { isDemoModeServer } from "@/lib/demo/mode";
import { listDemoJobsForApi } from "@/lib/demo/jobs-source";
import { requireNotDemo } from "@/lib/demo/require-not-demo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toPrismaInputJson(
  value: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function looksLikeDatabaseUnavailable(message: string): boolean {
  return /Can't reach database server|Can't reach database|Server has closed the connection|\bP1001\b|P1017|ECONNREFUSED|ETIMEDOUT|Connection terminated|the database system is starting up/i.test(
    message,
  );
}

function buildErrorResponse(e: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    const down = e.code === "P1001" || looksLikeDatabaseUnavailable(e.message);
    return {
      status: down ? 503 : 500,
      body: {
        error: down ? "database_unavailable" : "server_error",
        prismaCode: e.code,
        message: e.message,
        ...(down && {
          hint: "数据库当前连不上本机或服务：请确认 PostgreSQL 已启动，且 .env 里的 DATABASE_URL 指向可访问的地址（本机开发可先 `prisma db push` 建好库）。",
        }),
      },
    };
  }
  if (e instanceof Prisma.PrismaClientInitializationError) {
    const down = looksLikeDatabaseUnavailable(e.message);
    return {
      status: down ? 503 : 500,
      body: {
        error: down ? "database_unavailable" : "server_error",
        message: e.message,
        ...(down && {
          hint: "数据库当前连不上：请检查 DATABASE_URL 与数据库是否已启动。",
        }),
      },
    };
  }
  if (e instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 400,
      body: {
        error: "invalid_prisma_request",
        message: e.message,
      },
    };
  }
  const message = e instanceof Error ? e.message : String(e);
  const down = looksLikeDatabaseUnavailable(message);
  return {
    status: down ? 503 : 500,
    body: {
      error: down ? "database_unavailable" : "server_error",
      message,
      ...(down && {
        hint: "数据库当前连不上：请检查 DATABASE_URL 与数据库是否已启动。",
      }),
    },
  };
}

const platformEnum = z.enum(["BOSS", "LIEPIN", "JOB51", "ZHILIAN", "MANUAL"]);

const createBody = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  salary: z.string().optional(),
  jdText: z.string().min(1),
  requirements: z.array(z.coerce.string()).optional(),
  url: z.string().optional(),
  platform: platformEnum.optional(),
  companyInfo: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  if (isDemoModeServer()) {
    const jobs = await listDemoJobsForApi();
    return NextResponse.json(jobs, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
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
  const blocked = requireNotDemo();
  if (blocked) return blocked;
  try {
    const json = await req.json();
    const data = createBody.parse(json);
    const platform = platformEnum.parse(data.platform ?? "MANUAL");
    const normalizedUrl =
      typeof data.url === "string" && data.url.trim().length > 0
        ? data.url.trim()
        : undefined;
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

    const requirements = (data.requirements ?? []).map((item) => String(item));
    const companyInfoJson = toPrismaInputJson(
      data.companyInfo as Record<string, unknown> | undefined,
    );

    const payload: Prisma.JobCreateInput = {
      title: data.title,
      company: data.company,
      jdText: data.jdText,
      requirements,
      platform,
    };
    if (data.salary !== undefined) payload.salary = data.salary;
    if (normalizedUrl !== undefined) payload.url = normalizedUrl;
    if (companyInfoJson !== undefined) payload.companyInfo = companyInfoJson;

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
    const { status, body } = buildErrorResponse(e);
    return NextResponse.json(body, { status });
  }
}
