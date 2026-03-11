import { NextResponse } from "next/server";
import { approveExecution } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "");

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing execution id." },
      { status: 400 }
    );
  }

  approveExecution(id);
  return NextResponse.json({ ok: true });
}
