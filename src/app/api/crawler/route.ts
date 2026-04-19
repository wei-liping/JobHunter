import { NextResponse } from "next/server";
import { z } from "zod";
import { crawlJobWithPlaywright } from "@/lib/crawler/playwright";
import { requireNotDemo } from "@/lib/demo/require-not-demo";
import { JobPlatform } from "@/generated/prisma/enums";

const bodySchema = z.object({
  url: z.string().url(),
  platform: z.enum(["BOSS", "LIEPIN", "JOB51", "ZHILIAN", "MANUAL"]),
});

/**
 * 仅抓取公开页面；需本地已安装 Playwright 浏览器（npx playwright install chromium）。
 */
export async function POST(req: Request) {
  const blocked = requireNotDemo();
  if (blocked) return blocked;
  const json = await req.json();
  const { url, platform } = bodySchema.parse(json);
  try {
    const payload = await crawlJobWithPlaywright(url, platform as JobPlatform);
    if (!payload.title.trim() || !payload.jdText.trim()) {
      return NextResponse.json(
        {
          error:
            "抓取结果为空，可能已跳转到登录/验证页（平台反爬）。请先登录并使用登录态抓取，或手动粘贴 JD。",
        },
        { status: 422 },
      );
    }
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "crawl failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
