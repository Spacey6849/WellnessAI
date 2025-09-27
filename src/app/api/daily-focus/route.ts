import { NextResponse } from 'next/server';

// Lightweight placeholder AI generation (replace with real model call later)
// GET returns array of 3 focus tasks.
const CANDIDATES = [
  ['2-min grounding breath','Reset your nervous system'],
  ['Gratitude jot','Write one thing you appreciate'],
  ['Stretch pause','Open chest + roll shoulders'],
  ['Micro-journal','Capture a 1-sentence reflection'],
  ['Hydration check','Sip water mindfully'],
  ['Mindful walk','30 steps with slow breathing'],
  ['Posture reset','Align spine + soften jaw'],
  ['Affirmation','Repeat one empowering phrase'],
];

export async function GET(){
  const shuffled = [...CANDIDATES].sort(()=>Math.random()-0.5).slice(0,3).map(([title, detail], idx)=>({ id:`focus-${Date.now()}-${idx}`, title, detail }));
  return NextResponse.json({ tasks: shuffled });
}
