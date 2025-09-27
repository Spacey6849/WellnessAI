import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY is not set" }), { status: 500 });
    }

    const vid = voiceId || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel as default
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${vid}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_flash_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: errText || `TTS failed (${resp.status})` }), { status: 500 });
    }

    const audio = await resp.arrayBuffer();
    return new Response(audio, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch (err: unknown) {
    const e = err as { message?: string } | null;
    console.error("/api/tts error", err);
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), { status: 500 });
  }
}

export const dynamic = "force-dynamic";
