import { prisma } from "@/lib/prisma";
import {
  hasFeishuConfig,
  sendFeishuBotText,
  upsertBitableRecord,
} from "@/lib/feishu/client";
import { buildReportText, toFeishuFields } from "@/lib/feishu/mapping";

export async function syncApplicationToFeishu(applicationId: string) {
  if (!hasFeishuConfig()) {
    return { skipped: true, reason: "feishu not configured" as const };
  }

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: true,
      scores: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!app) throw new Error("application not found");

  const fields = toFeishuFields(app);
  const res = await upsertBitableRecord(app.id, fields);
  return { skipped: false, ...res };
}

export async function sendWorkflowNotification(text: string) {
  if (!process.env.FEISHU_BOT_WEBHOOK) {
    return { skipped: true, reason: "bot webhook missing" as const };
  }
  await sendFeishuBotText(text);
  return { skipped: false };
}

export async function syncLightReportToFeishu() {
  const grouped = await prisma.application.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const rows = grouped.map((g) => ({ status: g.status, count: g._count._all }));
  const text = buildReportText(rows);
  return sendWorkflowNotification(text);
}

export async function safeSyncApplication(applicationId: string) {
  try {
    await syncApplicationToFeishu(applicationId);
  } catch (e) {
    console.error("[feishu] sync application failed:", e);
  }
}
