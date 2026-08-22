import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ELEVENLABS_BASE = "https://api.elevenlabs.io";

/**
 * Proxy to ElevenLabs speech-to-text (Scribe).
 *
 * The client records a short audio clip with the mic and posts it as multipart
 * form data under the `audio` field. We forward it to ElevenLabs and return
 * the transcript. If no key is configured, the voice agent falls back to the
 * browser's SpeechRecognition or typed input.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "multipart form data required" },
      { status: 400 }
    );
  }

  const audio = form.get("audio");
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "audio file is required" },
      { status: 400 }
    );
  }

  const modelId = process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2";
  const language = process.env.ELEVENLABS_STT_LANGUAGE ?? "en";

  const upstream = new FormData();
  upstream.append("file", audio, "audio.webm");
  upstream.append("model_id", modelId);
  upstream.append("language_code", language);

  try {
    const res = await fetch(`${ELEVENLABS_BASE}/v1/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: upstream,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      return NextResponse.json(
        { error: `ElevenLabs STT failed: ${res.status} ${detail}` },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }

    const data = (await res.json()) as { text?: string };
    return NextResponse.json({ text: data.text ?? "" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "stt failed" },
      { status: 500 }
    );
  }
}
