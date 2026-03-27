import { JobExplorerPage } from "@/components/job-explorer/JobExplorerPage";
import { AiConfigDialog } from "@/components/ai-config-dialog";
import { BrandMark } from "@/components/brand-mark";
import { HomeApplicationsSidebar } from "@/components/home-applications-sidebar";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <span className="text-lg font-semibold">JobHunter AI</span>
              <span className="text-sm text-muted-foreground">
                智能求职工作台
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              选岗位 · 进工作台处理投递
            </span>
            <AiConfigDialog />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <JobExplorerPage />
          </div>
          <aside className="min-w-0 lg:self-start">
            <HomeApplicationsSidebar />
          </aside>
        </div>
      </main>
    </div>
  );
}
