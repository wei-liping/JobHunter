import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireNotDemo } from "@/lib/demo/require-not-demo";
import {
  extractResumeMarkdownFromImage,
  extractResumeMarkdownFromPdf,
} from "@/lib/ai/visionResume";
import { ResumeSourceType } from "@/generated/prisma/enums";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const title = form.get("title");
    const persist = form.get("persist");
    const sourceJobId = form.get("sourceJobId");

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { error: "missing_file", message: "请上传简历文件（file）" },
        { status: 400 },
      );
    }

    const fileName = file instanceof File ? file.name : "upload";

    let md = "";
    if (
      file.type === "application/pdf" ||
      fileName.toLowerCase().endsWith(".pdf")
    ) {
      md = await extractResumeMarkdownFromPdf(file);
    } else if (file.type.startsWith("image/")) {
      md = await extractResumeMarkdownFromImage(req, file);
    } else {
      return NextResponse.json(
        { error: "invalid_file", message: "仅支持 PDF 或图片" },
        { status: 400 },
      );
    }

    const shouldPersist =
      typeof persist === "string" &&
      ["1", "true", "yes"].includes(persist.trim().toLowerCase());

    if (!shouldPersist) {
      return NextResponse.json({ rawMarkdown: md });
    }

    const blocked = requireNotDemo();
    if (blocked) return blocked;

    const sourceType = file.type.startsWith("image/")
      ? ResumeSourceType.OCR
      : ResumeSourceType.IMPORTED;
    const resume = await prisma.resume.create({
      data: {
        title:
          typeof title === "string" && title.trim() ? title.trim() : "我的简历",
        rawMarkdown: md,
        sourceType,
        sourceLabel:
          file instanceof File && file.name ? `导入：${file.name}` : "导入识别",
        sourceJobId:
          typeof sourceJobId === "string" && sourceJobId.trim()
            ? sourceJobId.trim()
            : null,
      },
    });

    return NextResponse.json({ resumeId: resume.id, rawMarkdown: md });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "import_failed", message },
      { status: 400 },
    );
  }
}
