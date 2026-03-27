"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { JobPlatform } from "./types";

const PLATFORMS: (JobPlatform | "全部")[] = [
  "全部",
  "BOSS直聘",
  "51job",
  "猎聘",
];

const EDUCATION = ["全部", "本科", "硕士", "大专", "不限"] as const;
const EXPERIENCE = [
  "全部",
  "无需经验",
  "1年及以上",
  "2年及以上",
  "3年及以上",
  "5年及以上",
] as const;
const COMPANY_SIZE = [
  "全部",
  "0-20人",
  "20-99人",
  "100-499人",
  "500人以上",
] as const;
const CITY_OPTIONS = [
  { label: "深圳", value: "101280600" },
  { label: "广州", value: "101280100" },
  { label: "北京", value: "101010100" },
  { label: "上海", value: "101020100" },
  { label: "杭州", value: "101210100" },
] as const;

export type FilterState = {
  query: string;
  platform: JobPlatform | "全部";
  cityCode: string;
  education: (typeof EDUCATION)[number];
  experience: (typeof EXPERIENCE)[number];
  companySize: (typeof COMPANY_SIZE)[number];
};

type Props = {
  value: FilterState;
  onChange: (next: FilterState) => void;
  resultCount: number;
  onSearch: () => void;
  searching?: boolean;
};

/** 不用 flex-1，避免与搜索框同一行时把输入区挤没、或换行后下拉被压成「部平台」 */
const selectClass =
  "h-10 min-w-[9rem] shrink-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-[9.5rem]";

export function FilterBar({
  value,
  onChange,
  resultCount,
  onSearch,
  searching = false,
}: Props) {
  function patch(partial: Partial<FilterState>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-md">
      <div className="flex flex-col gap-3">
        <div className="w-full min-w-0 space-y-2">
          <Label htmlFor="explorer-search" className="sr-only">
            搜索职位或公司
          </Label>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="explorer-search"
              className="w-full pl-9"
              placeholder="搜索公司或职位…"
              value={value.query}
              onChange={(e) => patch({ query: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <select
            className={selectClass}
            value={value.platform}
            onChange={(e) =>
              patch({ platform: e.target.value as FilterState["platform"] })
            }
            aria-label="平台"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p === "全部" ? "全部平台" : p}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={value.cityCode}
            onChange={(e) => patch({ cityCode: e.target.value })}
            aria-label="城市"
          >
            {CITY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={value.education}
            onChange={(e) =>
              patch({
                education: e.target.value as FilterState["education"],
              })
            }
            aria-label="学历"
          >
            {EDUCATION.map((x) => (
              <option key={x} value={x}>
                {x === "全部" ? "全部学历" : x}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={value.experience}
            onChange={(e) =>
              patch({
                experience: e.target.value as FilterState["experience"],
              })
            }
            aria-label="经验"
          >
            {EXPERIENCE.map((x) => (
              <option key={x} value={x}>
                {x === "全部" ? "全部经验" : x}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={value.companySize}
            onChange={(e) =>
              patch({
                companySize: e.target.value as FilterState["companySize"],
              })
            }
            aria-label="公司规模"
          >
            {COMPANY_SIZE.map((x) => (
              <option key={x} value={x}>
                {x === "全部" ? "全部规模" : x}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="default"
            className="h-10 min-w-[7rem] rounded-md px-4"
            onClick={onSearch}
            disabled={searching}
          >
            {searching ? "搜索中…" : "搜索"}
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-end border-t pt-3 text-sm text-muted-foreground">
        共{" "}
        <span className="mx-1 font-medium text-foreground">{resultCount}</span>{" "}
        个职位
      </div>
    </div>
  );
}
