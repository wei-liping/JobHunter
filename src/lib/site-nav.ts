export const SITE_NAV_ITEMS = [
  { href: "/explore", label: "岗位探索", emoji: "🔎" },
  { href: "/resume", label: "简历优化", emoji: "📝" },
  { href: "/interview", label: "模拟面试", emoji: "🎙️" },
  { href: "/content", label: "内容管理", emoji: "🗂️" },
] as const;

export function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
