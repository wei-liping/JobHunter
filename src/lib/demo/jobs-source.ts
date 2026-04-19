import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDemoModeServer } from "@/lib/demo/mode";
import type { JobPlatform } from "@/generated/prisma/enums";

export type DemoJobMeta = {
  city?: string;
  experience?: string;
  education?: string;
  companySize?: string;
  searchKeyword?: string;
  cityCode?: string;
};

/** 与 Prisma Job 列表接口对齐的演示岗位条目 */
export type DemoSnapshotJob = {
  id: string;
  title: string;
  company: string;
  salary: string | null;
  jdText: string;
  requirements: string[];
  url: string | null;
  platform: JobPlatform;
  companyInfo: unknown;
  createdAt: string;
  updatedAt: string;
  demoMeta?: DemoJobMeta;
};

export type DemoJobsFile = {
  snapshotAt: string;
  jobs: DemoSnapshotJob[];
};

const REL = path.join("public", "data", "jobs-ai-pm.json");

let cache: DemoJobsFile | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000;

export async function readDemoJobsFile(): Promise<DemoJobsFile> {
  if (cache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cache;
  }
  const filePath = path.join(process.cwd(), REL);
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as DemoJobsFile;
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
    const data: DemoJobsFile = {
      snapshotAt:
        typeof parsed.snapshotAt === "string" ? parsed.snapshotAt : "",
      jobs,
    };
    cache = data;
    cacheLoadedAt = Date.now();
    return data;
  } catch {
    const empty: DemoJobsFile = { snapshotAt: "", jobs: [] };
    cache = empty;
    cacheLoadedAt = Date.now();
    return empty;
  }
}

export function clearDemoJobsCache() {
  cache = null;
  cacheLoadedAt = 0;
}

export async function listDemoJobsForApi(): Promise<
  Array<
    DemoSnapshotJob & {
      _count: { applications: number };
    }
  >
> {
  const { jobs } = await readDemoJobsFile();
  return jobs.map((j) => ({
    ...j,
    _count: { applications: 0 },
  }));
}

export async function getDemoJobById(
  id: string,
): Promise<DemoSnapshotJob | null> {
  const { jobs } = await readDemoJobsFile();
  return jobs.find((j) => j.id === id) ?? null;
}

export async function getDemoJobJdTextById(id: string): Promise<string> {
  if (!isDemoModeServer()) return "";
  const j = await getDemoJobById(id);
  return j?.jdText?.trim() ?? "";
}
