"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  MessageSquareText,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import talkingGif from "../../../gifs/talking.gif";
import stationaryGif from "../../../gifs/stationary.gif";

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
interface Conversation { id: string; title: string; createdAt: number; messages: ChatMessage[]; hasLoaded?: boolean; }

// Minimal Web Speech API typings to eliminate `any` usage
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
  length: number;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | undefined {
  const w = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

function createAudioContext(): AudioContext {
  const w = window as Window & { webkitAudioContext?: typeof AudioContext; AudioContext?: typeof AudioContext };
  const Ctor = (w.AudioContext ?? w.webkitAudioContext);
  if (!Ctor) throw new Error('AudioContext not supported');
  return new Ctor();
}

export default function ChatbotPage() {
  const [mode, setMode] = useState<Mode>("chat");
  const [sttEngine] = useState<"browser" | "agent">("browser"); // default to browser STT
  // We'll fetch existing sessions from the API; if none exist we'll create one.
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0];
  const messages = useMemo(() => activeConversation?.messages || [], [activeConversation]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [micLevel, setMicLevel] = useState(0); // 0..1 input loudness for visualization
  const [agentStatus, setAgentStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const levelRef = useRef(0);
  const lastLevelTsRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const agentStatusRef = useRef(agentStatus);
  useEffect(() => { agentStatusRef.current = agentStatus; }, [agentStatus]);
  const finalizeLockRef = useRef(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const outAudioCtxRef = useRef<AudioContext | null>(null); // agent playback context, if used
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [speakingProgress, setSpeakingProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const usingBrowserTTSRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const userName = "Maya"; // could come from auth context later
  const userId = "demo-user"; // TEMP: until real auth, used for Authorization header (maps to RLS user_id)

  // Load sessions on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/chat/sessions', { headers: { Authorization: `Bearer ${userId}` } });
        if (!res.ok) throw new Error('Failed to load sessions');
        const json = await res.json();
        const sessions: { id: string; title: string; created_at: string; updated_at: string }[] = json.sessions || [];
        if (cancelled) return;
        if (sessions.length === 0) {
          // Create an initial session
            const create = await fetch('/api/chat/sessions', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${userId}` }, body: JSON.stringify({ title: 'New Conversation' }) });
            const created = await create.json();
            if (create.ok && created.session) {
              setConversations([{ id: created.session.id, title: created.session.title, createdAt: Date.parse(created.session.created_at), messages: [], hasLoaded: true }]);
              setActiveId(created.session.id);
            }
            return;
        }
        const mapped: Conversation[] = sessions.map(s => ({ id: s.id, title: s.title || 'Untitled', createdAt: Date.parse(s.created_at), messages: [], hasLoaded: false }));
        setConversations(mapped);
        setActiveId(prev => prev || mapped[0]?.id || "");
      } catch (e) { console.error(e); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Load messages lazily when a conversation becomes active and hasn't been loaded yet
  useEffect(() => {
    const conv = conversations.find(c => c.id === activeId);
    if (!conv || conv.hasLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/messages?session_id=${encodeURIComponent(activeId)}`, { headers: { Authorization: `Bearer ${userId}` } });
        if (!res.ok) throw new Error('Failed to load messages');
        const json = await res.json();
        const msgs: { id: string; role: string; content: string; created_at: string }[] = json.messages || [];
        if (cancelled) return;
        setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages: msgs.map(m => ({ id: m.id, role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })), hasLoaded: true } : c));
      } catch (e) { console.error(e); }
    })();
    return () => { cancelled = true; };
  }, [activeId, conversations]);

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

  const sendMessage = async () => {
    if (!input.trim()) return;
    const content = input.trim();
    if (!activeId) return; // still loading

    // Optimistically add user message
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    setConversations((prev) => prev.map((c) => c.id === activeId ? {
      ...c,
      title: c.messages.length === 0 ? content.slice(0, 40) + (content.length > 40 ? "…" : "") : c.title,
      messages: [...c.messages, userMsg],
    } : c));
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });
      const data = await res.json();
      const aiText = data?.content || "Sorry, I couldn't generate a response.";

      // Append assistant message
      setConversations((prev) => prev.map((c) => c.id === activeId ? {
        ...c,
        messages: [...c.messages, { id: crypto.randomUUID(), role: "assistant", content: aiText }],
      } : c));

      // Persist both user and assistant messages (fire-and-forget)
      (async () => {
        try {
          await fetch('/api/chat/messages', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${userId}` }, body: JSON.stringify({ session_id: activeId, role: 'user', content }) });
          await fetch('/api/chat/messages', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${userId}` }, body: JSON.stringify({ session_id: activeId, role: 'assistant', content: aiText }) });
        } catch (e) { console.error('Persist fail', e); }
      })();

      // If in speech mode, speak it
      if (mode === "speech") {
        try {
          const tts = await fetch("/api/tts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text: aiText }),
          });
          if (tts.ok) {
            const buf = await tts.arrayBuffer();
            const blob = new Blob([buf], { type: "audio/mpeg" });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.play().catch(() => {});
          }
        } catch {}
      }
    } catch (e) {
      console.error(e);
      setConversations((prev) => prev.map((c) => c.id === activeId ? {
        ...c,
        messages: [...c.messages, { id: crypto.randomUUID(), role: "assistant", content: "I'm having trouble right now. Please try again." }],
      } : c));
    }
  };

  const newConversation = async () => {
    try {
      const res = await fetch('/api/chat/sessions', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${userId}` }, body: JSON.stringify({ title: 'New Conversation' }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create');
      const conv: Conversation = { id: json.session.id, title: json.session.title, createdAt: Date.parse(json.session.created_at), messages: [], hasLoaded: true };
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setInput("");
    } catch (e) {
      console.error(e);
    }
  };

  const openSuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  // Speech capture: prefer Browser STT. Agent WS path only when selected.
  useEffect(() => {
    const start = async () => {
      if (!recording || mode !== "speech") return;
  if (sttEngine === 'browser') {
        // Browser STT via Web Speech API
        setStreamingText("");
        setAgentStatus('connecting');
        const SR = getSpeechRecognitionCtor();
        if (!SR) {
          console.warn('Web Speech API not available');
          setAgentStatus('error');
          return;
        }
  // Avoid duplicate instances (StrictMode / rapid toggles)
  try { recognitionRef.current?.stop?.(); } catch {}
  const rec = new SR();
  recognitionRef.current = rec;
        rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true;
        let finalText = '';
        rec.onstart = () => setAgentStatus('connected');
        rec.onresult = (ev) => {
          let interim = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const res = ev.results[i];
            if (res.isFinal) finalText += res[0].transcript;
            else interim += res[0].transcript;
          }
          const combined = (finalText + (interim ? ' ' + interim : '')).trim();
          setStreamingText(combined);
        };
        rec.onerror = (e) => { console.error('STT error', e); setAgentStatus('error'); };
        rec.onend = () => { /* will finalize on toggle */ };
        try { rec.start(); } catch {}

        // Optional: simple mic level via getUserMedia for animation
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
          mediaStreamRef.current = stream;
          const capAudioCtx = createAudioContext();
          audioCtxRef.current = capAudioCtx;
          const source = capAudioCtx.createMediaStreamSource(stream);
          sourceNodeRef.current = source;
          const processor = capAudioCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;
          processor.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            let sum = 0; for (let i = 0; i < input.length; i++) { const s = input[i]; sum += s * s; }
            const rms = Math.sqrt(sum / input.length);
            const norm = Math.min(1, rms * 3);
            const smooth = levelRef.current * 0.8 + norm * 0.2;
            levelRef.current = smooth;
            const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            if (now - lastLevelTsRef.current > 60) { setMicLevel(smooth); lastLevelTsRef.current = now; }
          };
          source.connect(processor); processor.connect(capAudioCtx.destination);
        } catch { /* ignore mic anim if denied */ }
        return;
      }
      // Agent WS path
      try {
        setStreamingText("");
        setAgentStatus("connecting");
        // Start proxy WS
        const params = new URLSearchParams();
        // Prefer client-exposed var, but fall back to server var if necessary (agent id is not secret)
  const agentId = process.env.NEXT_PUBLIC_ELEVEN_AGENT_ID || process.env.ELEVENLABS_AGENT_ID || "";
        if (!agentId) {
          console.warn('NEXT_PUBLIC_ELEVEN_AGENT_ID not set; speech will only use TTS on send.');
          setAgentStatus("error");
          return;
        }
        params.set("agent_id", agentId);
  const port = process.env.NEXT_PUBLIC_AGENT_PROXY_PORT || "8787";
        const ws = new WebSocket(`ws://localhost:${port}?${params.toString()}`);
        wsRef.current = ws;

  // Setup audio playback for agent audio events
  const outAudioCtx = createAudioContext();
  outAudioCtxRef.current = outAudioCtx;
  const playPcm = async (base64: string) => {
          // Server sends base64 PCM 16k mono; convert to WAV for quick playback using WebAudio decode
          const pcm = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
          // Wrap PCM in a minimal WAV header (16-bit, mono, 16k)
          const sampleRate = 16000;
          const numChannels = 1;
          const bytesPerSample = 2;
          const wavHeader = new ArrayBuffer(44);
          const dv = new DataView(wavHeader);
          const writeStr = (off: number, s: string) => { for (let i=0;i<s.length;i++) dv.setUint8(off+i, s.charCodeAt(i)); };
          const dataLen = (pcm as ArrayBuffer).byteLength;
          writeStr(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
          dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, numChannels, true);
          dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
          dv.setUint16(32, numChannels * bytesPerSample, true); dv.setUint16(34, 16, true); writeStr(36, 'data');
          dv.setUint32(40, dataLen, true);
          const wav = new Uint8Array(44 + dataLen); wav.set(new Uint8Array(wavHeader), 0); wav.set(new Uint8Array(pcm), 44);
          try { if (outAudioCtx.state === 'suspended') await outAudioCtx.resume(); } catch {}
          const buf = await outAudioCtx.decodeAudioData(wav.buffer.slice(0));
          const src = outAudioCtx.createBufferSource(); src.buffer = buf; src.connect(outAudioCtx.destination); src.start();
        };

        ws.addEventListener('message', (e) => {
          try {
            const msg = JSON.parse(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data));
            if (msg?.type === 'user_transcript' || msg?.type === 'user_transcription') {
              const t = msg.user_transcription_event?.user_transcript || msg.user_transcript;
              if (t) setStreamingText((prev) => (prev ? prev + "\n" : "") + t);
            } else if (msg?.type === 'agent_response' || msg?.type === 'response') {
              const t = msg.agent_response_event?.agent_response || msg.response;
              if (t) setStreamingText((prev) => (prev ? prev + "\n" : "") + t);
            } else if (msg?.type === 'audio') {
              const evt = msg.audio_event || {};
              const b64 = evt.audio_base_64 || evt.audio_base64;
              if (b64) playPcm(b64);
            } else if (msg?.type === 'upstream_closed') {
              console.warn('Upstream closed', msg.code, msg.reason);
              setAgentStatus('error');
            } else if (msg?.type === 'upstream_error') {
              console.error('Upstream error', msg.message);
              setAgentStatus('error');
            } else {
              // console.debug('Agent event', msg?.type, msg);
            }
          } catch {}
        });

        ws.addEventListener('open', () => {
          setAgentStatus("connected");
          // Send conversation init (optional overrides)
          ws.send(JSON.stringify({
            type: 'conversation_initiation_client_data',
            conversation_config_overrides: {
              agent: { language: 'en' },
            },
          }));
          // Notify agent we are starting to speak
          ws.send(JSON.stringify({ type: 'user_started_speaking' }));
        });
        ws.addEventListener('error', (err) => {
          console.error('Agent WS error', err);
          setAgentStatus("error");
        });
        ws.addEventListener('close', (ev) => {
          console.log('Agent WS closed', ev?.code, ev?.reason || '');
          if (agentStatusRef.current !== 'error') setAgentStatus('idle');
        });

        // Capture mic and stream PCM16 @16kHz
  let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        } catch (err) {
          console.error('Microphone permission/error', err);
          setAgentStatus('error');
          return;
        }
        mediaStreamRef.current = stream;
  const capAudioCtx = createAudioContext();
  audioCtxRef.current = capAudioCtx;
  const source = capAudioCtx.createMediaStreamSource(stream);
        sourceNodeRef.current = source;
  const processor = capAudioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        const toPCM16Base64 = (float32: Float32Array, sampleRate: number) => {
          // Resample to 16000 Hz (linear interpolation)
          const targetRate = 16000;
          const ratio = sampleRate / targetRate;
          const newLength = Math.floor(float32.length / ratio);
          const resampled = new Float32Array(newLength);
          for (let i = 0; i < newLength; i++) {
            const idx = i * ratio;
            const i0 = Math.floor(idx);
            const i1 = Math.min(i0 + 1, float32.length - 1);
            const frac = idx - i0;
            resampled[i] = float32[i0] * (1 - frac) + float32[i1] * frac;
          }
          // Convert to PCM16
          const pcm16 = new Int16Array(resampled.length);
          for (let i = 0; i < resampled.length; i++) {
            const s = Math.max(-1, Math.min(1, resampled[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          const bytes = new Uint8Array(pcm16.buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          return btoa(binary);
        };

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          // Compute smoothed RMS level for visualization
          let sum = 0;
          for (let i = 0; i < input.length; i++) { const s = input[i]; sum += s * s; }
          const rms = Math.sqrt(sum / input.length);
          const norm = Math.min(1, rms * 3); // amplify typical mic levels
          const smooth = levelRef.current * 0.8 + norm * 0.2;
          levelRef.current = smooth;
          const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          if (now - lastLevelTsRef.current > 60) { setMicLevel(smooth); lastLevelTsRef.current = now; }
          const b64 = toPCM16Base64(input, capAudioCtx.sampleRate);
          // Send as ElevenLabs expects (base64 PCM chunk)
          ws.send(JSON.stringify({ type: 'user_audio_chunk', audio: b64 }));
        };

        source.connect(processor);
        processor.connect(capAudioCtx.destination);
      } catch (err) {
        console.error('Agent start error', err);
      }
    };

    const stop = () => {
      try { processorRef.current?.disconnect(); } catch {}
      try { sourceNodeRef.current?.disconnect(); } catch {}
      try { audioCtxRef.current?.close(); } catch {}
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      processorRef.current = null;
      sourceNodeRef.current = null;
      audioCtxRef.current = null;
      mediaStreamRef.current = null;
      if (sttEngine === 'browser') {
        try { recognitionRef.current?.stop?.(); } catch {}
        try { recognitionRef.current?.abort?.(); } catch {}
        recognitionRef.current = null;
      } else {
        try {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'user_stopped_speaking' }));
          }
        } catch {}
        wsRef.current?.close();
        wsRef.current = null;
      }
      levelRef.current = 0; setMicLevel(0);
      setAgentStatus('idle');
    };

    if (recording && mode === 'speech') start(); else stop();
    return () => stop();
  }, [recording, mode, sttEngine, agentStatus]);

  // Commit recognized speech as a user message, ask Gemini, then speak via TTS
  const finalizeStreaming = async () => {
    if (finalizeLockRef.current) return;
    finalizeLockRef.current = true;
    const text = streamingText.trim();
    if (!text) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    setStreamingText("");
    setConversations((prev) => prev.map((c) => c.id === activeId ? {
      ...c,
      title: c.messages.length === 0 ? text.slice(0, 40) + (text.length > 40 ? "…" : "") : c.title,
      messages: [...c.messages, userMsg],
    } : c));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });
      const data = await res.json();
      const aiText = data?.content || "Sorry, I couldn't generate a response.";
      const assistantId = crypto.randomUUID();
      setConversations((prev) => prev.map((c) => c.id === activeId ? {
        ...c,
        messages: [...c.messages, { id: assistantId, role: "assistant", content: aiText }],
      } : c));
      // Persist messages
      (async () => {
        try {
          if (activeId) {
            await fetch('/api/chat/messages', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${userId}` }, body: JSON.stringify({ session_id: activeId, role: 'user', content: text }) });
            await fetch('/api/chat/messages', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${userId}` }, body: JSON.stringify({ session_id: activeId, role: 'assistant', content: aiText }) });
          }
        } catch (e) { console.error('Persist fail', e); }
      })();
      await playTTSAndTrack(aiText, assistantId);
    } catch (e) {
      console.error(e);
      setConversations((prev) => prev.map((c) => c.id === activeId ? {
        ...c,
        messages: [...c.messages, { id: crypto.randomUUID(), role: "assistant", content: "I'm having trouble right now. Please try again." }],
      } : c));
    }
    finalizeLockRef.current = false;
  };

  const stopSpeaking = () => {
    try {
      if (ttsAudioRef.current) {
        const a = ttsAudioRef.current;
        try { a.pause(); } catch {}
        try { a.currentTime = 0; } catch {}
        try { a.removeAttribute('src'); a.load(); } catch {}
      }
    } catch {}
    try { if (outAudioCtxRef.current && outAudioCtxRef.current.state === 'running') { outAudioCtxRef.current.suspend(); } } catch {}
  try { if (usingBrowserTTSRef.current) { window.speechSynthesis.cancel(); } } catch {}
  usingBrowserTTSRef.current = false;
  utteranceRef.current = null;
  ttsAudioRef.current = null;
    setIsSpeaking(false);
    setIsPaused(false);
    setSpeakingMsgId(null);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  const togglePauseResume = async () => {
    const audio = ttsAudioRef.current;
    if (audio) {
      if (!audio.paused && !audio.ended) {
        audio.pause();
        setIsPaused(true);
        return;
      }
      if (audio.paused && !audio.ended) {
        try { await audio.play(); setIsPaused(false); setIsSpeaking(true); } catch {}
        return;
      }
    }
    // Agent audio context handling (if used)
    const ctx = outAudioCtxRef.current;
    if (ctx) {
      if (ctx.state === 'running') { try { await ctx.suspend(); setIsPaused(true); } catch {} }
      else if (ctx.state === 'suspended') { try { await ctx.resume(); setIsPaused(false); setIsSpeaking(true); } catch {} }
    }
    // Browser TTS pause/resume
    if (usingBrowserTTSRef.current) {
      try {
        if (!window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          setIsPaused(true);
        } else {
          window.speechSynthesis.resume();
          setIsPaused(false);
          setIsSpeaking(true);
        }
      } catch {}
    }
  };

  // Helper: play TTS and track which assistant message is being spoken
  const playTTSAndTrack = async (text: string, assistantId: string) => {
    try {
      const tts = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!tts.ok) {
        try { const e = await tts.json(); console.error('/api/tts failed', e); } catch {}
        return await speakWithBrowserTTS(text, assistantId);
      }
      const buf = await tts.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      try { ttsAudioRef.current?.pause(); } catch {}
      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      usingBrowserTTSRef.current = false;
      setSpeakingMsgId(assistantId);
      setSpeakingProgress(0);
      const update = () => {
        if (!audio.duration || Number.isNaN(audio.duration)) {
          rafRef.current = requestAnimationFrame(update);
          return;
        }
        const p = Math.max(0, Math.min(1, audio.currentTime / audio.duration));
        setSpeakingProgress(p);
        if (!audio.paused && !audio.ended) {
          rafRef.current = requestAnimationFrame(update);
        }
      };
      audio.onplay = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(update);
      };
      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setSpeakingMsgId(null);
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        ttsAudioRef.current = null;
      };
      audio.onpause = () => {
        setIsSpeaking(false);
        setIsPaused(true);
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      };
      await audio.play().catch(async () => {
        // If autoplay fails or playback error, fallback to browser TTS
        await speakWithBrowserTTS(text, assistantId);
      });
    } catch {}
  };

  // Browser TTS fallback with progress via boundary events
  const speakWithBrowserTTS = async (text: string, assistantId: string) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      usingBrowserTTSRef.current = true;
      const u = new SpeechSynthesisUtterance(text);
      utteranceRef.current = u;
      u.lang = 'en-US';
      u.rate = 1; u.pitch = 1; u.volume = 1;
      setSpeakingMsgId(assistantId);
      setSpeakingProgress(0);
      u.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
      u.onboundary = (e: SpeechSynthesisEvent) => {
        const idx = e.charIndex;
        if (typeof idx === 'number') {
          const p = Math.max(0, Math.min(1, idx / Math.max(1, text.length)));
          setSpeakingProgress(p);
        }
      };
      u.onend = () => {
        setIsSpeaking(false); setIsPaused(false); setSpeakingMsgId(null);
      };
      try { synth.cancel(); } catch {}
      synth.speak(u);
    } catch {}
  };

  const toggleRecording = () => {
    setRecording((r) => {
      if (r) {
        // stopping (finalize text area only for now)
        finalizeStreaming();
        return false;
      }
      return true;
    });
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
                    className={`relative flex items-center gap-1 rounded-full px-5 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 ${
                      active
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {m === "speech" && recording && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-full"
                        style={{
                          boxShadow: `0 0 0 ${2 + micLevel * 10}px rgba(59,130,246,${0.15 + micLevel * 0.35})`,
                          transition: "box-shadow 80ms linear",
                        }}
                      />
                    )}
                    {m === "chat" ? <MessageSquareText className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    <span className="uppercase tracking-[0.25em]">{m}</span>
                  </button>
                );
              })}
            </div>
            {/* STT Engine (hidden by default, switchable if needed) */}
            {/*
            <div className="mt-2 text-xs text-slate-400">
              STT Engine:
              <button className={`ml-2 px-2 py-1 rounded ${sttEngine==='browser'?'bg-blue-600 text-white':'bg-white/10'}`} onClick={() => setSttEngine('browser')}>Browser</button>
              <button className={`ml-2 px-2 py-1 rounded ${sttEngine==='agent'?'bg-blue-600 text-white':'bg-white/10'}`} onClick={() => setSttEngine('agent')}>Agent</button>
            </div>
            */}
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
            <div className="mt-12 hidden" aria-hidden>
              {/* Old speech hero replaced by new two-column layout below */}
            </div>
          )}
        </div>

        {/* Unified panel area for chat/speech */}
        <div className="flex flex-1 gap-6">
          {/* Left column (speech avatar when in speech mode) */}
          {mode === "speech" && (
            <div className="relative flex w-72 flex-col items-center justify-start rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="relative h-56 w-56 overflow-hidden rounded-full border border-white/10 shadow-lg shadow-blue-500/20">
                <Image
                  src={recording ? talkingGif : stationaryGif}
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
                className={`mt-8 relative flex h-20 w-20 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 ${
                  recording
                    ? "bg-gradient-to-br from-rose-500 via-orange-500 to-yellow-500 animate-pulse"
                    : "bg-gradient-to-br from-blue-500 via-indigo-500 to-emerald-500"
                }`}
              >
                {recording && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      boxShadow: `0 0 0 ${4 + micLevel * 14}px rgba(59,130,246,${0.2 + micLevel * 0.5})`,
                      transition: "box-shadow 60ms linear",
                    }}
                  />
                )}
                <Mic className="h-8 w-8 text-white drop-shadow" />
                {recording && <span className="absolute -bottom-6 text-[10px] uppercase tracking-[0.3em] text-rose-300">LISTENING…</span>}
              </button>
              {(isSpeaking || isPaused) && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePauseResume}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:border-white/30 hover:bg-white/10"
                  >
                    {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:border-white/30 hover:bg-white/10"
                  >
                    <Pause className="h-3.5 w-3.5" /> Stop
                  </button>
                </div>
              )}
              <p className="mt-3 text-[11px] tracking-widest uppercase text-slate-400">
                {agentStatus === 'connecting' && 'Connecting…'}
                {agentStatus === 'connected' && (recording ? 'Listening' : 'Ready')}
                {agentStatus === 'error' && 'Connection or Mic error'}
                {agentStatus === 'idle' && !recording && 'Idle'}
              </p>
              {recording && (
                <div className="mt-6 flex h-6 items-end justify-center gap-1">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const k = (i + 1) / 8;
                    const h = Math.max(2, Math.round(micLevel * (0.4 + 0.6 * k) * 24));
                    return <span key={i} className="w-1 rounded-sm bg-blue-400/80" style={{ height: h }} />;
                  })}
                </div>
              )}
              {streamingText && (
                <p className="mt-10 w-full whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-slate-200">
                  {streamingText}
                </p>
              )}
            </div>
          )}

          {/* Right column (messages) */}
          <div className="flex min-h-[400px] flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl">
            <div ref={listRef} className="flex-1 space-y-6 overflow-y-auto px-6 py-8 text-sm">
              {messages.length === 0 && mode === "speech" && !streamingText && (
                <p className="text-center text-sm text-slate-400">Your transcribed guidance will appear here.</p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-relaxed shadow ${
                      m.role === "user"
                        ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                        : "bg-white/5 text-slate-100 border border-white/10"
                    }`}
                  >
                    {speakingMsgId === m.id && (isSpeaking || isPaused) ? (
                      (() => {
                        const total = m.content.length || 1;
                        const cut = Math.max(1, Math.floor(total * speakingProgress));
                        const spoken = m.content.slice(0, cut);
                        const remain = m.content.slice(cut);
                        return (
                          <span>
                            <span className="bg-gradient-to-r from-emerald-400/40 to-blue-400/20 rounded-sm">
                              {spoken}
                            </span>
                            <span className="opacity-70">{remain}</span>
                          </span>
                        );
                      })()
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
              {mode === "speech" && streamingText && (
                <div className="flex justify-end">
                  <div className="max-w-[70%] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-relaxed shadow bg-gradient-to-r from-blue-600 to-blue-500 text-white">
                    {streamingText}
                    <span className="animate-pulse ml-1">…</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

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
                <div className="flex flex-col gap-3 rounded-xl border border-white/15 bg-black/30 px-4 py-4 text-sm text-slate-200">
                  <div className="flex items-center gap-4">
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
                    {(isSpeaking || isPaused) && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={togglePauseResume}
                          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:border-white/30 hover:bg-white/10"
                        >
                          {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                          {isPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          type="button"
                          onClick={stopSpeaking}
                          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:border-white/30 hover:bg-white/10"
                        >
                          <Pause className="h-3.5 w-3.5" /> Stop
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Optional typed input while in Speech mode */}
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Or type a message to get a spoken reply…"
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"
                  />
                </div>
              )}
              {/* Accessory controls removed per request (Attach / Enhance) */}
            </div>
            {(mode === "chat" || (mode === "speech" && input.trim())) && (
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
