export const AI_CONFIG_STORAGE_KEY = "jobhunter.ai.config.v1";

export type ClientAiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

export function getDefaultAiConfig(): ClientAiConfig {
  return {
    apiKey: "",
    baseUrl: DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
  };
}

export function loadAiConfig(): ClientAiConfig {
  if (typeof window === "undefined") {
    return getDefaultAiConfig();
  }
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return getDefaultAiConfig();
    const parsed = JSON.parse(raw) as Partial<ClientAiConfig>;
    return {
      apiKey: parsed.apiKey ?? "",
      baseUrl: parsed.baseUrl ?? DEFAULT_BASE_URL,
      model: parsed.model ?? DEFAULT_MODEL,
    };
  } catch {
    return getDefaultAiConfig();
  }
}

export function saveAiConfig(config: ClientAiConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function clearAiConfig() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AI_CONFIG_STORAGE_KEY);
}
