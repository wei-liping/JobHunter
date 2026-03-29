import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ResumeStudioPage } from "@/components/resume-studio-page";

export default function ResumePage() {
  return (
    <AppShell
      title="📝 简历优化"
      description="围绕目标岗位完成评估、润色和开场白生成。简历版本默认手动保存，避免内容越积越乱。"
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">加载中…</p>}>
        <ResumeStudioPage />
      </Suspense>
    </AppShell>
  );
}
