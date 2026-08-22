/**
 * Thin NVIDIA NIM client for the agents.
 *
 * Agents run server-side, so they call NIM directly rather than looping back
 * through /api/nvidia/chat (which stays as-is for browser-side use).
 *
 * Every call site must supply a deterministic fallback. If DEMO_MODE is on, or
 * no key is configured, or the request fails or times out, we use the fallback
 * and carry on. The product must never be one flaky endpoint away from a blank
 * screen in front of a judge.
 */
import { DEMO_MODE } from "@/lib/company";

const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const PRIMARY_MODEL = process.env.NVIDIA_MODEL ?? "deepseek-ai/deepseek-v4-flash-0731";
const BACKUP_MODEL = process.env.NVIDIA_MODEL_BACKUP ?? "google/gemma-4-31b-it";
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 20_000);

export type LlmSource = "llm" | "fallback";

export interface LlmResult {
  text: string;
  source: LlmSource;
  model?: string;
  /** Populated when we fell back because something went wrong. */
  error?: string;
}

function keyFor(which: "primary" | "backup"): string | undefined {
  return which === "primary"
    ? process.env.NVIDIA_API_KEY
    : process.env.NVIDIA_API_KEY_BACKUP ?? process.env.NVIDIA_API_KEY;
}

async function callOnce(
  which: "primary" | "backup",
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
  const apiKey = keyFor(which);
  if (!apiKey) throw new Error(`missing ${which} API key`);
  const model = which === "primary" ? PRIMARY_MODEL : BACKUP_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(NIM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        top_p: 0.95,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`${model} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(`${model} returned no content`);
    }
    // Reasoning models sometimes emit a visible think block; strip it.
    return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generates prose. `fallback` is returned verbatim in demo mode or on any
 * failure, so callers always get usable text.
 */
export async function generate(opts: {
  system: string;
  user: string;
  fallback: string;
  maxTokens?: number;
}): Promise<LlmResult> {
  const { system, user, fallback, maxTokens = 700 } = opts;

  if (DEMO_MODE) return { text: fallback, source: "fallback" };
  if (!keyFor("primary") && !keyFor("backup")) {
    return { text: fallback, source: "fallback", error: "no NVIDIA_API_KEY configured" };
  }

  const errors: string[] = [];
  for (const which of ["primary", "backup"] as const) {
    try {
      const text = await callOnce(which, system, user, maxTokens);
      return { text, source: "llm", model: which === "primary" ? PRIMARY_MODEL : BACKUP_MODEL };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { text: fallback, source: "fallback", error: errors.join(" | ") };
}

/** True when a live call would actually be attempted. Surfaced in the UI banner. */
export function llmAvailable(): boolean {
  return !DEMO_MODE && Boolean(keyFor("primary") || keyFor("backup"));
}
