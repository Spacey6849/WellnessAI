import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { Database } from '@/types/supabase';

// Returns up to 5 upcoming bookings for a user in next 72h (including today) ordered by date then slot.
// Auth model: for now we accept x-user-id header (server-to-server or preview). In production you would derive from auth session / RLS.

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id')?.trim();
    if (!userId) {
      return NextResponse.json({ error: 'x-user-id header required' }, { status: 400 });
    }
    const now = new Date();
    const startDate = now.toISOString().slice(0,10); // YYYY-MM-DD
    const horizon = new Date(now.getTime() + 72*60*60*1000); // +72h
    const endDate = horizon.toISOString().slice(0,10);

    const supabase = getSupabaseAdmin();
  type BookingRow = Pick<Database['public']['Tables']['bookings']['Row'], 'id' | 'therapist_id' | 'date' | 'slot' | 'session_type' | 'notes' | 'meet_url' | 'calendar_event_id'>;
    // Fetch bookings within window (inclusive). If window crosses month boundaries this simple filter works since dates are ISO.
    // For safety we apply a between filter.
    const { data, error } = await supabase
      .from('bookings')
  .select('id, therapist_id, date, slot, session_type, notes, meet_url, calendar_event_id')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('slot', { ascending: true }) as { data: BookingRow[] | null; error: { message: string } | null };
    if (error) throw error;
    const rows = (data ?? []).slice(0,5);

    // Optionally enrich with therapist name (best-effort join)
    let therapistNames: Record<string,string> = {};
    const therapistIds = Array.from(new Set(rows.map(r => r.therapist_id).filter(Boolean)));
    if (therapistIds.length > 0) {
      const { data: therapists, error: tErr } = await supabase
        .from('therapists')
        .select('id, name')
        .in('id', therapistIds) as { data: { id: string; name: string }[] | null; error: { message: string } | null };
      if (!tErr && therapists) {
        therapistNames = Object.fromEntries(therapists.map(t => [t.id, t.name]));
      }
    }

    const result = rows.map(r => ({
      id: r.id,
      therapistId: r.therapist_id,
      therapistName: therapistNames[r.therapist_id] || null,
      date: r.date,
      slot: r.slot,
      sessionType: r.session_type,
      notes: r.notes,
      meetUrl: r.meet_url || null,
      calendarEventId: r.calendar_event_id || null
    }));

    return NextResponse.json({ bookings: result, window: { startDate, endDate } });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
