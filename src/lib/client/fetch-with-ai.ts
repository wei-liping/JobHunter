import { loadAiConfig } from "@/lib/client/ai-config";

function buildAiHeaders() {
  const cfg = loadAiConfig();
  const headers: Record<string, string> = {};
  if (cfg.apiKey.trim()) headers["x-openai-key"] = cfg.apiKey.trim();
  if (cfg.baseUrl.trim()) headers["x-openai-base-url"] = cfg.baseUrl.trim();
  if (cfg.model.trim()) headers["x-openai-model"] = cfg.model.trim();
  return headers;
}

export async function fetchWithAiHeaders(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const merged = new Headers(init?.headers || {});
  const ai = buildAiHeaders();
  Object.entries(ai).forEach(([k, v]) => merged.set(k, v));
  if (init?.body instanceof FormData) {
    merged.delete("content-type");
    merged.delete("Content-Type");
  }
  return fetch(input, { ...init, headers: merged, cache: "no-store" });
}
