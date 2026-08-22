import { NextResponse } from "next/server";
import { seed } from "@/lib/db/seed";

export const dynamic = "force-dynamic";

/**
 * Reseeds the database from the dashboard. Exists so a demo can be re-run
 * cleanly between judges without dropping to a terminal. Runs in-process —
 * no child process, no dependency on npx being on PATH.
 */
export async function POST() {
  try {
    const r = seed();
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "reseed failed" },
      { status: 500 }
    );
  }
}
