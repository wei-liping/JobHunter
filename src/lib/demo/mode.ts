/**
 * 演示模式：静态岗位库 + 访客自带 API Key；不落库、不跑本地爬虫。
 * 服务端读 DEMO_MODE 或 NEXT_PUBLIC_DEMO_MODE；浏览器仅 NEXT_PUBLIC_*。
 */
export function isDemoModeServer(): boolean {
  const v = (k: string) => {
    const x = process.env[k]?.trim().toLowerCase();
    return x === "1" || x === "true" || x === "yes";
  };
  return v("DEMO_MODE") || v("NEXT_PUBLIC_DEMO_MODE");
}

/**
 * 客户端组件内判断演示模式（NEXT_PUBLIC_DEMO_MODE 在构建时注入，
 * 服务端渲染与浏览器首屏一致，避免水合不一致）。
 */
export function isDemoModeClient(): boolean {
  const x = process.env.NEXT_PUBLIC_DEMO_MODE?.trim().toLowerCase();
  return x === "1" || x === "true" || x === "yes";
}
