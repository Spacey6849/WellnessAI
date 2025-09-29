import { searchTopics } from '@/data/wellnessKnowledge';
import { buildTherapistPrompt } from './systemPrompt';

export interface BuiltContext {
  systemPrompt: string;
  debugMeta: { matchedTopics: string[] };
}

// Disclaimer removed per user request. Keeping stub for potential re-enable via env.
export function ensureDisclaimer(text: string): string {
  if (process.env.WELLNESS_FORCE_DISCLAIMER === 'true') {
    if (/not a licensed/i.test(text)) return text;
    return text + "\n\n(This AI is not a licensed clinician.)";
  }
  return text;
}

export function buildDynamicContext(userLastMessage: string): BuiltContext {
  if (!process.env.WELLNESS_DYNAMIC_CONTEXT || process.env.WELLNESS_DYNAMIC_CONTEXT === 'false') {
    return { systemPrompt: buildTherapistPrompt(), debugMeta: { matchedTopics: [] } };
  }
  const topics = searchTopics(userLastMessage, 3);
  if (topics.length === 0) {
    return { systemPrompt: buildTherapistPrompt(), debugMeta: { matchedTopics: [] } };
  }
  const knowledgeBlock = topics.map(t => {
    return `Topic: ${t.id}\nTags: ${t.tags.join(', ')}\nSummary: ${t.summary}\nMicro-strategies:\n- ${t.strategies.join('\n- ')}`;
  }).join('\n\n');

  const systemPrompt = buildTherapistPrompt('Relevant micro-knowledge units:\n' + knowledgeBlock);
  return { systemPrompt, debugMeta: { matchedTopics: topics.map(t => t.id) } };
}

// Basic safety filter for obviously disallowed patterns (not exhaustive)
const DISALLOWED_PATTERNS: RegExp[] = [
  /here's how you can (?:kill|harm) yourself/i,
  /i diagnose you/i,
  /take \d+ (?:mg|milligrams)/i,
  /stop taking your (?:med|medicine|medication)/i
];

export function enforceWellnessSafety(text: string): { safeText: string; flagged: boolean } {
  let flagged = false;
  let output = text;
  for (const pattern of DISALLOWED_PATTERNS) {
    if (pattern.test(output)) {
      flagged = true;
      output = output.replace(pattern, '[removed potentially unsafe instruction]');
    }
  }
  return { safeText: output, flagged };
}
