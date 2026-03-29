import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ContentHubPage } from "@/components/content-hub-page";

export default function ContentPage() {
  return (
    <AppShell
      title="🗂️ 内容管理"
      description="把岗位、简历、投递、面试和复盘都收进一个地方，后续查看和复用会更轻松。"
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">加载中…</p>}>
        <ContentHubPage />
      </Suspense>
    </AppShell>
  );
}
