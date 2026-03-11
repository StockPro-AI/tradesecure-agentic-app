import { NextResponse } from "next/server";
import { getAssistantSettings } from "@/lib/store";

export const runtime = "nodejs";

type ModelsResponse = {
  ok: boolean;
  provider: string;
  baseUrl: string | null;
  models: string[];
  error?: string;
};

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message ??
          payload?.message ??
          `Request failed (${res.status})`;
    throw new Error(message);
  }
  return payload;
}

export async function GET() {
  const settings = getAssistantSettings();
  const provider = settings.provider;
  const baseUrl = settings.base_url;

  if (!baseUrl) {
    return NextResponse.json<ModelsResponse>({
      ok: false,
      provider,
      baseUrl,
      models: [],
      error: "Base URL is not configured.",
    });
  }

  try {
    if (provider === "ollama") {
      const url = `${baseUrl.replace(/\/$/, "")}/api/tags`;
      const headers: Record<string, string> = {};
      if (settings.api_key) {
        headers.Authorization = `Bearer ${settings.api_key}`;
      }

      const payload = await fetchJson(url, { headers });
      const models = Array.isArray(payload?.models)
        ? payload.models
            .map((item: { name?: string }) => item?.name)
            .filter((name: string | undefined) => Boolean(name))
        : [];
      return NextResponse.json<ModelsResponse>({
        ok: true,
        provider,
        baseUrl,
        models,
      });
    }

    if (provider === "openrouter") {
      if (!settings.api_key) {
        return NextResponse.json<ModelsResponse>({
          ok: false,
          provider,
          baseUrl,
          models: [],
          error: "OpenRouter API key is required.",
        });
      }
      const url = `${baseUrl.replace(/\/$/, "")}/models`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${settings.api_key}`,
      };
      const dashboardUrl =
        process.env.TS_DASHBOARD_URL ?? "http://localhost:3000";
      headers["HTTP-Referer"] = dashboardUrl;
      headers["X-Title"] = "TradeSecure Control";

      const payload = await fetchJson(url, { headers });
      const models = Array.isArray(payload?.data)
        ? payload.data
            .map((item: { id?: string }) => item?.id)
            .filter((id: string | undefined) => Boolean(id))
        : [];
      return NextResponse.json<ModelsResponse>({
        ok: true,
        provider,
        baseUrl,
        models,
      });
    }

    if (provider === "openai") {
      if (!settings.api_key) {
        return NextResponse.json<ModelsResponse>({
          ok: false,
          provider,
          baseUrl,
          models: [],
          error: "OpenAI API key is required.",
        });
      }
      const url = `${baseUrl.replace(/\/$/, "")}/models`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${settings.api_key}`,
      };

      const payload = await fetchJson(url, { headers });
      const models = Array.isArray(payload?.data)
        ? payload.data
            .map((item: { id?: string }) => item?.id)
            .filter((id: string | undefined) => Boolean(id))
        : [];
      return NextResponse.json<ModelsResponse>({
        ok: true,
        provider,
        baseUrl,
        models,
      });
    }

    return NextResponse.json<ModelsResponse>({
      ok: false,
      provider,
      baseUrl,
      models: [],
      error: "Unsupported provider.",
    });
  } catch (error) {
    return NextResponse.json<ModelsResponse>({
      ok: false,
      provider,
      baseUrl,
      models: [],
      error: error instanceof Error ? error.message : "Failed to load models.",
    });
  }
}
