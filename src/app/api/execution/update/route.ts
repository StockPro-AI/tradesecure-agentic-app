import { NextResponse } from "next/server";
import { updateExecutionStatus } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "");
  const status = String(body?.status ?? "");

  if (!id || !status) {
    return NextResponse.json(
      { ok: false, error: "Missing execution id or status." },
      { status: 400 }
    );
  }

  updateExecutionStatus(
    id,
    status as
      | "pending_human"
      | "approved"
      | "executed"
      | "rejected"
      | "failed",
    body?.error ?? null
  );

  return NextResponse.json({ ok: true });
}
