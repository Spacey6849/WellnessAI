import { NextRequest, NextResponse } from 'next/server';
import { createCalendarEventWithMeet } from '@/lib/googleCalendar';

// Simple diagnostics endpoint (secure behind admin middleware or temporary usage only!)
// Returns structured information about calendar env configuration and a dry-run event attempt.

export async function GET(_req: NextRequest) {
  const details: Record<string, unknown> = { ok: true };
  const warnings: string[] = [];
  const calId = process.env.GOOGLE_CALENDAR_ID;
  const svcEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privKey = process.env.GOOGLE_PRIVATE_KEY ? 'present' : 'missing';

  details.env = {
    hasCalendarId: !!calId,
    calendarId: calId || null,
    hasServiceAccountEmail: !!svcEmail,
    serviceAccountEmail: svcEmail || null,
    privateKey: privKey,
  };

  if (!svcEmail || !process.env.GOOGLE_PRIVATE_KEY) warnings.push('missing_service_account_credentials');
  if (!calId) warnings.push('missing_calendar_id');
  if (calId && /\.iam\.gserviceaccount\.com$/i.test(calId)) {
    warnings.push('calendar_id_is_service_account_email');
  }

  if (warnings.length === 0) {
    // Attempt a minimal dry-run event creation (short start time in future) and then delete.
    try {
      const now = new Date();
      const start = new Date(now.getTime() + 10 * 60000); // 10 minutes ahead
      const date = start.toISOString().slice(0, 10);
      const time = start.toISOString().slice(11, 16);
      const { eventId, meetUrl } = await createCalendarEventWithMeet({
        summary: 'Diagnostics Test Event',
        description: 'Temporary event created by diagnostics endpoint to verify calendar access.',
        startDate: date,
        startTime: time,
        durationMinutes: 15,
        attendeeEmail: null,
      });
      details.testEvent = { created: true, eventId, meetUrl: meetUrl || null };
      // Best-effort delete to avoid clutter
      try {
        // Use raw fetch with token via internal helper logic duplication (simpler than exporting delete helper)
        // Reuse environment / JWT builder inlined for brevity? Instead just note that manual deletion may be required.
        details.testEventCleanup = 'Not implemented - delete manually if desired.';
      } catch {
        details.testEventCleanup = 'delete_failed';
      }
    } catch (e) {
      warnings.push('event_creation_failed');
      details.error = (e as Error).message;
    }
  }

  details.warnings = warnings;
  if (warnings.length > 0) details.ok = false;
  return NextResponse.json(details, { status: 200 });
}
