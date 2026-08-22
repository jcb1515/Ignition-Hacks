import { NextRequest, NextResponse } from "next/server";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const PRIMARY_MODEL = "deepseek-ai/deepseek-v4-flash-0731";
const BACKUP_MODEL = "google/gemma-4-31b-it";

const DEFAULTS = {
  primary: {
    model: PRIMARY_MODEL,
    chat_template_kwargs: { thinking: true, reasoning_effort: "high" },
    apiKeyEnv: "NVIDIA_API_KEY" as const,
  },
  backup: {
    model: BACKUP_MODEL,
    chat_template_kwargs: { enable_thinking: true },
    apiKeyEnv: "NVIDIA_API_KEY_BACKUP" as const,
  },
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const provider = body.provider === "backup" ? "backup" : "primary";
  const config = DEFAULTS[provider];

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    return NextResponse.json(
      { error: `Missing environment variable ${config.apiKeyEnv}` },
      { status: 500 }
    );
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages must be a non-empty array" },
      { status: 400 }
    );
  }

  const model = body.model ?? config.model;
  const temperature = body.temperature ?? 1;
  const top_p = body.top_p ?? 0.95;
  const max_tokens = body.max_tokens ?? 16384;
  const chat_template_kwargs = body.chat_template_kwargs ?? config.chat_template_kwargs;
  const stream = body.stream === true;

  const payload = {
    model,
    messages,
    temperature,
    top_p,
    max_tokens,
    chat_template_kwargs,
    stream,
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  headers["Accept"] = stream ? "text/event-stream" : "application/json";

  try {
    const upstream = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json(
        { error: "NVIDIA API returned an error", detail },
        { status: upstream.status }
      );
    }

    if (stream) {
      if (!upstream.body) {
        return NextResponse.json(
          { error: "No response body for streaming request" },
          { status: 500 }
        );
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Request to NVIDIA API failed", detail: message },
      { status: 500 }
    );
  }
}
