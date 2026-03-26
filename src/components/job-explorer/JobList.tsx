"use client";

import { JobCard } from "./JobCard";
import type { ExplorerJob } from "./types";

type Props = {
  jobs: ExplorerJob[];
  loading?: boolean;
  emptyMessage?: string;
  onEnterPanel: (job: ExplorerJob) => void;
};

export function JobList({
  jobs,
  loading = false,
  emptyMessage = "暂无匹配的职位，请调整筛选条件。",
  onEnterPanel,
}: Props) {
  if (loading) {
    return (
      <p className="rounded-xl border border-dashed bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
        正在抓取并加载岗位，请稍候…
      </p>
    );
  }

  if (jobs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onEnterPanel={onEnterPanel} />
      ))}
    </div>
  );
}
