import { NextResponse } from "next/server";
import { getOpenAI, getChatModel } from "@/lib/ai/openai";
import { requireAdminToken } from "@/lib/security/request-guards";

export async function POST(req: Request) {
  try {
    requireAdminToken(req);
    const openai = getOpenAI(req);
    const model = getChatModel(req);
    await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    });
    return NextResponse.json({ ok: true, model });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI ping failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
