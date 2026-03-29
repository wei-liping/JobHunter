import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runJobScoring } from "@/lib/ai/scoring";

const bodySchema = z.object({
  jobId: z.string().optional(),
  jdText: z.string().optional(),
  resumeMarkdown: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const data = bodySchema.parse(json);
    let jdText = data.jdText?.trim() ?? "";
    if (!jdText && data.jobId) {
      const job = await prisma.job.findUnique({ where: { id: data.jobId } });
      jdText = job?.jdText?.trim() ?? "";
    }
    if (!jdText) {
      return NextResponse.json(
        { error: "missing_job", message: "请先选择目标岗位。" },
        { status: 400 },
      );
    }

    const result = await runJobScoring(jdText, data.resumeMarkdown, req);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "评分失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
