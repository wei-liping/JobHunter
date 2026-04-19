import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runResumeTailor } from "@/lib/ai/resumeGenerator";
import { isDemoModeServer } from "@/lib/demo/mode";
import { getDemoJobById } from "@/lib/demo/jobs-source";

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
      if (isDemoModeServer()) {
        const dj = await getDemoJobById(data.jobId);
        jdText = dj?.jdText?.trim() ?? "";
      } else {
        const job = await prisma.job.findUnique({ where: { id: data.jobId } });
        jdText = job?.jdText?.trim() ?? "";
      }
    }
    if (!jdText) {
      return NextResponse.json(
        { error: "missing_job", message: "请先选择目标岗位。" },
        { status: 400 },
      );
    }

    const tailored = await runResumeTailor(jdText, data.resumeMarkdown, req);
    return NextResponse.json({ tailored });
  } catch (error) {
    const message = error instanceof Error ? error.message : "简历润色失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
