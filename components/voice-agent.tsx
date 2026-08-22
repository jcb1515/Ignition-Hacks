"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Bot, Loader2, Mic, MicOff, Send, Volume2 } from "lucide-react";
import { MagneticButton, PointerPanel } from "@/components/motion";
import type { DataMutation } from "@/components/agent-dashboard";
import { formatCurrency } from "@/lib/types";

interface Answer {
  answer: string;
  source: "rule" | "llm" | "fallback";
  intent: string;
  suggestions?: string[];
}

interface VoiceState {
  audited: boolean;
  config: { demoMode: boolean; approvalThreshold: number };
  company: { name: string };
  drafts: Array<{ id: string; vendorId: string; approved: boolean; sent: boolean }>;
  flags: Array<{ vendorId: string; savings?: number }>;
  forecast: {
    totalMonthlySavings: number;
    scenarios: Array<{ label: string; runwayMonths: number; monthlyBurn: number }>;
  };
}

interface VoiceConfig {
  tts: boolean;
  stt: boolean;
  voiceId: string;
  ttsModel: string;
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & { isFinal?: boolean }
  >;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function hasRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

function getRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function canRecord(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof window !== "undefined" &&
    "MediaRecorder" in window
  );
}

function useIsClient(): boolean {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}

function bestRecorderMimeType(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    MediaRecorder?: { isTypeSupported: (t: string) => boolean };
  };
  if (!w.MediaRecorder) return undefined;
  const options = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of options) {
    if (w.MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

const DEFAULT_SUGGESTIONS = [
  "Run a burn check",
  "What did you find?",
  "What is our runway?",
  "Approve all held drafts",
];

function months(n: number): string {
  return `${n.toFixed(1)} months`;
}

function buildSummary(state: VoiceState | null): string {
  if (!state) return "Dashboard updated.";
  const cur = state.forecast?.scenarios?.[0];
  if (!state.audited || !cur) {
    return `No audit has run yet. Runway is ${months(cur?.runwayMonths ?? 0)} at ${formatCurrency(cur?.monthlyBurn ?? 0)} a month. Say "run a burn check" to start.`;
  }
  const cut = state.forecast.scenarios[1];
  const flags = state.flags?.length ?? 0;
  const savings = state.forecast.totalMonthlySavings ?? 0;
  return `I found ${flags} ${flags === 1 ? "flag" : "flags"} with ${formatCurrency(savings)}/mo in savings. Runway is ${months(cur.runwayMonths)} now, and moves to ${months(cut?.runwayMonths ?? cur.runwayMonths)} if every remediation lands.`;
}

/**
 * Voice copilot for the main dashboard.
 *
 * Speaks and listens through ElevenLabs when an API key is configured; otherwise
 * it falls back to the browser's Web Speech API. All ElevenLabs calls are proxied
 * through `/api/tts` and `/api/stt` so the API key stays server-side.
 */
export default function VoiceAgent({
  onRunAudit,
  onDataChanged,
  running,
}: {
  onRunAudit?: () => Promise<void>;
  onDataChanged?: (reason: DataMutation) => void | Promise<void>;
  running?: boolean;
}) {
  const [transcript, setTranscriptState] = useState("");
  const setTranscript = useCallback((value: string) => {
    transcriptRef.current = value;
    setTranscriptState(value);
  }, []);

  const [messages, setMessages] = useState<
    Array<{ role: "user" | "agent"; text: string; meta?: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [elevenTts, setElevenTts] = useState<boolean | null>(null);
  const [elevenStt, setElevenStt] = useState<boolean | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const recRef = useRef<Recognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingRef = useRef("");
  const transcriptRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ttsWarningShownRef = useRef(false);
  const sttWarningShownRef = useRef(false);

  // Fetch voice capabilities once on mount.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/voice", { cache: "no-store" });
        if (!res.ok) {
          setElevenTts(false);
          setElevenStt(false);
          return;
        }
        const cfg = (await res.json()) as VoiceConfig;
        setElevenTts(cfg.tts);
        setElevenStt(cfg.stt);
      } catch {
        setElevenTts(false);
        setElevenStt(false);
      }
    })();
  }, []);

  const isClient = useIsClient();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, listening, scrollToBottom]);

  const stopAudio = useCallback(() => {
    const audio = audioPlayerRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audioPlayerRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const addMessage = useCallback(
    (role: "user" | "agent", text: string, meta?: string) => {
      setMessages((prev) => {
        const next = [...prev, { role, text, meta }];
        return next.length > 50 ? next.slice(next.length - 50) : next;
      });
    },
    []
  );

  const speak = useCallback(
    async (text: string) => {
      if (!speakEnabled) return;
      stopAudio();

      if (elevenTts !== false) {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text.slice(0, 4000) }),
          });

          if (res.ok) {
            setElevenTts(true);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            audioUrlRef.current = url;
            const audio = new Audio(url);
            audioPlayerRef.current = audio;
            audio.onended = () => stopAudio();
            try {
              await audio.play();
              return;
            } catch {
              stopAudio();
            }
          }

          // 4xx / 503 = not available or misconfigured — fall back to browser speech.
          if (res.status === 503 || (res.status >= 400 && res.status < 500)) {
            setElevenTts(false);
            if (!ttsWarningShownRef.current) {
              ttsWarningShownRef.current = true;
              addMessage(
                "agent",
                "ElevenLabs TTS isn't available with the current voice/key. Using your browser's voice instead. Set ELEVENLABS_VOICE_ID to a non-library voice if you want to use ElevenLabs."
              );
            }
          }
        } catch {
          // Transient failure; one more attempt next time before settling.
        }
      }

      // Web Speech fallback.
      if (canSpeak()) {
        setElevenTts(false);
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05;
        u.pitch = 1;
        window.speechSynthesis.speak(u);
      }
    },
    [addMessage, elevenTts, speakEnabled, stopAudio]
  );

  const stopSpeaking = useCallback(() => {
    stopAudio();
    if (canSpeak()) window.speechSynthesis.cancel();
  }, [stopAudio]);

  const fetchState = useCallback(async (): Promise<VoiceState | null> => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as VoiceState;
    } catch {
      return null;
    }
  }, []);

  const ask = useCallback(async (question: string): Promise<Answer> => {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.slice(0, 500) }),
    });
    const body = (await res.json().catch(() => ({}))) as Partial<Answer>;
    return {
      answer: body.answer ?? "I couldn't reach the agent right now.",
      source: body.source ?? "fallback",
      intent: body.intent ?? "unknown",
      suggestions: body.suggestions,
    };
  }, []);

  const askAndSpeak = useCallback(
    async (question: string) => {
      const a = await ask(question);
      addMessage(
        "agent",
        a.answer,
        a.source === "rule"
          ? "from the action log"
          : a.source === "llm"
            ? "language model, grounded"
            : "no match"
      );
      if (a.suggestions?.length) setSuggestions(a.suggestions);
      speak(a.answer);
    },
    [addMessage, ask, speak]
  );

  const runAuditDirectly = useCallback(async () => {
    const res = await fetch("/api/audit", { method: "POST" });
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const line = chunk.trim();
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6)) as { type?: string; message?: string };
          if (event.type === "status" && event.message) {
            // Final summary is spoken after the stream.
          }
        } catch {
          // Ignore malformed SSE lines.
        }
      }
    }
  }, []);

  const runAuditCommand = useCallback(async () => {
    if (running) {
      addMessage(
        "agent",
        "A burn check is already running. I'll tell you the results when it finishes."
      );
      speak("A burn check is already running.");
      return;
    }
    setBusy(true);
    addMessage("agent", "Running a burn check...");
    speak("Running a burn check.");
    try {
      if (onRunAudit) {
        await onRunAudit();
      } else {
        await runAuditDirectly();
        await onDataChanged?.("audit");
      }
      await askAndSpeak("What did you find?");
    } finally {
      setBusy(false);
    }
  }, [addMessage, askAndSpeak, onDataChanged, onRunAudit, running, runAuditDirectly, speak]);

  const reseedCommand = useCallback(async () => {
    setBusy(true);
    addMessage("agent", "Resetting the demo...");
    speak("Resetting the demo.");
    try {
      await fetch("/api/reset", { method: "POST" });
      await onDataChanged?.("reseed");
      const state = await fetchState();
      const text = state
        ? `Reset complete. ${buildSummary(state)}`
        : "Reset complete.";
      addMessage("agent", text);
      speak(text);
    } finally {
      setBusy(false);
    }
  }, [addMessage, fetchState, onDataChanged, speak]);

  const approveAllCommand = useCallback(async () => {
    setBusy(true);
    addMessage("agent", "Checking held drafts...");
    speak("Checking held drafts.");
    try {
      const state = await fetchState();
      if (!state) {
        addMessage("agent", "I can't reach the dashboard right now.");
        speak("I can't reach the dashboard right now.");
        return;
      }
      const held = state.drafts
        .filter((d) => !d.approved && !d.sent)
        .filter((d) => {
          const flag = state.flags.find((f) => f.vendorId === d.vendorId);
          const savings = flag?.savings ?? 0;
          return savings > state.config.approvalThreshold;
        });

      if (held.length === 0) {
        const text = "No held drafts need your approval right now.";
        addMessage("agent", text);
        speak(text);
        return;
      }

      addMessage(
        "agent",
        `Approving ${held.length} held draft${held.length === 1 ? "" : "s"}...`
      );
      speak(`Approving ${held.length} held draft${held.length === 1 ? "" : "s"}.`);

      let totalSavings = 0;
      for (const d of held) {
        const flag = state.flags.find((f) => f.vendorId === d.vendorId);
        totalSavings += flag?.savings ?? 0;
        await fetch("/api/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId: d.id, decision: "approve" }),
        });
      }

      await onDataChanged?.("decision");
      const text = `Approved ${held.length} held draft${held.length === 1 ? "" : "s"} with ${formatCurrency(totalSavings)}/mo in estimated savings.`;
      addMessage("agent", text);
      speak(text);
    } finally {
      setBusy(false);
    }
  }, [addMessage, fetchState, onDataChanged, speak]);

  const syncCommand = useCallback(async () => {
    setBusy(true);
    addMessage("agent", "Syncing live data...");
    speak("Syncing live data.");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        mode?: string;
        plaid?: { accounts?: number; error?: string };
        stripe?: { subscriptions?: number; error?: string };
      };
      let text: string;
      if (res.status === 409) {
        text = "Sync is only available when demo mode is off. Set DEMO_MODE=false and add Plaid or Stripe sandbox keys.";
      } else if (!res.ok || body.error) {
        text = body.error ?? "Sync failed.";
      } else if (body.mode === "demo" || (!body.plaid && !body.stripe)) {
        text = "Sync is only available when demo mode is off. Set DEMO_MODE=false and add sandbox keys.";
      } else {
        const parts: string[] = [];
        if (body.plaid?.accounts) {
          parts.push(`${body.plaid.accounts} Plaid account${body.plaid.accounts === 1 ? "" : "s"}`);
        }
        if (body.stripe?.subscriptions) {
          parts.push(`${body.stripe.subscriptions} Stripe subscription${body.stripe.subscriptions === 1 ? "" : "s"}`);
        }
        text = parts.length
          ? `Synced ${parts.join(" and ")}.`
          : "Sync complete. No new accounts or subscriptions found.";
      }
      addMessage("agent", text);
      speak(text);
      await onDataChanged?.("decision");
    } finally {
      setBusy(false);
    }
  }, [addMessage, onDataChanged, speak]);

  const handleCommand = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      addMessage("user", text);
      setTranscript("");

      const t = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

      if (/(^|\s)(stop|be quiet|shut up|cancel|hush)(\s|$)/.test(t)) {
        stopSpeaking();
        addMessage("agent", "Okay, I'll stop talking.");
        speak("Okay.");
        return;
      }

      if (/(^|\s)(hello|hi|hey)(\s|$)/.test(t) && t.length < 8) {
        const greeting =
          "Hi. I can run a burn check, answer questions, approve held drafts, or reset the demo.";
        addMessage("agent", greeting);
        speak(greeting);
        return;
      }

      if (/(what can you do|help|commands)/.test(t)) {
        const help =
          "Try: run a burn check, what is our runway, why did you flag Twilio, approve all held drafts, reset the demo, or open the investor update.";
        addMessage("agent", help);
        speak(help);
        return;
      }

      if (/run (a )?(burn check|audit)|do a burn check|start (the )?audit|scan/.test(t)) {
        await runAuditCommand();
        return;
      }

      if (/reseed|reset (the )?(demo|data)|start over/.test(t)) {
        await reseedCommand();
        return;
      }

      if (/approve all|approve everything|sign off( on everything)?/.test(t)) {
        await approveAllCommand();
        return;
      }

      if (/sync|refresh (data|accounts)|connect (bank|stripe)/.test(t)) {
        await syncCommand();
        return;
      }

      if (/investor update|show (the )?investor update|open investor update/.test(t)) {
        if (typeof window !== "undefined") {
          window.open("/investor-update", "_blank");
        }
        const text2 = "Opened the investor update in a new tab.";
        addMessage("agent", text2);
        speak(text2);
        return;
      }

      setBusy(true);
      try {
        await askAndSpeak(text);
      } finally {
        setBusy(false);
      }
    },
    [
      addMessage,
      askAndSpeak,
      approveAllCommand,
      reseedCommand,
      runAuditCommand,
      setTranscript,
      speak,
      stopSpeaking,
      syncCommand,
    ]
  );

  const commandRef = useRef(handleCommand);

  useEffect(() => {
    commandRef.current = handleCommand;
  }, [handleCommand]);

  // ElevenLabs speech-to-text: record with MediaRecorder and post the blob.
  const startRecording = useCallback(async () => {
    if (busy || running) return;
    if (!canRecord()) {
      startWebSpeech();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = bestRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: mimeType ?? "audio/webm",
        });
        uploadForTranscription(blob);
      };

      recorder.onerror = () => {
        stopRecording();
        setElevenStt(false);
        startWebSpeech();
      };

      recorder.start();
      setListening(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      startWebSpeech();
    }
    // startWebSpeech, stopRecording and uploadForTranscription are defined
    // below but their identities are stable; this callback only runs after
    // the whole component has initialized, so the closure is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, running]);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
    setListening(false);
  }, []);

  const uploadForTranscription = useCallback(
    async (blob: Blob) => {
      setListening(false);
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("audio", blob, "audio.webm");
        const res = await fetch("/api/stt", { method: "POST", body: fd });
        if (res.ok) {
          setElevenStt(true);
          const data = (await res.json()) as { text?: string };
          if (data.text?.trim()) {
            commandRef.current(data.text.trim());
          } else {
            addMessage("agent", "I didn't catch that. Could you try again?");
            speak("I didn't catch that. Could you try again?");
          }
          return;
        }
        if (res.status === 503 || (res.status >= 400 && res.status < 500)) {
          setElevenStt(false);
          if (!sttWarningShownRef.current) {
            sttWarningShownRef.current = true;
            addMessage(
              "agent",
              "ElevenLabs STT isn't available with this key. Falling back to browser speech recognition."
            );
          }
        }
        const detail = await res.text().catch(() => "STT failed");
        addMessage("agent", `Transcription failed: ${detail}`);
      } catch {
        setElevenStt(false);
        addMessage("agent", "Transcription service unavailable. Falling back to browser speech.");
      } finally {
        setBusy(false);
      }
    },
    [addMessage, speak]
  );

  // Browser Web Speech fallback.
  const startWebSpeech = useCallback(() => {
    const rec = getRecognition();
    if (!rec) {
      addMessage(
        "agent",
        "Speech input isn't available in this browser. Type your command instead."
      );
      return;
    }

    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;

    pendingRef.current = "";
    setTranscript("");

    rec.onresult = (e) => {
      let final = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const phrase = result[0]?.transcript ?? "";
        if ("isFinal" in result && result.isFinal) {
          final += phrase;
        } else {
          interim += phrase;
        }
      }
      pendingRef.current = final;
      setTranscript(final + interim);
    };

    rec.onend = () => {
      setListening(false);
      const said = pendingRef.current.trim() || transcriptRef.current.trim();
      if (said) {
        commandRef.current(said);
      }
    };

    rec.onerror = () => {
      setListening(false);
    };

    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [addMessage, setTranscript]);

  const toggleListen = useCallback(() => {
    if (listening) {
      stopRecording();
      recRef.current?.stop();
      return;
    }
    if (busy || running) return;

    if (elevenStt !== false && canRecord()) {
      startRecording();
    } else if (hasRecognition()) {
      startWebSpeech();
    } else {
      addMessage(
        "agent",
        "Speech input isn't available. Type your command instead."
      );
    }
  }, [addMessage, busy, elevenStt, listening, running, startRecording, startWebSpeech, stopRecording]);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      stopAudio();
      stopRecording();
      try {
        recRef.current?.stop();
      } catch {
        // Already stopped.
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [stopAudio, stopRecording]);

  const inputDisabled = busy || listening || running;
  const isProcessing = busy || running;

  const transcriptLines = useMemo(
    () =>
      messages.map((m, i) => (
        <div
          key={i}
          className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
        >
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              m.role === "agent" ? "bg-azure/10 text-azure" : "bg-card-3 text-on-card"
            }`}
          >
            {m.role === "agent" ? <Bot size={12} /> : <Mic size={12} />}
          </div>
          <div className="max-w-[85%]">
            <p
              className={`text-sm leading-relaxed ${
                m.role === "agent" ? "text-on-card" : "text-muted"
              }`}
            >
              {m.text}
            </p>
            {m.meta ? (
              <p className="mt-0.5 font-sans text-[9px] uppercase tracking-[0.1em] text-muted">
                {m.meta}
              </p>
            ) : null}
          </div>
        </div>
      )),
    [messages]
  );

  const statusNote = useMemo(() => {
    if (!isClient) return "";
    if (canRecord() || hasRecognition() || canSpeak()) return "";
    return "Speech isn't supported in this browser. Type your command instead.";
  }, [isClient]);

  return (
    <PointerPanel className="min-w-0 border border-border-card bg-card p-4 text-on-card sm:p-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            Voice copilot
          </p>
          <h3 className="mt-1 font-display text-2xl tracking-[-0.04em]">
            Talk to the agents
          </h3>
        </div>
        <button
          type="button"
          onClick={() => {
            setSpeakEnabled((s) => {
              const next = !s;
              if (!next) stopSpeaking();
              return next;
            });
          }}
          className={`inline-flex items-center gap-1.5 font-sans text-[10px] font-medium uppercase tracking-[0.12em] transition-colors ${
            speakEnabled ? "text-on-card" : "text-muted"
          }`}
          title={speakEnabled ? "Voice replies on" : "Voice replies off"}
        >
          <Volume2 size={12} />
          {speakEnabled ? "voice on" : "voice off"}
        </button>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_220px]">
        <div className="flex h-[300px] min-w-0 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
            {messages.length === 0 && !listening && (
              <p className="text-sm leading-relaxed text-muted">
                Tap the microphone and say something like &ldquo;Run a burn
                check&rdquo; or &ldquo;What did you flag?&rdquo; The agents will
                answer out loud.
              </p>
            )}
            {transcriptLines}
            {listening && (
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-azure/10 text-azure">
                  <Mic size={12} />
                </div>
                <p className="text-sm text-azure animate-pulse">
                  {elevenStt !== false
                    ? recordingSeconds > 0
                      ? `Recording ${recordingSeconds}s…`
                      : "Listening…"
                    : transcript || "Listening…"}
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {suggestions.length > 0 && !busy && !running && (
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleCommand(s)}
                  disabled={inputDisabled}
                  className="rounded-full border border-border-card bg-card-2 px-3 py-1.5 text-[11px] text-muted transition-colors hover:bg-card-3 hover:text-on-card disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (transcript.trim()) {
                handleCommand(transcript.trim());
              }
            }}
          >
            <input
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={inputDisabled}
              placeholder={
                listening
                  ? "Listening…"
                  : running
                    ? "Audit running…"
                    : busy
                      ? "Agent is working…"
                      : "Type a command or question"
              }
              className="min-w-0 flex-1 rounded-lg border border-border-card bg-card-2 px-3 py-2.5 text-sm text-on-card placeholder:text-muted focus:outline-none focus:border-azure disabled:opacity-60"
            />
            <MagneticButton
              type="button"
              onClick={toggleListen}
              disabled={busy || running}
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
                listening
                  ? "border-red bg-red/10 text-red"
                  : "border-border-card bg-card-2 text-on-card hover:border-azure hover:bg-azure hover:text-white"
              }`}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
              {listening && (
                <span className="absolute inset-0 rounded-full border border-red opacity-50 ping-ring" />
              )}
            </MagneticButton>
            <MagneticButton
              type="submit"
              disabled={inputDisabled || !transcript.trim()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-card bg-card-2 text-on-card transition-colors hover:border-azure hover:bg-azure hover:text-white disabled:opacity-50"
            >
              <Send size={16} />
            </MagneticButton>
          </form>
        </div>

        <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-border-card bg-card-2 p-5">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-3 text-azure">
              <Loader2 size={32} className="animate-spin" />
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.12em]">
                Agent working
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <MagneticButton
                type="button"
                onClick={toggleListen}
                disabled={busy || running}
                className={`relative inline-flex h-20 w-20 items-center justify-center rounded-full border-2 text-2xl transition-all disabled:opacity-50 ${
                  listening
                    ? "border-red text-red hover:bg-red/10"
                    : "border-azure bg-azure text-white hover:bg-sky hover:border-sky"
                }`}
              >
                {listening ? <MicOff size={28} /> : <Mic size={28} />}
                {listening && (
                  <span className="absolute inset-[-8px] rounded-full border border-red opacity-40 ping-ring" />
                )}
              </MagneticButton>
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                {listening ? "Tap to stop" : "Tap to speak"}
              </p>
            </div>
          )}

          {statusNote ? (
            <div className="mt-6 text-center">
              <p className="max-w-[180px] text-xs leading-relaxed text-muted">
                {statusNote}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </PointerPanel>
  );
}
