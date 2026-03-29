/**
 * 品牌角标：与主色块搭配，用于顶栏「JobHunter」旁。
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1d4ed8,#38bdf8)] text-sm font-semibold tracking-[-0.04em] text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] ${className}`}
      aria-hidden
    >
      JH
    </span>
  );
}
