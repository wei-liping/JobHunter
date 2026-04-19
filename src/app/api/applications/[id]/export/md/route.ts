import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireNotDemo } from "@/lib/demo/require-not-demo";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = requireNotDemo();
  if (blocked) return blocked;
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

  const filename = `resume-${id}.md`;
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
