import { NextResponse } from "next/server";
import { runMockBacktest } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const strategyId = String(body?.strategyId ?? "");

  if (!strategyId) {
    return NextResponse.json(
      { ok: false, error: "Missing strategy id." },
      { status: 400 }
    );
  }

  const run = runMockBacktest(strategyId);
  return NextResponse.json({ ok: true, run });
}
