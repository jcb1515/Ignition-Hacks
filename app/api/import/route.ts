import { NextRequest, NextResponse } from "next/server";
import { importSpendFile } from "@/lib/import";

export const dynamic = "force-dynamic";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload spend as CSV or JSON and run the agents on it.
 *
 * multipart/form-data: file=<csv|json>, replace=true|false
 * application/json:    { text, filename?, replace? }  or a raw array of rows
 *
 * Works in every mode — DEMO_MODE only governs outbound network calls, and an
 * upload makes none.
 */
export async function POST(request: NextRequest) {
  try {
    let text = "";
    let filename = "";
    let replace = true;

    const ctype = request.headers.get("content-type") ?? "";
    if (ctype.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "No file field in upload" }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 5 MB" }, { status: 413 });
      text = await file.text();
      filename = file.name;
      replace = form.get("replace") !== "false";
    } else {
      const body = await request.json();
      if (Array.isArray(body)) text = JSON.stringify(body);
      else {
        text = typeof body?.text === "string" ? body.text : JSON.stringify(body?.rows ?? body?.transactions ?? []);
        filename = typeof body?.filename === "string" ? body.filename : "";
        replace = body?.replace !== false;
      }
    }

    if (!text.trim()) return NextResponse.json({ error: "Empty file" }, { status: 400 });
    const result = importSpendFile(text, filename, { replace });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "import failed" }, { status: 400 });
  }
}
