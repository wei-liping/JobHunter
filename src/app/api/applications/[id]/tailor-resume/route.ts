import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireNotDemo } from "@/lib/demo/require-not-demo";
import { runResumeTailor } from "@/lib/ai/resumeGenerator";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = requireNotDemo();
  if (blocked) return blocked;
  try {
    const { id } = await params;
    const application = await prisma.application.findUnique({
      where: { id },
      include: { job: true, resume: true },
    });
    if (!application) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const tailored = await runResumeTailor(
      application.job.jdText,
      application.resume.rawMarkdown,
      req,
    );

    const updated = await prisma.application.update({
      where: { id },
      data: {
        tailoredResumeJson: JSON.stringify(tailored),
      },
      include: { job: true, resume: true },
    });

    return NextResponse.json({ application: updated, tailored });
  } catch (e) {
    console.error("[api/applications/tailor-resume]", e);
    const message = e instanceof Error ? e.message : "改写失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
