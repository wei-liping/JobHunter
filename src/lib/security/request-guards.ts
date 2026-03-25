const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  /^\[::1\]$/,
];

export function isPrivateHost(hostname: string) {
  return PRIVATE_HOST_PATTERNS.some((p) => p.test(hostname));
}

export function normalizeAllowedBaseUrls() {
  const raw =
    process.env.ALLOWED_AI_BASE_URLS ||
    "https://api.openai.com/v1,https://api.deepseek.com/v1,https://ark.cn-beijing.volces.com/api/v3";
  return raw
    .split(",")
    .map((x) => x.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function validateAiBaseUrl(baseURL: string) {
  let parsed: URL;
  try {
    parsed = new URL(baseURL);
  } catch {
    throw new Error("Invalid AI base URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("AI base URL must use https.");
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error("Private network host is not allowed for AI base URL.");
  }
  const normalized = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
  const allowed = normalizeAllowedBaseUrls();
  if (!allowed.includes(normalized)) {
    throw new Error("AI base URL is not in allowlist.");
  }
  return normalized;
}

export function requireAdminToken(req: Request) {
  const required = process.env.JOBHUNTER_ADMIN_TOKEN;
  if (!required) return;
  const incoming = req.headers.get("x-jobhunter-admin-token") || "";
  if (incoming !== required) {
    throw new Error("Unauthorized admin request.");
  }
}
