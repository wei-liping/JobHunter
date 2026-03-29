import { AppShell } from "@/components/app-shell";
import { JobExplorerPage } from "@/components/job-explorer/JobExplorerPage";

export default function ExplorePage() {
  return (
    <AppShell
      title="🔎 岗位探索"
      description="连接本机 BOSS 搜索结果，先看清 JD，再决定是否加入职位看板或继续进入简历优化。"
    >
      <JobExplorerPage />
    </AppShell>
  );
}
