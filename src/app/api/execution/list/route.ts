import { NextResponse } from "next/server";
import { listExecutionQueue } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const data = listExecutionQueue(
    status as
      | "pending_human"
      | "approved"
      | "executed"
      | "rejected"
      | "failed"
      | undefined
  );

  return NextResponse.json({ ok: true, data });
}
