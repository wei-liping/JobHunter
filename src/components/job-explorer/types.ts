export type JobPlatform = "BOSS直聘" | "51job" | "猎聘";

export type ExplorerJob = {
  id: string;
  title: string;
  company: string;
  salary: string;
  city: string;
  experience: string;
  education: string;
  companySize: string;
  platform: JobPlatform;
  score: number;
  /** BOSS 详情页 URL，抓取入库后可能有 */
  url?: string | null;
  detailStatus?: string;
  order?: number;
  /** 演示快照：BOSS 城市 code，用于筛选 */
  snapshotCityCode?: string;
  /** 演示快照：抓取时使用的关键词 */
  searchKeyword?: string;
};
