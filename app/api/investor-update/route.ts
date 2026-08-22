import { NextResponse } from "next/server";
import { buildInvestorUpdate } from "@/lib/investor-update";

export const dynamic = "force-dynamic";

/** Slide-shaped JSON generated from the audit's own output. */
export async function GET() {
  try {
    return NextResponse.json(buildInvestorUpdate());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to build update" },
      { status: 500 }
    );
  }
}
