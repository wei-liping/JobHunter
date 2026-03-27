/**
 * 品牌角标：与主色块搭配，用于顶栏「JobHunter」旁。
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-lg leading-none text-primary-foreground shadow-sm ${className}`}
      aria-hidden
    >
      💼
    </span>
  );
}
