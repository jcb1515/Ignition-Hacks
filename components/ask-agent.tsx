"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff, Send, Volume2 } from "lucide-react";

interface Answer { answer: string; source: string; intent: string; suggestions: string[] }

/* Minimal typings for the Web Speech API, which TS doesn't ship. */
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start: () => void; stop: () => void;
};
function getRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/**
 * Ask the agent, by typing or out loud. Speech in and out are the browser's
 * own Web Speech API — nothing to host. Chrome/Safari/Edge support it; the
 * mic button simply doesn't render where it's unavailable.
 */
export default function AskAgent() {
  const [q, setQ] = useState("");
  const [history, setHistory] = useState<Array<{ q: string; a: Answer }>>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const recRef = useRef<Recognition | null>(null);
  const chips = history.at(-1)?.a.suggestions ?? ["Why did you flag Twilio?", "What's our runway?", "What's waiting on me?"];

  // Client-only capability check without a setState-in-effect.
  const canListen = useSyncExternalStore(() => () => {}, () => Boolean(getRecognition()), () => false);

  const submit = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    setQ("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const a: Answer = await res.json();
      setHistory((h) => [...h, { q: question, a }]);
      if (speak && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(a.answer);
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    const rec = getRecognition();
    if (!rec) return;
    rec.lang = "en-US"; rec.interimResults = false; rec.continuous = false;
    rec.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript ?? "";
      setQ(t);
      void submit(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-sans text-[10px] uppercase tracking-[0.12em] text-muted">Ask the agent</p>
        <button
          type="button"
          onClick={() => { setSpeak((s) => !s); if (speak) window.speechSynthesis?.cancel(); }}
          className={`inline-flex items-center gap-1 font-sans text-[10px] uppercase tracking-[0.12em] ${speak ? "text-on-card" : "text-muted"}`}
          title={speak ? "Voice replies on" : "Voice replies off"}
        >
          <Volume2 size={12} /> {speak ? "voice on" : "voice off"}
        </button>
      </div>

      <div className="max-h-64 space-y-3 overflow-y-auto">
        {history.length === 0 && (
          <p className="text-xs text-muted">Ask why something was flagged, what runway looks like, or what&apos;s waiting on you.</p>
        )}
        {history.map((h, i) => (
          <div key={i}>
            <p className="text-xs text-muted">› {h.q}</p>
            <p className="mt-1 text-sm leading-relaxed text-on-card">{h.a.answer}</p>
            <p className="mt-1 font-sans text-[9px] uppercase tracking-[0.1em] text-muted">
              {h.a.source === "rule" ? "from the action log" : h.a.source === "llm" ? "language model, grounded" : "no match"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button key={c} type="button" onClick={() => void submit(c)} disabled={busy}
            className="border border-border-card px-2 py-1 text-[11px] text-muted transition-colors hover:bg-card-3 hover:text-on-card disabled:opacity-50">
            {c}
          </button>
        ))}
      </div>

      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(q); }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} disabled={busy}
          placeholder={listening ? "Listening…" : "Type a question"}
          className="min-w-0 flex-1 border border-border-card bg-card px-3 py-2 text-sm text-on-card placeholder:text-muted focus:outline-none"
        />
        {canListen && (
          <button type="button" onClick={toggleMic} disabled={busy} title="Ask out loud"
            className="border border-border-card px-3 text-on-card transition-colors hover:bg-card-3 disabled:opacity-50"
            style={listening ? { color: "var(--color-series-1)" } : undefined}>
            {listening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        )}
        <button type="submit" disabled={busy || !q.trim()} title="Ask"
          className="border border-border-card px-3 text-on-card transition-colors hover:bg-card-3 disabled:opacity-50">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
