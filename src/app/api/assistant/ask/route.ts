import { crayonStream } from "@crayonai/stream";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildAssistantResponse } from "@/lib/assistant";
import { getAssistantSettings, getDashboardData, logEvent } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rawPrompt = body?.prompt ?? body?.message ?? "";
  const prompt =
    typeof rawPrompt === "string" ? rawPrompt : rawPrompt?.content ?? "";

  const dashboard = getDashboardData();
  const pending = dashboard.queue.filter((item) => item.status === "pending_human");
  const settings = getAssistantSettings();
  const assistantMode = settings.mode ?? "auto";

  const { stream, onText, onEnd, onError, onLLMEnd } = crayonStream();

  try {
    const providerSupported = settings.provider === "openai";
    const hasApiKey = Boolean(settings.api_key);
    const shouldUseMock =
      assistantMode === "mock" || !providerSupported || !hasApiKey;
    if (shouldUseMock) {
      if (assistantMode !== "mock" && (!hasApiKey || !providerSupported)) {
        const reason = !providerSupported
          ? "The selected provider is not supported yet."
          : "Live mode is enabled but no API key is configured.";
        onText(
          JSON.stringify({
            response: [
              {
                type: "text",
                text: `${reason} Open Settings and add a model API key to enable live responses.`,
              },
            ],
          })
        );
      } else {
        const responsePayload = buildAssistantResponse(prompt, {
          pending,
          strategies: dashboard.strategies,
          marketSymbols: dashboard.market.map((item) => item.symbol),
        });
        onText(JSON.stringify(responsePayload));
      }
    } else {
      const client = new OpenAI({
        apiKey: settings.api_key ?? undefined,
        baseURL: settings.base_url ?? undefined,
      });

      const contextBlock = [
        `Pending approvals: ${pending.length}`,
        `Active strategies: ${dashboard.strategies.length}`,
        `Latest symbols: ${dashboard.market.map((item) => item.symbol).slice(0, 8).join(", ") || "None"}`,
      ].join("\n");

      const completion = await client.chat.completions.create({
        model: settings.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are the TradeSecure ops assistant. Summarize system state, propose next actions, and keep responses concise.",
          },
          {
            role: "user",
            content: `Dashboard context:\n${contextBlock}`,
          },
          {
            role: "user",
            content: prompt || "Give me a status update.",
          },
        ],
      });

      const text =
        completion.choices[0]?.message?.content ??
        "No response was generated.";

      onText(
        JSON.stringify({
          response: [{ type: "text", text }],
        })
      );
    }

    onLLMEnd();
    onEnd();
  } catch (error) {
    onError(error instanceof Error ? error : new Error("Assistant error"));
  }

  logEvent("info", "Assistant response streamed", {
    prompt: typeof prompt === "string" ? prompt.slice(0, 160) : "",
    mode: assistantMode,
    model: settings.model,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: process.env.TS_ASSISTANT_MODE ?? "mock",
  });
}
