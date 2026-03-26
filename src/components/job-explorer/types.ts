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
};
