"use client";

import { JobCard } from "./JobCard";
import type { ExplorerJob } from "./types";

type Props = {
  jobs: ExplorerJob[];
  loading?: boolean;
  emptyMessage?: string;
  selectedJobId?: string | null;
  savedJobIds: Set<string>;
  onSelect: (job: ExplorerJob) => void;
  onSave: (job: ExplorerJob) => void;
  onOptimize: (job: ExplorerJob) => void;
};

export function JobList({
  jobs,
  loading = false,
  emptyMessage = "暂无匹配的职位，请调整筛选条件。",
  selectedJobId,
  savedJobIds,
  onSelect,
  onSave,
  onOptimize,
}: Props) {
  if (loading) {
    return (
      <p className="rounded-[1.75rem] border border-dashed border-black/10 bg-white/60 px-4 py-16 text-center text-sm text-muted-foreground">
        正在连接本机 BOSS，会把结果直接放到这里。
      </p>
    );
  }

  if (jobs.length === 0) {
    return (
      <p className="rounded-[1.75rem] border border-dashed border-black/10 bg-white/60 px-4 py-16 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          selected={selectedJobId === job.id}
          saved={savedJobIds.has(job.id)}
          onSelect={onSelect}
          onSave={onSave}
          onOptimize={onOptimize}
        />
      ))}
    </div>
  );
}
