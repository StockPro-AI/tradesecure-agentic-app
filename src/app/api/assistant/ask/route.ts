import { crayonStream } from "@crayonai/stream";
import { NextResponse } from "next/server";
import { buildAssistantResponse } from "@/lib/assistant";
import { getDashboardData, logEvent } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rawPrompt = body?.prompt ?? body?.message ?? "";
  const prompt =
    typeof rawPrompt === "string" ? rawPrompt : rawPrompt?.content ?? "";

  const dashboard = getDashboardData();
  const responsePayload = buildAssistantResponse(prompt, {
    pending: dashboard.queue.filter((item) => item.status === "pending_human"),
    strategies: dashboard.strategies,
    marketSymbols: dashboard.market.map((item) => item.symbol),
  });

  const { stream, onText, onEnd, onError, onLLMEnd } = crayonStream();

  try {
    onText(JSON.stringify(responsePayload));
    onLLMEnd();
    onEnd();
  } catch (error) {
    onError(error instanceof Error ? error : new Error("Assistant error"));
  }

  logEvent("info", "Assistant response streamed", {
    prompt: typeof prompt === "string" ? prompt.slice(0, 160) : "",
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
