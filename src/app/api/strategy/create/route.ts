import { NextResponse } from "next/server";
import { createStrategy } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const hypothesis = String(body?.hypothesis ?? "").trim();

  if (!name || !hypothesis) {
    return NextResponse.json(
      { ok: false, error: "Name and hypothesis are required." },
      { status: 400 }
    );
  }

  const strategy = createStrategy(name, hypothesis);
  return NextResponse.json({ ok: true, strategy });
}
