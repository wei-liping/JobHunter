import { redirect } from "next/navigation";

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => next.append(key, item));
    } else if (typeof value === "string") {
      next.set(key, value);
    }
  });
  redirect(next.toString() ? `/resume?${next.toString()}` : "/resume");
}
