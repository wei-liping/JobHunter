"use client";

import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ExplorerJob } from "./types";

type Props = {
  job: ExplorerJob;
  className?: string;
  onEnterPanel: (job: ExplorerJob) => void;
};

export function JobCard({ job, className, onEnterPanel }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-md transition-shadow hover:shadow-lg sm:flex-row sm:items-stretch sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted"
          aria-hidden
        >
          <Building2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{job.company}</span>
            <Badge
              variant="secondary"
              className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
            >
              {job.platform}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold leading-tight text-foreground">
              {job.title}
            </p>
            {job.url &&
              /^https?:\/\//i.test(job.url) &&
              (job.platform === "BOSS直聘" ||
                job.url.includes("zhipin.com")) && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  打开 BOSS 详情页
                </a>
              )}
          </div>
          <p className="text-xs text-muted-foreground">{job.city}</p>
          <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
            <span className="rounded-md bg-muted px-2 py-0.5">
              学历 {job.education}
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5">
              经验 {job.experience}
            </span>
          </div>
          <p className="pt-1 text-xs text-muted-foreground">
            AI 评分：
            <span className="font-medium text-foreground">
              {job.score}
            </span>{" "}
            分（占位）
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-stretch justify-between gap-3 sm:items-end sm:text-right">
        <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">
          {job.salary}
        </p>
        <Button
          type="button"
          variant="default"
          className="sm:min-w-[10rem]"
          onClick={() => onEnterPanel(job)}
        >
          进入定制面板
        </Button>
      </div>
    </div>
  );
}
