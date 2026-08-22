import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ELEVENLABS_BASE = "https://api.elevenlabs.io";

const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
};

/**
 * Default (premade) voices, which unlike Voice Library and professional-clone
 * voices are usable on the free API tier. Ordered deep-male first so the
 * fallback sounds close to the narrator voices people usually pick.
 */
const FREE_TIER_VOICES = [
  "nPczCjzI2devNBz1zQrb", // Brian — deep, resonant, comforting
  "JBFqnCBsd6RMkjVDRZzb", // George — warm storyteller
  "cjVigY5qzO86Huf0OWal", // Eric — smooth, trustworthy
  "EXAVITQu4vr4xnSDxMaL", // Sarah — mature, reassuring
];

/**
 * Remembers the voice that actually worked so we pay the fallback cost once per
 * server process instead of on every reply.
 */
let workingVoiceId: string | null = null;

function speak(
  apiKey: string,
  text: string,
  voiceId: string,
  modelId: string,
  outputFormat: string
) {
  const url = new URL(`${ELEVENLABS_BASE}/v1/text-to-speech/${voiceId}`);
  url.searchParams.set("output_format", outputFormat);

  return fetch(url.toString(), {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: text.slice(0, 4000),
      model_id: modelId,
      voice_settings: DEFAULT_VOICE_SETTINGS,
    }),
  });
}

/**
 * Proxy to ElevenLabs text-to-speech.
 *
 * The API key never reaches the browser; the client sends text and gets back an
 * audio/mpeg blob. Free ElevenLabs plans reject Voice Library and professional
 * clone voices with a 402, so if the configured voice is refused we retry with a
 * default voice before giving up and letting the client use browser speech.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const configuredVoiceId = process.env.ELEVENLABS_VOICE_ID ?? "";
  const modelId = process.env.ELEVENLABS_TTS_MODEL ?? "eleven_flash_v2_5";
  const outputFormat =
    process.env.ELEVENLABS_TTS_OUTPUT_FORMAT ?? "mp3_44100_128";

  // Try the remembered working voice first, then the configured one, then the
  // free-tier defaults. Deduplicated so we never bill the same voice twice.
  const candidates = [
    ...new Set(
      [workingVoiceId, configuredVoiceId, ...FREE_TIER_VOICES].filter(
        (v): v is string => Boolean(v)
      )
    ),
  ];

  let lastStatus = 502;
  let lastDetail = "no voice available";

  for (const voiceId of candidates) {
    let upstream: Response;
    try {
      upstream = await speak(apiKey, text, voiceId, modelId, outputFormat);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "tts failed" },
        { status: 500 }
      );
    }

    if (upstream.ok) {
      workingVoiceId = voiceId;
      const audio = await upstream.arrayBuffer();
      return new Response(audio, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "X-ElevenLabs-Voice-Id": voiceId,
        },
      });
    }

    lastStatus = upstream.status;
    lastDetail = await upstream.text().catch(() => upstream.statusText);

    // 401 = bad key, 429 = out of quota. Neither improves with another voice.
    if (upstream.status === 401 || upstream.status === 429) break;
  }

  return NextResponse.json(
    { error: `ElevenLabs TTS failed: ${lastStatus} ${lastDetail}` },
    { status: lastStatus >= 500 ? 502 : lastStatus }
  );
}
