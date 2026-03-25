import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildResumeDocxBuffer } from "@/lib/export/docx";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const application = await prisma.application.findUnique({
    where: { id },
    include: { job: true, resume: true },
  });
  if (!application) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let text = application.resume.rawMarkdown;
  if (application.tailoredResumeJson) {
    try {
      const j = JSON.parse(application.tailoredResumeJson) as {
        fullMarkdown?: string;
      };
      if (j.fullMarkdown) text = j.fullMarkdown;
    } catch {
      /* keep raw */
    }
  }

  const heading = `${application.job.title} · ${application.job.company}`;
  const buf = await buildResumeDocxBuffer(text, heading);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="resume-${id}.docx"`,
    },
  });
}
