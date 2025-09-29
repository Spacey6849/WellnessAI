// Google Calendar / Meet helper
// Requires environment variables:
// GOOGLE_CLIENT_EMAIL (service account email)
// GOOGLE_PRIVATE_KEY (service account private key, with \n newlines properly replaced)
// GOOGLE_CALENDAR_ID (target calendar)
// If using OAuth user flow instead, adapt to store/refresh user tokens per account.

import crypto from 'crypto';

interface CreateMeetParams {
  summary: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes?: number; // default 30
  attendeeEmail?: string | null; // backwards compatibility (single)
  attendeeEmails?: string[]; // preferred multi-attendee list (deduped & filtered)
  // In future we could allow specifying which attendees are optional / accepted statuses.
  // For now all provided attendees are auto-marked accepted to minimize Google Meet lobby prompts.
}

interface CreateMeetResult {
  eventId: string;
  meetUrl: string | null;
  htmlLink: string | null;
}

function getEnv(name: string, optional = false) {
  const v = process.env[name];
  if (!v && !optional) throw new Error(`Missing env ${name}`);
  return v || '';
}

function buildJWT(): string {
  const email = getEnv('GOOGLE_CLIENT_EMAIL');
  const key = getEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const encode = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${encode(header)}.${encode(claims)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(key, 'base64url');
  return `${unsigned}.${signature}`;
}

async function fetchAccessToken(): Promise<string> {
  const jwt = buildJWT();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${txt}`);
  }
  const json = await res.json() as { access_token: string };
  return json.access_token;
}

export async function createCalendarEventWithMeet(params: CreateMeetParams): Promise<CreateMeetResult> {
  const calendarId = getEnv('GOOGLE_CALENDAR_ID');
  const token = await fetchAccessToken();
  const { startDate, startTime, durationMinutes = 30 } = params;
  const startISO = `${startDate}T${startTime}:00Z`; // Assume slot stored in UTC; adjust if local TZ.
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  interface EventBody {
    summary: string;
    description: string;
    start: { dateTime: string };
    end: { dateTime: string };
    conferenceData: { createRequest: { requestId: string; conferenceSolutionKey: { type: string } } };
    attendees?: { email: string; responseStatus?: string }[];
    // Guest / access controls: these flags help ensure invited therapist can join smoothly.
    guestsCanInviteOthers?: boolean;
    guestsCanModify?: boolean;
    guestsCanSeeOtherGuests?: boolean;
    // conferenceProperties could further restrict types; not strictly required here.
    conferenceProperties?: { allowedConferenceSolutionTypes?: string[] };
  }
  const eventBody: EventBody = {
    summary: params.summary,
    description: params.description || '',
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    conferenceData: {
      createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } }
    },
    // Default guest permissions: allow seeing other guests so both parties visible; don't allow modifying/inviting.
    guestsCanInviteOthers: false,
    guestsCanModify: false,
    guestsCanSeeOtherGuests: true,
    conferenceProperties: { allowedConferenceSolutionTypes: ['hangoutsMeet'] }
  };
  const multi = params.attendeeEmails && params.attendeeEmails.length
    ? params.attendeeEmails
    : (params.attendeeEmail ? [params.attendeeEmail] : []);
  if (multi.length) {
    const unique = Array.from(new Set(multi.filter(e => !!e)));
    if (unique.length) {
      eventBody.attendees = unique.map(email => ({ email, responseStatus: 'accepted' }));
    }
  }
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventBody)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Calendar event create failed: ${res.status} ${txt}`);
  }
  type EntryPoint = { entryPointType: string; uri?: string };
  type EventResponse = { id: string; hangoutLink?: string; htmlLink?: string; conferenceData?: { entryPoints?: EntryPoint[] } };
  const data: EventResponse = await res.json();
  const hangoutLink = data.hangoutLink || data.conferenceData?.entryPoints?.find((e: EntryPoint) => e.entryPointType === 'video')?.uri || null;
  return { eventId: data.id, meetUrl: hangoutLink, htmlLink: data.htmlLink || null };
}
