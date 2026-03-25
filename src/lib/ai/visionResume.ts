import { z } from "zod";
import { getChatModel, getOpenAI } from "@/lib/ai/openai";
import {
  VISION_RESUME_SYSTEM,
  VISION_RESUME_USER,
} from "@/prompts/vision-resume";

const resumeVisionSchema = z.object({
  fullMarkdown: z.string().min(1),
});

export type VisionResumeResult = z.infer<typeof resumeVisionSchema>;

function toDataUrl(mimeType: string, base64: string) {
  return `data:${mimeType};base64,${base64}`;
}

export async function extractResumeMarkdownFromPdf(file: Blob) {
  const buf = Buffer.from(await file.arrayBuffer());
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText().finally(() => parser.destroy());
  const text = (result.text || "").trim();
  if (!text) {
    throw new Error(
      "PDF 无法解析到文本（可能是扫描件），请改用图片上传或先 OCR。",
    );
  }
  // 轻量 Markdown：保留换行
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const md = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  return md.trim();
}

export async function extractResumeMarkdownFromImage(req: Request, file: Blob) {
  const mimeType = file.type || "image/png";
  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const model = getChatModel(req);

  const openai = getOpenAI(req);
  const messages = [
    { role: "system" as const, content: VISION_RESUME_SYSTEM },
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: VISION_RESUME_USER },
        {
          type: "image_url" as const,
          image_url: { url: toDataUrl(mimeType, base64) },
        },
      ],
    },
  ];

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages,
    });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (
      errMessage.includes("json_object") &&
      errMessage.includes("supported")
    ) {
      completion = await openai.chat.completions.create({
        model,
        messages,
      });
    } else {
      throw error;
    }
  }

  const content = completion.choices[0]?.message?.content;
  const text = typeof content === "string" ? content : "{}";
  const normalizedText = text.trim();
  const candidate =
    normalizedText.match(/\{[\s\S]*\}/)?.[0] ??
    normalizedText.replace(/```json|```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    parsed = {};
  }
  return resumeVisionSchema.parse(parsed).fullMarkdown.trim();
}
