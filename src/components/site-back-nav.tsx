"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 除首页 `/` 外，在左上角显示统一返回入口。
 */
export function SiteBackNav() {
  const pathname = usePathname();
  if (!pathname || pathname === "/") return null;

  if (pathname === "/workspace") {
    return (
      <Button variant="ghost" size="sm" className="-ml-2 shrink-0" asChild>
        <Link href="/">
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          返回岗位探索
        </Link>
      </Button>
    );
  }

  if (pathname.startsWith("/applications/")) {
    return (
      <Button variant="ghost" size="sm" className="-ml-2 shrink-0" asChild>
        <Link href="/workspace">
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          返回工作台
        </Link>
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="sm" className="-ml-2 shrink-0" asChild>
      <Link href="/">
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
        返回
      </Link>
    </Button>
  );
}
