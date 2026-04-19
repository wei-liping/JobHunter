"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AiConfigDialog } from "@/components/ai-config-dialog";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";
import { SITE_NAV_ITEMS, isNavActive } from "@/lib/site-nav";
import { isDemoModeClient } from "@/lib/demo/mode";

type Props = {
  children: ReactNode;
  title?: string;
  description?: string;
  hero?: ReactNode;
  className?: string;
};

export function AppShell({
  children,
  title,
  description,
  hero,
  className,
}: Props) {
  const pathname = usePathname() ?? "/";
  const isDemo = isDemoModeClient();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,rgba(255,255,255,0.96)_46%)]">
      {isDemo ? (
        <div className="border-b border-amber-200 bg-amber-50/95 px-5 py-2 text-center text-xs text-amber-950 sm:text-sm">
          在线演示版 · 岗位只读 · 数据仅存本机浏览器 · 请自备 API Key
        </div>
      ) : null}
      <header className="sticky top-0 z-40 border-b border-sky-100/80 bg-white/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="text-base font-semibold tracking-[-0.02em] text-foreground">
              Job Hunter
            </span>
          </Link>

          <nav className="hidden items-center gap-4 text-sm text-muted-foreground lg:flex">
            {SITE_NAV_ITEMS.map((item, index) => (
              <div key={item.href} className="flex items-center gap-4">
                <Link
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 transition-colors hover:text-sky-700",
                    isNavActive(pathname, item.href) &&
                      "font-medium text-sky-700",
                  )}
                >
                  <span className="text-[13px] leading-none">{item.emoji}</span>
                  {item.label}
                </Link>
                {index < SITE_NAV_ITEMS.length - 1 && (
                  <span className="text-sky-200">|</span>
                )}
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-sky-200 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white shadow-[0_8px_20px_rgba(2,132,199,0.2)] sm:block">
              API
            </div>
            <AiConfigDialog />
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-8 sm:px-8",
          className,
        )}
      >
        {(title || description || hero) && (
          <section className="space-y-4 pt-4">
            {hero}
            {title && (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50/80 px-3 py-1 text-xs text-sky-700">
                  <span>当前栏目</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span>{title}</span>
                </div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
                  {title}
                </h1>
                {description && (
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                    {description}
                  </p>
                )}
              </div>
            )}
          </section>
        )}
        {children}
      </main>
    </div>
  );
}
