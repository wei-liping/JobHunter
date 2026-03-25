import { NextResponse } from "next/server";
import { runVisionJobFromImage } from "@/lib/ai/visionJob";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "missing_file", message: "请上传截图文件（file）" },
        { status: 400 },
      );
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "invalid_file", message: "仅支持图片截图" },
        { status: 400 },
      );
    }

    const result = await runVisionJobFromImage(req, file);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "vision_failed", message },
      { status: 400 },
    );
  }
}
