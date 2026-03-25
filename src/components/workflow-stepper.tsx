"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKFLOW_STEPS } from "@/lib/workflow-steps";

type Props = {
  /** 0 准备 1 工作台 2 完成 */
  activeIndex: number;
  applicationId: string | null;
  finishComplete?: boolean;
  className?: string;
};

export function WorkflowStepper({
  activeIndex,
  applicationId,
  finishComplete = false,
  className,
}: Props) {
  return (
    <nav
      className={cn(
        "flex flex-wrap items-center justify-center gap-y-2 sm:gap-x-1",
        className,
      )}
      aria-label="投递流程"
    >
      {WORKFLOW_STEPS.map((step, index) => {
        const stepCompleted =
          index < activeIndex || (index === 2 && finishComplete);
        const isCurrent = index === activeIndex && index < 2;
        const showCheck = stepCompleted;

        const step1Href = applicationId
          ? `/?applicationId=${encodeURIComponent(applicationId)}`
          : "/";
        const step2Href = applicationId
          ? `/applications/${applicationId}`
          : null;

        const inner = (
          <>
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                stepCompleted &&
                  "border-primary bg-primary text-primary-foreground",
                isCurrent &&
                  "border-primary bg-primary text-primary-foreground ring-2 ring-primary/25",
                !stepCompleted &&
                  !isCurrent &&
                  "border-muted-foreground/25 bg-muted/40 text-muted-foreground",
              )}
            >
              {showCheck ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              ) : (
                index + 1
              )}
            </span>
            <span className="max-w-[6.5rem] truncate text-xs sm:max-w-none sm:text-sm">
              <span className="mr-0.5" aria-hidden>
                {step.emoji}
              </span>
              {step.title}
            </span>
          </>
        );

        const wrapClass = cn(
          "flex items-center gap-2 rounded-full px-2 py-1.5 transition-colors",
          isCurrent && "bg-primary text-primary-foreground shadow-sm",
          !isCurrent && stepCompleted && "text-foreground",
          !stepCompleted && !isCurrent && "text-muted-foreground opacity-80",
        );

        let body: ReactNode;
        if (index === 0) {
          body = (
            <Link
              href={step1Href}
              className={cn(
                wrapClass,
                "hover:bg-muted/80",
                isCurrent && "hover:bg-primary/90",
              )}
            >
              {inner}
            </Link>
          );
        } else if (index === 1 && step2Href) {
          body = (
            <Link
              href={step2Href}
              className={cn(
                wrapClass,
                "hover:bg-muted/80",
                isCurrent && "hover:bg-primary/90",
              )}
            >
              {inner}
            </Link>
          );
        } else if (index === 1 && !step2Href) {
          body = <div className={wrapClass}>{inner}</div>;
        } else {
          body = <div className={wrapClass}>{inner}</div>;
        }

        return (
          <div key={step.id} className="flex items-center">
            {index > 0 && (
              <div
                className="mx-1 hidden h-px w-6 bg-border sm:mx-2 sm:block sm:w-10"
                aria-hidden
              />
            )}
            {body}
          </div>
        );
      })}
    </nav>
  );
}
