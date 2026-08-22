import { NextResponse } from "next/server";
import { getBillingSummary } from "@/lib/billing";

export async function GET() {
  const summary = await getBillingSummary();
  return NextResponse.json(summary);
}
