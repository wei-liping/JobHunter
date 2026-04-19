import { NextResponse } from "next/server";
import { isDemoModeServer } from "@/lib/demo/mode";

const DEMO_MESSAGE =
  "当前为在线演示版：岗位为只读快照，简历与面试记录仅保存在本机浏览器，此操作不可用。";

export function demoForbiddenResponse(): NextResponse {
  return NextResponse.json(
    { error: "demo_forbidden", message: DEMO_MESSAGE },
    { status: 403 },
  );
}

/** 非演示环境返回 null；演示环境返回 403 Response */
export function requireNotDemo(): NextResponse | null {
  return isDemoModeServer() ? demoForbiddenResponse() : null;
}

export function demoCrawlForbiddenSseLine(): string {
  return `event: error\ndata: ${JSON.stringify({
    ok: false,
    error: "demo_forbidden",
    message: DEMO_MESSAGE,
  })}\n\n`;
}
