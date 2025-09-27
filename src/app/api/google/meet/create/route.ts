import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import crypto from 'crypto';

interface Body { summary?: string; description?: string; startDate?: string; startTime?: string; durationMinutes?: number; attendeeEmail?: string }

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const accessToken = (token as { accessToken?: string } | null)?.accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json() as Body;
    const { startDate, startTime } = body;
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
      return NextResponse.json({ error: 'invalid date/time' }, { status: 400 });
    }
    const duration = body.durationMinutes ?? 30;
    const startISO = `${startDate}T${startTime}:00Z`;
    const start = new Date(startISO);
    const end = new Date(start.getTime() + duration * 60000);
    const calendarId = 'primary'; // user primary calendar
    const eventBody: {
      summary: string;
      description: string;
      start: { dateTime: string };
      end: { dateTime: string };
      conferenceData: { createRequest: { requestId: string; conferenceSolutionKey: { type: string } } };
      attendees?: { email: string }[];
    } = {
      summary: body.summary || 'Therapy Session',
      description: body.description || '',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    };
    if (body.attendeeEmail) {
      eventBody.attendees = [{ email: body.attendeeEmail }];
    }
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody)
    });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: 'google_error', detail: txt }, { status: 502 });
    }
    const json = await res.json();
  const meetUrl: string | null = json.hangoutLink || (json.conferenceData?.entryPoints?.find((e: { entryPointType?: string; uri?: string }) => e.entryPointType === 'video')?.uri ?? null);
    return NextResponse.json({ eventId: json.id, htmlLink: json.htmlLink, meetUrl });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
