import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildResumePdfBuffer } from "@/lib/export/pdf";
import { buildResumePdfWithTemplate } from "@/lib/export/latex";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const exportId = Date.now();
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

  let buf: Buffer;
  let latexFailure: Error | null = null;
  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="resume-${id}-${exportId}.pdf"`,
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };

  try {
    buf = await buildResumePdfWithTemplate(text);
    headers["X-Resume-Export-Mode"] = "xelatex-template";
  } catch (e) {
    latexFailure = e instanceof Error ? e : new Error(String(e));
    console.error("[export/pdf] LaTeX template failed:", latexFailure.message);
    buf = buildResumePdfBuffer(
      text,
      `${application.job.title} · ${application.job.company}`,
    );
    headers["X-Resume-Export-Mode"] = "jspdf-fallback";
    headers["X-Resume-Export-Reason"] = latexFailure.message
      .replace(/[^\x20-\x7E]/g, "?")
      .slice(0, 200);
  }

  const debug = new URL(req.url).searchParams.get("debug") === "1";
  if (debug && latexFailure) {
    return NextResponse.json(
      {
        error: "latex_failed",
        message: latexFailure.message,
        fallback: "jspdf",
      },
      { status: 503 },
    );
  }

  return new NextResponse(new Uint8Array(buf), { headers });
}
