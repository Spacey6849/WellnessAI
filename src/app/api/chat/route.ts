import { NextRequest } from "next/server";
import { buildTherapistPrompt } from "@/lib/ai/systemPrompt";

// Minimal interfaces describing only what we use from the Gemini SDK so we avoid `any`.
interface GeminiGenerateContentResponse { response: { text(): string } }
interface GeminiGenerativeModel { generateContent(input: { contents: Array<{ role: string; parts: { text: string }[] }> }): Promise<GeminiGenerateContentResponse>; }
interface GeminiClient { getGenerativeModel(opts: { model: string; systemInstruction?: string }): GeminiGenerativeModel; }

// Use dynamic import so the SDK is included only on the server. We keep a cached instance.
let genAI: GeminiClient | undefined;
async function getGemini(): Promise<GeminiClient> {
  if (!genAI) {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    genAI = new GoogleGenerativeAI(apiKey) as unknown as GeminiClient; // Cast to minimal surface we defined
  }
  return genAI;
}

interface IncomingMessage { role: string; content: string }

export async function POST(req: NextRequest) {
  try {
    const { messages } = (await req.json()) as { messages: unknown };
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), { status: 400 });
    }

  // System instruction externalized for maintainability & versioning (see `src/lib/ai/systemPrompt.ts`).
  const systemPreamble = buildTherapistPrompt();

    const gen = await getGemini();
    const envModel = process.env.GEMINI_MODEL?.trim();
    const candidates = envModel
      ? [envModel]
      : [
          "gemini-1.5-flash-latest",
          "gemini-1.5-flash",
          "gemini-1.5-flash-8b",
          "gemini-1.5-pro-latest",
        ];

    const contents = (messages as IncomingMessage[]).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

  let text = "";
  let lastErr: unknown = null;
    for (const modelName of candidates) {
      try {
        const model = gen.getGenerativeModel({ model: modelName, systemInstruction: systemPreamble });
        const result = await model.generateContent({ contents });
        text = result.response.text();
        if (text) break; // success
      } catch (e) { lastErr = e; }
    }
    if (!text) {
      const msg = (lastErr as { message?: string } | null)?.message || "Model failed without details";
      console.error("Gemini all candidates failed", msg);
      return new Response(
        JSON.stringify({ error: "Gemini request failed", details: msg }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ content: text }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: unknown) {
    const maybeErr = err as { message?: string; response?: Response } | null;
    const msg = maybeErr?.message || "Server error";
    console.error("/api/chat error", msg, maybeErr?.response || err);
    let details: unknown = undefined;
    try {
      if (maybeErr?.response) {
        // Attempt to read JSON error body if provided
        const cloned = maybeErr.response.clone();
        details = await cloned.json().catch(() => undefined);
      }
    } catch { /* swallow */ }
    return new Response(
      JSON.stringify({ error: msg, details }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

export const dynamic = "force-dynamic"; // avoid caching for dev
