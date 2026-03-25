import { NextResponse } from "next/server";
import { z } from "zod";
import { syncApplicationToFeishu } from "@/lib/feishu/sync";
import { requireAdminToken } from "@/lib/security/request-guards";

const bodySchema = z.object({
  applicationId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    requireAdminToken(req);
    const json = await req.json();
    const { applicationId } = bodySchema.parse(json);
    const result = await syncApplicationToFeishu(applicationId);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "feishu sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
