"use client";

import type { MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchWithAiHeaders } from "@/lib/client/fetch-with-ai";

type ApplicationListItem = {
  id: string;
  status: string;
  job: {
    title: string;
    company: string;
    salary: string | null;
    url: string | null;
  };
  resume: { title: string };
  scores: { matchScore: number }[];
};

const statusLabel: Record<string, string> = {
  NEW: "新建",
  SCORED_HIGH: "高匹配",
  SCORED_LOW: "待提升",
  REVIEWED: "已审阅",
  READY_TO_APPLY: "准备投递",
};

/** 首页右侧：投递列表（与岗位探索并列） */
export function HomeApplicationsSidebar() {
  const [applications, setApplications] = useState<ApplicationListItem[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetchWithAiHeaders("/api/applications");
    if (res.ok) setApplications(await res.json());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => void refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  async function deleteApplication(e: MouseEvent, applicationId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (
      !window.confirm(
        "确定删除该投递？删除后可在工作台重新创建；关联岗位若未被其他投递使用将保留在库中。",
      )
    ) {
      return;
    }
    const res = await fetchWithAiHeaders(`/api/applications/${applicationId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert("删除失败");
      return;
    }
    void refresh();
  }

  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">投递列表</CardTitle>
        <p className="text-xs font-normal text-muted-foreground">
          从岗位探索进入工作台创建投递后，将显示在这里
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[min(70vh,calc(100vh-14rem))]">
          <div className="space-y-2 p-4 pt-0">
            {applications.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无投递记录。</p>
            )}
            {applications.map((a) => (
              <div
                key={a.id}
                className="flex items-stretch gap-1 rounded-md border transition-colors hover:bg-muted/50"
              >
                <Link
                  href={`/applications/${a.id}`}
                  className="min-w-0 flex-1 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium leading-tight">
                        {a.job.title}
                      </div>
                      {a.job.url && /^https?:\/\//i.test(a.job.url) && (
                        <span
                          role="link"
                          tabIndex={0}
                          className="mt-0.5 inline-block cursor-pointer text-xs text-primary underline-offset-2 hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(
                              a.job.url!,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              window.open(
                                a.job.url!,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }
                          }}
                        >
                          BOSS 原文
                        </span>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {a.job.company}
                        {a.job.salary ? ` · ${a.job.salary}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {statusLabel[a.status] ?? a.status}
                    </Badge>
                  </div>
                  {a.scores[0] && (
                    <div className="mt-2 text-xs text-orange-600">
                      匹配分 {a.scores[0].matchScore}
                    </div>
                  )}
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  title="删除投递"
                  onClick={(e) => void deleteApplication(e, a.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
