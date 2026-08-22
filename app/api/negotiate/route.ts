import { NextRequest, NextResponse } from "next/server";
import { negotiationThread, runNegotiation } from "@/lib/agents/negotiation";
import { getVendor } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** GET ?vendorId= → the vendor's negotiation thread (oldest first). */
export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") ?? "";
  const vendor = getVendor(vendorId);
  if (!vendor) return NextResponse.json({ error: "vendor not found" }, { status: 404 });
  return NextResponse.json({ vendorId, vendorName: vendor.name, actions: negotiationThread(vendor.name) });
}

/** POST { vendorId } → SSE stream of the negotiation, same event shape as /api/audit. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const vendorId = typeof body?.vendorId === "string" ? body.vendorId : "";
  if (!vendorId || !getVendor(vendorId)) {
    return NextResponse.json({ error: "vendorId is required" }, { status: 400 });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        for await (const event of runNegotiation(vendorId)) send(event);
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "negotiation failed" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
