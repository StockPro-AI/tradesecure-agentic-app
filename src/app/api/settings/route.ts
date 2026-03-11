import { NextResponse } from "next/server";
import { getAssistantSettingsSafe, updateAssistantSettings } from "@/lib/store";

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

  const nextProvider = providerRaw === "" ? undefined : providerRaw;
  const nextModel = modelRaw === "" ? undefined : modelRaw;
  const nextBaseUrl =
    baseUrlRaw === undefined ? undefined : baseUrlRaw || null;
  const nextMode =
    modeRaw === "mock" || modeRaw === "auto" || modeRaw === "live"
      ? modeRaw
      : undefined;

  updateAssistantSettings({
    provider: nextProvider,
    model: nextModel,
    base_url: nextBaseUrl,
    api_key: clearApiKey ? null : apiKeyRaw,
    mode: nextMode,
  });

  return NextResponse.json(getAssistantSettingsSafe());
}
