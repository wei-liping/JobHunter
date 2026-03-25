import { chromium, type Browser } from "playwright";
import type { JobPlatform } from "@/generated/prisma/enums";
import type { CrawlerAuthOptions } from "@/lib/crawler/session";

export type CrawlPayload = {
  title: string;
  company: string;
  salary?: string;
  jdText: string;
  url: string;
  requirements: string[];
};

const SELECTORS: Partial<
  Record<
    JobPlatform,
    { title?: string; company?: string; salary?: string; body?: string }
  >
> = {
  BOSS: {
    title: ".job-name, .name, h1",
    company: ".company-name, .company",
    salary: ".salary, .job-money",
    body: ".job-sec-text, .job-detail",
  },
  LIEPIN: {
    title: "h1",
    body: ".job-introduce, .job-detail-main",
  },
  JOB51: {
    title: "h1",
    body: ".job_msg, .job_infor",
  },
  ZHILIAN: {
    title: "h1",
    body: ".job-sec-text, .describtion",
  },
};

/**
 * 使用 Playwright 抓取公开职位页正文。
 * 各平台 DOM 经常变更；失败时抛出错误，由上层提示用户改用手动粘贴。
 */
export async function crawlJobWithPlaywright(
  url: string,
  platform: JobPlatform,
  auth?: CrawlerAuthOptions,
): Promise<CrawlPayload> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "zh-CN",
      ...(auth?.storageStatePath
        ? { storageState: auth.storageStatePath }
        : {}),
      ...(auth?.extraHTTPHeaders
        ? { extraHTTPHeaders: auth.extraHTTPHeaders }
        : {}),
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 800));

    const cfg = SELECTORS[platform] ?? {};

    const title =
      (cfg.title &&
        (await page
          .locator(cfg.title)
          .first()
          .innerText()
          .catch(() => ""))) ||
      (await page.title());

    let company = "";
    if (cfg.company) {
      company = await page
        .locator(cfg.company)
        .first()
        .innerText()
        .catch(() => "");
    }

    let salary = "";
    if (cfg.salary) {
      salary = await page
        .locator(cfg.salary)
        .first()
        .innerText()
        .catch(() => "");
    }

    let jdText = "";
    if (cfg.body) {
      jdText = await page
        .locator(cfg.body)
        .first()
        .innerText()
        .catch(() => "");
    }
    if (!jdText) {
      jdText = await page.evaluate(() =>
        document.body.innerText.slice(0, 12000),
      );
    }

    const requirements: string[] = [];
    const lines = jdText
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines.slice(0, 30)) {
      if (/要求|任职|技能|优先|熟悉|精通/.test(line)) {
        requirements.push(line);
      }
    }

    return {
      title: title.trim().slice(0, 200),
      company: company.trim().slice(0, 200) || "未知公司",
      salary: salary.trim() || undefined,
      jdText: jdText.trim(),
      url,
      requirements,
    };
  } finally {
    await browser?.close();
  }
}
