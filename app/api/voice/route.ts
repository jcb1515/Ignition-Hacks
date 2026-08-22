import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Voice capability flags. The client reads this once on mount to decide
 * whether to use ElevenLabs, browser Web Speech, or typed input.
 */
export async function GET() {
  const configured = Boolean(process.env.ELEVENLABS_API_KEY);
  return NextResponse.json({
    tts: configured,
    stt: configured,
    voiceId: process.env.ELEVENLABS_VOICE_ID ?? "",
    ttsModel: process.env.ELEVENLABS_TTS_MODEL ?? "eleven_flash_v2_5",
  });
}
