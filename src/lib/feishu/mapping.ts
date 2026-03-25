type SyncApplicationInput = {
  id: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  job: {
    title: string;
    company: string;
    salary: string | null;
  };
  scores?: { matchScore: number; createdAt: Date | string }[];
};

export function toFeishuFields(app: SyncApplicationInput) {
  const latest = app.scores?.[0];
  return {
    applicationId: app.id,
    jobTitle: app.job.title,
    company: app.job.company,
    salary: app.job.salary || "",
    status: app.status,
    matchScore: latest?.matchScore ?? 0,
    scoreUpdatedAt: latest?.createdAt
      ? new Date(latest.createdAt).toISOString()
      : "",
    updatedAt: new Date(app.updatedAt).toISOString(),
    createdAt: new Date(app.createdAt).toISOString(),
  };
}

type ReportRow = {
  status: string;
  count: number;
};

export function buildReportText(rows: ReportRow[]) {
  const title = "JobHunter 轻量报表";
  const lines = rows.map((r) => `- ${r.status}: ${r.count}`);
  return [title, ...lines].join("\n");
}
