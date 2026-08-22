import { runAudit } from "@/lib/agents/orchestrator";

// The audit mutates the database and streams as it goes; never cache it.
export const dynamic = "force-dynamic";

/**
 * Streams the audit as server-sent events so the dashboard can show the
 * agent reasoning as it is produced rather than after everything finishes.
 */
export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        for await (const event of runAudit()) {
          send(event);
        }
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Audit failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
