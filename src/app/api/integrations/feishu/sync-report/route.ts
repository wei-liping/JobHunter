import { NextResponse } from "next/server";
import { syncLightReportToFeishu } from "@/lib/feishu/sync";
import { requireAdminToken } from "@/lib/security/request-guards";

export async function POST(req: Request) {
  try {
    requireAdminToken(req);
    const result = await syncLightReportToFeishu();
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "feishu report failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
