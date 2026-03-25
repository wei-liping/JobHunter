import { Suspense } from "react";
import { HomeBoard } from "@/components/home-board";
import { AiConfigDialog } from "@/components/ai-config-dialog";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">JobHunter AI</span>
            <span className="text-sm text-muted-foreground">
              智能求职工作台
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              在下方创建投递
            </span>
            <AiConfigDialog />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-6">
        <Suspense
          fallback={<p className="text-sm text-muted-foreground">加载中…</p>}
        >
          <HomeBoard />
        </Suspense>
      </main>
    </div>
  );
}
