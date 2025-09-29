import { NextRequest } from "next/server";
import { buildDynamicContext, enforceWellnessSafety } from "@/lib/ai/contextBuilder";
import { generateWithOllama, isOllamaEnabled, OllamaChatMessage } from "@/lib/ai/ollamaClient";
import { generateWithGemini, isGeminiEnabled } from "@/lib/ai/geminiClient";
import { wellnessFallback } from "@/lib/wellnessFallback";

// (Gemini + JSON fallback removed per requirement – Ollama only except crisis)

interface IncomingMessage { role: string; content: string }

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { messages, model: requestedModel } = body as { messages: unknown; model?: string };
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), { status: 400 });
    }

    // Get the latest user message for analysis
    const lastUserMessage = (messages as IncomingMessage[])
      .filter(m => m.role === 'user')
      .pop()?.content || '';

    // Crisis: retain existing JSON-based immediate response for safety + resource injection
    if (wellnessFallback.isCrisisMessage(lastUserMessage)) {
      const crisisResponse = wellnessFallback.getEnhancedResponse(lastUserMessage);
      const emergencyResources = wellnessFallback.getEmergencyResources();
      
      const fullResponse = `${crisisResponse}\n\n🚨 **Emergency Resources:**\n${emergencyResources.crisis_lines.map(line => 
        `• ${line.name}: ${line.number}\n  ${line.description}`
      ).join('\n')}`;

      return new Response(JSON.stringify({ content: fullResponse, source: 'crisis_fallback' }), {
        headers: { "content-type": "application/json" },
      });
    }

  // Non-crisis explicit helpline request detection (user asking for numbers/help lines but not expressing active intent)
  const helplineRegex = /(help\s?line|hot\s?line|helpline|crisis (?:text|chat)|support number|suicide number|mental health number)/i;
  const wantsHelplines = helplineRegex.test(lastUserMessage) && !wellnessFallback.isCrisisMessage(lastUserMessage);

    // Build dynamic knowledge context (optional feature flag)
    const { systemPrompt: dynamicSystemPrompt } = buildDynamicContext(lastUserMessage);
    let text = "";
    let source: string = "";

    const wantsGeminiExplicit = requestedModel === 'gemini';
    const allowGeminiFallback = isGeminiEnabled();

    // Route logic:
    // 1. If explicit Gemini -> try Gemini first.
    // 2. Else attempt Ollama if enabled.
    // 3. If Ollama disabled or failed and Gemini available -> Gemini fallback.
    // 4. Else minimal nudge.

    if (wantsGeminiExplicit) {
      if (!isGeminiEnabled()) {
        return new Response(JSON.stringify({ error: 'Gemini requested but GEMINI_API_KEY not configured' }), { status: 400, headers: { 'content-type': 'application/json' } });
      }
      try {
        const geminiMessages = (messages as IncomingMessage[]).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        const geminiResp = await generateWithGemini(geminiMessages, { extraContext: dynamicSystemPrompt });
        text = geminiResp.trim();
        source = 'gemini';
      } catch (ge) {
        console.error('Gemini explicit mode failed', ge);
        return new Response(JSON.stringify({ error: 'Gemini generation failed' }), { status: 500, headers: { 'content-type': 'application/json' } });
      }
    } else {
      // Attempt Ollama first if enabled
      if (isOllamaEnabled()) {
        try {
          const ollamaMessages: OllamaChatMessage[] = (messages as IncomingMessage[]).map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
          }));
          const ollamaResponse = await generateWithOllama(ollamaMessages, { model: requestedModel, extraContext: dynamicSystemPrompt });
          if (ollamaResponse && ollamaResponse.trim().length > 0) {
            text = ollamaResponse.trim();
            const modelTag = requestedModel || process.env.OLLAMA_MODEL || 'default';
            source = `ollama:${modelTag}`;
          }
        } catch (ollamaErr) {
          console.warn('Ollama generation failed, will fallback if Gemini available:', (ollamaErr as Error)?.message);
        }
      }
      if (!text && allowGeminiFallback) {
        try {
          const geminiMessages = (messages as IncomingMessage[]).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
          const geminiResp = await generateWithGemini(geminiMessages, { extraContext: dynamicSystemPrompt });
          text = geminiResp.trim();
          source = 'gemini:fallback';
        } catch (ge) {
          console.warn('Gemini fallback failed', (ge as Error)?.message);
        }
      }
      if (!text) {
        if (!isOllamaEnabled() && !allowGeminiFallback) {
          return new Response(JSON.stringify({ error: 'No model available. Enable OLLAMA or set GEMINI_API_KEY.' }), { status: 503, headers: { 'content-type': 'application/json' } });
        }
        text = "I’m here with you. Could you share a little more about what you’re feeling right now?";
        source = source || 'nudge';
      }
    }

    // Append helplines if explicitly requested (already handled crisis above)
    if (wantsHelplines) {
      const resources = wellnessFallback.getEmergencyResources();
      const helplineBlock = `\n\n📞 Helpful Support Resources:\n${resources.crisis_lines.map(l => `• ${l.name}: ${l.number}\n  ${l.description}`).join('\n')}`;
      if (!text.includes(resources.crisis_lines[0].number)) {
        text += helplineBlock;
      }
    }

    // Safety filter + disclaimer
  const { safeText, flagged } = enforceWellnessSafety(text);
  const finalText = safeText; // disclaimer intentionally suppressed per user request

    return new Response(JSON.stringify({ content: finalText, source, flagged }), {
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
