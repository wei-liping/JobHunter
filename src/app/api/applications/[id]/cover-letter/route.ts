import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireNotDemo } from "@/lib/demo/require-not-demo";
import { runCoverLetter } from "@/lib/ai/coverLetterGenerator";

export async function POST(
  req: Request,
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

  const summary = application.resume.rawMarkdown.slice(0, 4000);
  const text = await runCoverLetter(application.job.jdText, summary, req);

  const updated = await prisma.application.update({
    where: { id },
    data: { coverLetter: text },
    include: { job: true, resume: true },
  });

  return NextResponse.json({ application: updated, coverLetter: text });
}
