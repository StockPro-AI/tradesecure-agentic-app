import { crayonStream } from "@crayonai/stream";
import { NextResponse } from "next/server";
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
  const provider = settings.provider;
  const providerSupported =
    provider === "openai" || provider === "openrouter" || provider === "ollama";
  const hasApiKey = Boolean(settings.api_key);
  const requiresApiKey =
    provider === "openai" ||
    provider === "openrouter" ||
    (provider === "ollama" &&
      Boolean(settings.base_url?.includes("ollama.com")));
  const hasBaseUrl = Boolean(settings.base_url);
  const canLive = providerSupported && hasBaseUrl && (!requiresApiKey || hasApiKey);
  const useLive = assistantMode === "live" ? canLive : assistantMode === "auto" ? canLive : false;

  const { stream, onText, onEnd, onError, onLLMEnd } = crayonStream();

  try {
    if (!useLive) {
      if (assistantMode === "live" && (!providerSupported || !hasBaseUrl || (requiresApiKey && !hasApiKey))) {
        const reason = !providerSupported
          ? "The selected provider is not supported yet."
          : !hasBaseUrl
            ? "No base URL is configured."
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
      if (!settings.model) {
        onText(
          JSON.stringify({
            response: [
              {
                type: "text",
                text: "No model selected. Open Settings and choose a model from the detected list.",
              },
            ],
          })
        );
        onLLMEnd();
        onEnd();
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      }

      const baseUrl = settings.base_url ?? "";
      const endpoint =
        provider === "ollama"
          ? `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`
          : `${baseUrl.replace(/\/$/, "")}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (requiresApiKey && settings.api_key) {
        headers.Authorization = `Bearer ${settings.api_key}`;
      }
      if (provider === "openrouter") {
        const dashboardUrl =
          process.env.TS_DASHBOARD_URL ?? "http://localhost:3000";
        headers["HTTP-Referer"] = dashboardUrl;
        headers["X-Title"] = "TradeSecure Control";
      }

      const contextBlock = [
        `Pending approvals: ${pending.length}`,
        `Active strategies: ${dashboard.strategies.length}`,
        `Latest symbols: ${dashboard.market
          .map((item) => item.symbol)
          .slice(0, 8)
          .join(", ") || "None"}`,
      ].join("\n");

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
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
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMessage =
          payload?.error?.message ??
          payload?.message ??
          `LLM request failed (${res.status}).`;
        throw new Error(errorMessage);
      }

      const text =
        payload?.choices?.[0]?.message?.content ??
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
    provider: settings.provider,
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
