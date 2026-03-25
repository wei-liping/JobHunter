import OpenAI from "openai";
import { validateAiBaseUrl } from "@/lib/security/request-guards";

export type ResolvedAiProvider = {
  apiKey: string;
  baseURL: string;
  model: string;
};

export function resolveAiProvider(req?: Request): ResolvedAiProvider {
  const headerKey = req?.headers.get("x-openai-key")?.trim();
  const headerBase = req?.headers.get("x-openai-base-url")?.trim();
  const headerModel = req?.headers.get("x-openai-model")?.trim();
  const hasHeaderConfig = Boolean(headerKey || headerBase || headerModel);
  if (hasHeaderConfig && !headerKey) {
    throw new Error(
      "x-openai-key is required when using request-level AI config.",
    );
  }
  const apiKey = headerKey || process.env.OPENAI_API_KEY || "";
  const sourceBase =
    headerBase || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const baseURL = validateAiBaseUrl(sourceBase);
  const modelRaw = headerModel || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const model = modelRaw.slice(0, 120);

  if (!apiKey) {
    throw new Error("AI key is missing. Set OPENAI_API_KEY or x-openai-key.");
  }
  return { apiKey, baseURL, model };
}

export function getOpenAI(req?: Request) {
  const { apiKey, baseURL } = resolveAiProvider(req);
  return new OpenAI({ apiKey, baseURL });
}

export function getChatModel(req?: Request) {
  return resolveAiProvider(req).model;
}
