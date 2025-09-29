// Structured wellness micro-knowledge units to augment LLM context.
// Keep concise; each topic: id, tags, summary, strategies (<=5, action oriented), when_to_use.

export interface WellnessTopic {
  id: string;
  tags: string[]; // keywords / retrieval cues
  summary: string; // brief psychoeducational framing (<= 280 chars ideally)
  strategies: string[]; // actionable micro-steps
  when_to_use?: string; // optional guidance for retrieval heuristics
}

export const WELLNESS_TOPICS: WellnessTopic[] = [
  {
    id: 'crisis_resources_info',
    tags: ['helpline','hotline','crisis','support','suicide','emergency','988','resource','help line','support line'],
    summary: 'Helplines provide immediate, confidential human support. Encourage contacting local emergency services (911/112) if there is imminent danger or intent to self‑harm.',
    strategies: [
      'If in immediate danger call your local emergency number (e.g. 911 / 112).',
      'In the US you can dial 988 (Suicide & Crisis Lifeline).',
      'Text HOME to 741741 in the US & Canada for crisis text support.',
      'Reach out to a trusted person while seeking professional help.',
      'Remove or distance from any means of self‑harm and stay in a safer space.'
    ],
    when_to_use: 'User directly asks for helpline/hotline numbers or expresses need for support contacts.'
  },
  {
    id: 'breathing_box',
    tags: ['anxiety','panic','stress','breathing','grounding'],
    summary: 'Box breathing regulates the autonomic nervous system by equalizing inhale, hold, exhale phases to reduce sympathetic overactivation.',
    strategies: [
      'Inhale gently through nose for 4',
      'Hold lungs comfortably full for 4',
      'Exhale slowly through mouth for 4',
      'Hold lungs comfortably empty for 4',
      'Repeat 4 cycles; notice shoulders drop'
    ],
    when_to_use: 'User mentions feeling anxious, heart racing, tension, overwhelm'
  },
  {
    id: 'cognitive_defusion_labeling',
    tags: ['rumination','overthinking','thoughts','anxiety','worry'],
    summary: 'Cognitive defusion reduces the literal believability of sticky thoughts by labeling them as mental events, creating psychological distance.',
    strategies: [
      'Notice a recurring thought',
      'Prefix it with: "I am having the thought that…"',
      'Say it again in a playful voice mentally',
      'Observe any shift in intensity',
      'Return focus to a chosen task'
    ],
    when_to_use: 'User stuck looping on a worry or self-critical thought'
  },
  {
    id: 'behavioral_activation_micro',
    tags: ['low motivation','depression','flat','numb','energy'],
    summary: 'Behavioral activation combats inertia by scheduling small values-aligned actions that can restore momentum and mood through mastery & engagement.',
    strategies: [
      'List 3 tiny doable actions (2–5 min)',
      'Pick the easiest that aligns with values',
      'Do it gently (no perfection)',
      'Acknowledge completion explicitly',
      'Stack the next small action'
    ],
    when_to_use: 'User reports low energy, stuck, nothing feels worth it'
  },
  {
    id: 'sleep_hygiene_evening',
    tags: ['sleep','insomnia','night','rest','evening'],
    summary: 'Consistent pre-sleep wind-down cues train the brain to transition from cognitive activation to parasympathetic dominance.',
    strategies: [
      'Dim lights ~60 min before bed',
      'Cease intense screens/work 30–45 min prior',
      'Do a calming anchor (tea, shower, stretch)',
      'Keep bedroom dark, cool, device-minimal',
      'Record intrusive to-dos on paper before bed'
    ],
    when_to_use: 'User mentions trouble falling asleep or restless evenings'
  },
  {
    id: 'grounding_54321',
    tags: ['panic','dissociation','anxiety','present','grounding'],
    summary: 'The 5-4-3-2-1 sensory scan reorients attention to immediate environment, reducing escalation of panic/dissociative spirals.',
    strategies: [
      'Name 5 things you can see',
      'Name 4 things you can physically touch',
      'Name 3 things you can hear',
      'Name 2 things you can smell',
      'Name 1 thing you can taste or are grateful for'
    ],
    when_to_use: 'User reports feeling unreal, spinning, detached'
  },
  {
    id: 'values_mini_check',
    tags: ['purpose','meaning','stuck','motivation','direction'],
    summary: 'Brief values check fosters alignment: choosing actions that reflect what matters rather than mood-driven avoidance.',
    strategies: [
      'Ask: What quality do I want to embody today?',
      'Identify 1 action that reflects it',
      'Schedule or do it immediately',
      'Afterward note: Did that align?',
      'Refine next tiny step'
    ],
    when_to_use: 'User expresses lack of direction or meaning'
  }
];

export function searchTopics(query: string, limit = 3): WellnessTopic[] {
  const q = query.toLowerCase();
  const scored = WELLNESS_TOPICS.map(t => {
    let score = 0;
    for (const tag of t.tags) if (q.includes(tag)) score += 2;
    if (t.summary.toLowerCase().includes(q)) score += 1;
    return { t, score };
  }).filter(r => r.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.t);
  return scored;
}
