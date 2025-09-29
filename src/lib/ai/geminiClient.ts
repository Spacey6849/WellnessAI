import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeminiChatMessage { role: 'user' | 'assistant'; content: string }

export interface GeminiOptions {
  model?: string; // override model name
  extraContext?: string; // optional system style context injected at start
}

export function isGeminiEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

export async function generateWithGemini(messages: GeminiChatMessage[], opts: GeminiOptions = {}) {
  if (!isGeminiEnabled()) throw new Error('Gemini not configured (missing GEMINI_API_KEY)');
  const apiKey = process.env.GEMINI_API_KEY as string;
  const modelName = opts.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  // Map conversation to Gemini content format
  const history = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  if (opts.extraContext) {
    history.unshift({ role: 'user', parts: [{ text: opts.extraContext }] });
  }
  const response = await model.generateContent({ contents: history });
  const text = response.response.text();
  return text;
}
