import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createCalendarEventWithMeet } from '@/lib/googleCalendar';
import { sendBookingEmail, sendUserBookingEmail } from '@/lib/mailer';
import type { Database } from '@/types/supabase';

// Utility: basic ISO date validation (YYYY-MM-DD)
function isISODate(str: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const therapistId = searchParams.get('therapistId');
    const date = searchParams.get('date');
    if (!therapistId || !date || !isISODate(date)) {
      return NextResponse.json({ error: 'therapistId & date required' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    type SlotRow = Pick<Database['public']['Tables']['bookings']['Row'],'slot'>;
    const { data, error } = await supabase
      .from('bookings')
      .select('slot')
      .eq('therapist_id', therapistId)
      .eq('date', date) as { data: SlotRow[] | null; error: { message: string } | null };
    if (error) throw error;
    return NextResponse.json({ slots: (data ?? []).map(r => r.slot) });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

interface PostBody {
  therapistId?: string; date?: string; slot?: string; sessionType?: string; notes?: string; contactEmail?: string; userEmail?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PostBody | null;
    const therapistId = body?.therapistId?.trim();
    const date = body?.date?.trim();
    const slot = body?.slot?.trim();
    if (!therapistId || !date || !slot || !isISODate(date)) {
      return NextResponse.json({ error: 'Invalid or missing therapistId/date/slot', code: 'invalid_input' }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(slot)) {
      return NextResponse.json({ error: 'slot must be HH:MM', code: 'invalid_input' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const userIdHeader = req.headers.get('x-user-id');
    const insertPayload: Database['public']['Tables']['bookings']['Insert'] = {
      therapist_id: therapistId,
      user_id: userIdHeader || null,
      date,
      slot,
      session_type: body?.sessionType || null,
      notes: body?.notes || null,
      contact_email: body?.contactEmail || null,
      meet_url: null,
      calendar_event_id: null,
    };
    type InsertResult = { error: { code?: string; message: string } | null };
    const builder = supabase.from('bookings') as unknown as { insert: (row: typeof insertPayload) => Promise<InsertResult> };

    const warnings: string[] = [];
    let meetUrl: string | null = null;
    let eventId: string | null = null;
    // Calendar event creation strategy:
    // 1. If client supplies user Google access token (x-user-google-token), use user's primary calendar.
    // 2. Else fall back to service account configuration (if present) as before.
    const userGoogleToken = req.headers.get('x-user-google-token');
    if (userGoogleToken) {
      try {
        const startISO = `${date}T${slot}:00Z`;
        const start = new Date(startISO);
        const end = new Date(start.getTime() + 30 * 60000);
        interface GEventBody { summary: string; description: string; start: { dateTime: string }; end: { dateTime: string }; conferenceData: { createRequest: { requestId: string; conferenceSolutionKey: { type: string } } }; attendees?: { email: string }[] }
        const eventBody: GEventBody = {
          summary: 'Therapy Session',
          description: `Therapist session on ${date} at ${slot}`,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        };
        if (body?.contactEmail) eventBody.attendees = [{ email: body.contactEmail }];
        const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${userGoogleToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(eventBody)
        });
        if (!resp.ok) throw new Error(await resp.text());
        type EntryPoint = { entryPointType: string; uri?: string };
        type GEventResp = { id?: string; hangoutLink?: string; conferenceData?: { entryPoints?: EntryPoint[] } };
        const data: GEventResp = await resp.json();
        meetUrl = data.hangoutLink || data.conferenceData?.entryPoints?.find((e: EntryPoint) => e.entryPointType === 'video')?.uri || null;
        eventId = data.id || null;
        insertPayload.meet_url = meetUrl;
        insertPayload.calendar_event_id = eventId;
      } catch {
        warnings.push('user_calendar_failed');
      }
    } else {
      // Service account fallback (existing logic simplified)
      const calId = process.env.GOOGLE_CALENDAR_ID;
      const svcEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privKey = process.env.GOOGLE_PRIVATE_KEY;
      const hasAll = !!(calId && svcEmail && privKey);
      if (!svcEmail || !privKey) warnings.push('calendar_missing_credentials');
      if (!calId) warnings.push('calendar_missing_id');
      if (calId && /\.iam\.gserviceaccount\.com$/i.test(calId)) warnings.push('calendar_id_service_account_email');
      if (hasAll) {
        try {
          const { meetUrl: m, eventId: e } = await createCalendarEventWithMeet({
            summary: 'Therapy Session',
            description: `Therapist session on ${date} at ${slot}`,
            startDate: date,
            startTime: slot,
            attendeeEmail: body?.contactEmail || null
          });
          meetUrl = m; eventId = e;
          insertPayload.meet_url = meetUrl; insertPayload.calendar_event_id = eventId;
        } catch {
          warnings.push('calendar_failed');
        }
      } else if (warnings.length === 0) warnings.push('calendar_not_configured');
    }

    const { error: insertError } = await builder.insert(insertPayload);
    if (insertError) {
      if (typeof (insertError as unknown as { code?: string })?.code === 'string' && (insertError as unknown as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Slot already booked', code: 'slot_conflict' }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message, code: 'db_error' }, { status: 500 });
    }

  // Fetch therapist email for notification
    let therapistEmail: string | null = null;
    try {
      interface TherapistLookup { email: string; name?: string | null }
      const { data: therapistRow } = await supabase
        .from('therapists')
        .select('email, name')
        .eq('id', therapistId)
        .maybeSingle();
      const tRow = therapistRow as TherapistLookup | null;
      therapistEmail = tRow?.email || null;
      if (therapistEmail) {
        const emailResult = await sendBookingEmail({
          therapistEmail,
          therapistName: tRow?.name || null,
          date,
          slot,
          meetUrl,
          notes: body?.notes || null,
          userEmail: body?.userEmail || null,
          contactEmail: body?.contactEmail || null,
        });
        if (!emailResult.ok && emailResult.warning) warnings.push(emailResult.warning);
      } else {
        warnings.push('therapist_email_missing');
      }
      // Send user confirmation email (if we know their address)
      if (body?.userEmail) {
        const userEmailResult = await sendUserBookingEmail({
          to: body.userEmail,
          date,
          slot,
          meetUrl,
          notes: body?.notes || null,
        });
        if (!userEmailResult.ok && userEmailResult.warning) warnings.push(userEmailResult.warning);
      }
    } catch {
      warnings.push('therapist_lookup_failed');
    }

    return NextResponse.json({ ok: true, meetUrl, calendarEventId: eventId, warnings }, { status: 201 });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message || 'Unknown error', code: 'internal_error' }, { status: 500 });
  }
}
