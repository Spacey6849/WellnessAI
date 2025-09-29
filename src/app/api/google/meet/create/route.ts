import { NextResponse } from 'next/server';

// Google Meet integration disabled (NextAuth removed).
export async function POST() {
  return NextResponse.json({ error: 'meet_integration_disabled' }, { status: 501 });
}
