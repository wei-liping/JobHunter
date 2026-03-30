"use client";

import { Building2, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExplorerJob } from "./types";

type Props = {
  job: ExplorerJob;
  className?: string;
  selected?: boolean;
  saved?: boolean;
  onSelect: (job: ExplorerJob) => void;
  onSave: (job: ExplorerJob) => void;
  onOptimize: (job: ExplorerJob) => void;
};

export function JobCard({
  job,
  className,
  selected = false,
  saved = false,
  onSelect,
  onSave,
  onOptimize,
}: Props) {
  const detailHint =
    job.detailStatus === "pending"
      ? "正在补充职位详情"
      : job.detailStatus === "page_fallback"
        ? "详情来自页面补抓"
        : job.detailStatus && job.detailStatus !== "detail_ok"
          ? "详情暂未补全"
          : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(job)}
      className={cn(
        "w-full rounded-[1.75rem] border border-sky-100 bg-white/90 p-5 text-left shadow-[0_12px_32px_rgba(59,130,246,0.08)] transition hover:-translate-y-0.5 hover:border-sky-200",
        selected && "border-sky-300 shadow-[0_20px_44px_rgba(59,130,246,0.16)]",
        className,
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                {job.title}
              </p>
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] text-sky-700">
                {job.platform}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{job.company}</p>
          </div>
          <p className="text-sm font-semibold text-foreground">{job.salary}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-sky-100 bg-sky-50/40 px-2.5 py-1">
            {job.city}
          </span>
          <span className="rounded-full border border-sky-100 bg-sky-50/40 px-2.5 py-1">
            {job.experience}
          </span>
          <span className="rounded-full border border-sky-100 bg-sky-50/40 px-2.5 py-1">
            {job.education}
          </span>
          <span className="rounded-full border border-sky-100 bg-sky-50/40 px-2.5 py-1">
            {job.companySize}
          </span>
          {detailHint ? (
            <span className="rounded-full border border-sky-100 bg-white px-2.5 py-1 text-sky-700">
              {detailHint}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={saved ? "secondary" : "outline"}
            className="rounded-full"
            onClick={(event) => {
              event.stopPropagation();
              onSave(job);
            }}
          >
            {saved ? <Check className="mr-1.5 h-4 w-4" /> : null}
            {saved ? "已加入看板" : "加入内容管理"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-full bg-sky-600 text-white hover:bg-sky-700"
            onClick={(event) => {
              event.stopPropagation();
              onOptimize(job);
            }}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            进入简历优化
          </Button>
        </div>
      </div>
    </button>
  );
}
