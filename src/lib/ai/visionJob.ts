import { z } from "zod";
import { getChatModel, getOpenAI } from "@/lib/ai/openai";
import { VISION_JOB_SYSTEM, VISION_JOB_USER } from "@/prompts/vision-job";

const jobSchema = z.object({
  title: z.string().min(1),
  company: z.string().optional().default(""),
  salary: z.string().optional().default(""),
  jdText: z.string().min(1),
  requirements: z.array(z.string()).optional().default([]),
});

export type VisionJobResult = z.infer<typeof jobSchema>;

function toDataUrl(mimeType: string, base64: string) {
  return `data:${mimeType};base64,${base64}`;
}

export async function runVisionJobFromImage(
  req: Request,
  file: File,
): Promise<VisionJobResult> {
  const mimeType = file.type || "image/png";
  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const model = getChatModel(req);

  const openai = getOpenAI(req);
  const messages = [
    { role: "system" as const, content: VISION_JOB_SYSTEM },
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: VISION_JOB_USER },
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
  return jobSchema.parse(parsed);
}
