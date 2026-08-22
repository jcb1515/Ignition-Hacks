import { NextRequest, NextResponse } from "next/server";
import { ask } from "@/lib/ask";

export const dynamic = "force-dynamic";

/** POST { question } → grounded answer about the current audit. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const question = typeof body?.question === "string" ? body.question : "";
  if (!question.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await ask(question.slice(0, 500)));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ask failed" },
      { status: 500 }
    );
  }
}
