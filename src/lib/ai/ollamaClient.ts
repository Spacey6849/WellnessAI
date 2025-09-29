import { buildTherapistPrompt } from './systemPrompt';

export interface OllamaChatMessage { role: 'user' | 'assistant' | 'system'; content: string }

interface OllamaGenerateOptions {
  model?: string;
  host?: string;
  timeoutMs?: number;
  extraContext?: string; // optional dynamic domain knowledge snippet appended to system prompt
}

interface OllamaSingleResponse { model?: string; created_at?: string; message?: { role: string; content: string }; done?: boolean }
type OllamaApiResponse = OllamaSingleResponse | OllamaSingleResponse[];

/**
 * Calls a local Ollama server's chat endpoint (non-streamed aggregation) and returns generated text.
 * Assumes Ollama is running locally: `ollama serve` and model pulled: `ollama pull llama3.2`
 */
export async function generateWithOllama(messages: OllamaChatMessage[], opts: OllamaGenerateOptions = {}) {
  const host = (opts.host || process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
  const model = opts.model || process.env.OLLAMA_MODEL || 'llama3.2';
  const timeoutMs = opts.timeoutMs ?? 20000; // 20s default

  // Insert a system prompt at the start if not provided
  const hasSystem = messages.some(m => m.role === 'system');
  let systemBase = buildTherapistPrompt();
  if (opts.extraContext) {
    systemBase += '\n\nContext Addendum:\n' + opts.extraContext.trim();
  }
  const finalMessages: OllamaChatMessage[] = hasSystem
    ? messages.map(m => m.role === 'system' && opts.extraContext ? ({ ...m, content: m.content + '\n\n' + opts.extraContext }) : m)
    : [{ role: 'system', content: systemBase }, ...messages];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
        stream: false
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama error ${res.status}`);
    }

    // Non-stream path returns: { model, created_at, message: { role, content }, done } OR entire conversation
    const data: OllamaApiResponse = await res.json();
    if (!Array.isArray(data)) {
      if (data?.message?.content) return data.message.content;
    } else if (data.length) {
      const last = data[data.length - 1];
      if (last?.message?.content) return last.message.content;
    }
    throw new Error('Unexpected Ollama response shape');
  } finally {
    clearTimeout(timer);
  }
}

export function isOllamaEnabled() {
  return /^true$/i.test(process.env.OLLAMA_ENABLED || '');
}
