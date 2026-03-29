import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { InterviewStudioPage } from "@/components/interview-studio-page";

export default function InterviewPage() {
  return (
    <AppShell
      title="🎙️ 模拟面试"
      description="选择目标岗位和简历后开始一场纯文本模拟面试。每轮问答都会自动写入内容管理。"
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">加载中…</p>}>
        <InterviewStudioPage />
      </Suspense>
    </AppShell>
  );
}
