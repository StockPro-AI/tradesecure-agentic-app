import { NextResponse } from "next/server";
import { createExecutionIntent } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const symbol = String(body?.symbol ?? "").toUpperCase();
  const side = body?.side === "sell" ? "sell" : "buy";
  const qty = Number(body?.qty ?? 0);

  if (!symbol || Number.isNaN(qty) || qty <= 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid symbol or quantity." },
      { status: 400 }
    );
  }

  const intent = createExecutionIntent({
    strategyId: body?.strategyId ?? null,
    symbol,
    side,
    qty,
  });

  return NextResponse.json({ ok: true, intent });
}
