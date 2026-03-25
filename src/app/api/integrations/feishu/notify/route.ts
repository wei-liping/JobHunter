import { NextResponse } from "next/server";
import { z } from "zod";
import { sendWorkflowNotification } from "@/lib/feishu/sync";
import { requireAdminToken } from "@/lib/security/request-guards";

const bodySchema = z.object({
  text: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    requireAdminToken(req);
    const json = await req.json();
    const { text } = bodySchema.parse(json);
    const result = await sendWorkflowNotification(text);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "feishu notify failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
