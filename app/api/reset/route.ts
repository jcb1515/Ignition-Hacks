import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";

export const dynamic = "force-dynamic";

/**
 * Reseeds the database from the dashboard. Exists so a demo can be re-run
 * cleanly between judges without dropping to a terminal.
 */
export async function POST() {
  try {
    execFileSync("npx", ["tsx", "scripts/seed.ts"], {
      cwd: process.cwd(),
      stdio: "pipe",
      timeout: 30_000,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "reseed failed" },
      { status: 500 }
    );
  }
}
