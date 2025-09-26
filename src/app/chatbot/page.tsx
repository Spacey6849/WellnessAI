"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  MessageSquareText,
  Mic,
  RefreshCw,
  Send,
  Paperclip,
  Sparkles,
  // X (removed unused)
} from "lucide-react";

type Mode = "chat" | "speech";

const wellnessSuggestionPool = [
  "Guide me through a 2‑minute breathing exercise.",
  "Help me reframe a stressful thought about work.",
  "Suggest a gentle evening wind‑down routine.",
  "I feel overwhelmed—ask me reflective questions.",
  "Give me a short grounding visualization.",
  "Help me plan a balanced self‑care day.",
  "Provide a positive affirmation based on resilience.",
  "Suggest journal prompts for processing anxiety.",
  "Walk me through a body scan relaxation.",
  "Create a micro‑goal for better sleep tonight.",
  "Help me identify my current emotional triggers.",
  "Give me a 5‑step cognitive defusion mini practice.",
  "Offer a compassionate self‑talk script.",
  "Suggest a movement break I can do at my desk.",
];

interface ChatMessage { id: string; role: "user" | "assistant"; content: string; }
interface Conversation { id: string; title: string; createdAt: number; messages: ChatMessage[]; }

export default function ChatbotPage() {
  const [mode, setMode] = useState<Mode>("chat");
  const [conversations, setConversations] = useState<Conversation[]>(() => [
    { id: crypto.randomUUID(), title: "New Conversation", createdAt: Date.now(), messages: [] },
  ]);
  const [activeId, setActiveId] = useState<string>(() => conversations[0].id);
  const activeConversation = conversations.find((c) => c.id === activeId)!;
  const messages = activeConversation.messages;
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const userName = "Maya"; // could come from auth context later

  // Deterministic initial suggestions (avoid random during SSR hydration)
  useEffect(() => {
    if (suggestions.length === 0) {
      const seedSource = conversations[0]?.id || "seed";
      let hash = 0;
      for (let i = 0; i < seedSource.length; i++) {
        hash = (hash * 31 + seedSource.charCodeAt(i)) >>> 0;
      }
      const pool = [...wellnessSuggestionPool];
      // simple deterministic shuffle using hash
      for (let i = pool.length - 1; i > 0; i--) {
        hash = (hash * 1664525 + 1013904223) >>> 0; // LCG
        const j = hash % (i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      setSuggestions(pool.slice(0, 6));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages]);

  const refreshSuggestions = () => {
    // runtime refresh can be random; it's a client-only action after hydration
    const shuffled = [...wellnessSuggestionPool].sort(() => Math.random() - 0.5);
    setSuggestions(shuffled.slice(0, 6));
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const content = input.trim();
    setConversations((prev) => prev.map((c) => c.id === activeId ? {
      ...c,
      title: c.messages.length === 0 ? content.slice(0, 40) + (content.length > 40 ? "…" : "") : c.title,
      messages: [
        ...c.messages,
        { id: crypto.randomUUID(), role: "user", content },
        { id: crypto.randomUUID(), role: "assistant", content: "(Placeholder response related to wellness)" },
      ],
    } : c));
    setInput("");
  };

  const newConversation = () => {
    const conv: Conversation = { id: crypto.randomUUID(), title: "New Conversation", createdAt: Date.now(), messages: [] };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setInput("");
  };

  const openSuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const toggleRecording = () => {
    setRecording((r) => !r);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] gap-6 pb-20 px-2 sm:px-4">
      {/* Conversation History Sidebar */}
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 flex-shrink-0 flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200 backdrop-blur-xl lg:flex">
        <button
          onClick={newConversation}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-blue-500/20 via-blue-500/10 to-transparent px-4 py-3 text-left font-semibold text-white shadow-[0_8px_30px_-12px_rgba(59,130,246,0.4)] transition hover:border-blue-400/50 hover:from-blue-500/30"
        >
          <MessageSquareText className="h-4 w-4" /> New Chat
        </button>
        <div className="flex-1 overflow-y-auto pr-1">
          <ul className="space-y-2" aria-label="Chat history">
            {conversations.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setActiveId(c.id)}
                    className={`group w-full rounded-2xl border px-3 py-3 text-left text-[13px] transition ${
                      active
                        ? "border-blue-500/60 bg-blue-500/15 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10"
                    }`}
                  >
                    <span className="line-clamp-2 break-words leading-snug">{c.title}</span>
                    <span className="mt-1 block text-[10px] uppercase tracking-[0.3em] text-slate-400">
                      {(() => {
                        const d = new Date(c.createdAt);
                        // Use UTC to ensure SSR/CSR consistency and manual month map
                        const month = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getUTCMonth()];
                        const day = d.getUTCDate();
                        return `${month} ${day}`;
                      })()}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex flex-1 flex-col gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur-xl shadow-xl shadow-indigo-500/10">
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 via-emerald-400 to-indigo-500 p-[2px]">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900 text-white">
                  <Sparkles className="h-8 w-8" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-white">Welcome, {userName}</h1>
              <p className="max-w-xl text-sm text-slate-300">Start by selecting a capability or just ask a question. Switch to speech mode for hands‑free interactions.</p>
            </div>

            {/* Mode Toggle */}
            <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-xs font-semibold" role="tablist" aria-label="Mode selection">
              {(["chat", "speech"] as Mode[]).map((m) => {
                const active = m === mode;
                return (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMode(m)}
                    className={`flex items-center gap-1 rounded-full px-5 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 ${
                      active
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {m === "chat" ? <MessageSquareText className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    <span className="uppercase tracking-[0.25em]">{m}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wellness Suggestion Grid */}
          {messages.length === 0 && mode === "chat" && (
            <div className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">WELLNESS PROMPTS</p>
                <button
                  type="button"
                  onClick={refreshSuggestions}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:border-white/30 hover:bg-white/10"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => openSuggestion(s)}
                    className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-white/25 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/30 to-emerald-500/30 text-white shadow-inner shadow-black/20">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <span className="mt-4 text-sm font-medium text-slate-100 leading-snug">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "speech" && messages.length === 0 && (
            <div className="mt-12 flex flex-col items-center gap-8 text-center">
              <p className="text-sm text-slate-300 max-w-sm">Tap the microphone to start recording your prompt. We&apos;ll transcribe and respond with contextual guidance.</p>
              <div className="flex flex-col items-center gap-6">
                <div className="relative h-48 w-48 overflow-hidden rounded-full border border-white/10 shadow-lg shadow-blue-500/20">
                  <Image
                    src={recording ? "/gifs/talking.gif" : "/gifs/stationary.gif"}
                    alt="AI animated avatar"
                    fill
                    className="object-cover"
                    unoptimized
                    priority
                  />
                </div>
                <button
                  type="button"
                  onClick={toggleRecording}
                  aria-pressed={recording}
                  className={`relative flex h-28 w-28 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 ${
                    recording
                      ? "bg-gradient-to-br from-rose-500 via-orange-500 to-yellow-500 animate-pulse"
                      : "bg-gradient-to-br from-blue-500 via-indigo-500 to-emerald-500"
                  }`}
                >
                  <Mic className="h-10 w-10 text-white drop-shadow" />
                  {recording && <span className="absolute -bottom-6 text-xs uppercase tracking-[0.3em] text-rose-300">LISTENING…</span>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Conversation panel */}
        {messages.length > 0 && (
          <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl">
            <div ref={listRef} className="flex-1 space-y-6 overflow-y-auto px-6 py-8 text-sm">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-relaxed shadow ${
                      m.role === "user"
                        ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                        : "bg-white/5 text-slate-100 border border-white/10"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="sticky bottom-4 mt-auto rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-end gap-3"
            aria-label={mode === "chat" ? "Chat input" : "Speech mode controls"}
          >
            <div className="flex flex-1 flex-col gap-2">
              {mode === "chat" && (
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Write your message …"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"
                />
              )}
              {mode === "speech" && (
                <div className="flex items-center gap-4 rounded-xl border border-white/15 bg-black/30 px-4 py-4 text-sm text-slate-200">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    aria-pressed={recording}
                    className={`flex h-12 w-12 items-center justify-center rounded-full border text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 ${
                      recording ? "border-rose-400 bg-rose-500/30" : "border-white/20 bg-white/10 hover:border-white/35"
                    }`}
                  >
                    <Mic className="h-6 w-6" />
                  </button>
                  <div className="flex flex-1 flex-col">
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{recording ? "Listening" : "Idle"}</p>
                    <p className="text-sm text-slate-200">
                      {recording ? "Speak now…" : "Press the mic to begin recording"}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 px-1 pb-1 text-[11px] uppercase tracking-[0.3em] text-slate-400">
                <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> Attach</span>
                <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> Enhance</span>
              </div>
            </div>
            {mode === "chat" && (
              <button
                type="submit"
                disabled={!input.trim()}
                className={`flex h-12 w-12 items-center justify-center rounded-full text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 ${
                  input.trim()
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow hover:from-blue-500 hover:to-blue-500 active:translate-y-px"
                    : "cursor-not-allowed border border-white/15 bg-white/5 text-slate-400"
                }`}
                aria-label="Send message"
              >
                <Send className="h-5 w-5" />
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

// (SidebarItem removed – old sidebar items deprecated)
