import { NextResponse } from "next/server";
import {
  getAssistantSettingsSafe,
  updateAssistantSettings,
} from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getAssistantSettingsSafe());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const providerRaw =
    typeof body.provider === "string" ? body.provider.trim() : undefined;
  const modelRaw = typeof body.model === "string" ? body.model.trim() : undefined;
  const baseUrlRaw =
    typeof body.baseUrl === "string" ? body.baseUrl.trim() : undefined;
  const apiKeyRaw =
    typeof body.apiKey === "string" ? body.apiKey.trim() : undefined;
  const modeRaw =
    typeof body.mode === "string" ? body.mode.trim().toLowerCase() : undefined;
  const clearApiKey = Boolean(body.clearApiKey);

  updateAssistantSettings({
    provider: providerRaw === "" ? undefined : providerRaw,
    model: modelRaw === "" ? undefined : modelRaw,
    base_url: baseUrlRaw === undefined ? undefined : baseUrlRaw || null,
    api_key: clearApiKey ? null : apiKeyRaw,
    mode:
      modeRaw === "mock" || modeRaw === "auto" || modeRaw === "live"
        ? modeRaw
        : undefined,
  });

  return NextResponse.json(getAssistantSettingsSafe());
}
