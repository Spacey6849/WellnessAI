import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Simple in-memory cache (per server instance) to avoid regenerating availability too often.
// Key: therapistId
const availabilityCache: Record<string,{ expires:number; days: AvailabilityDay[] }> = {};

interface AvailabilityDay { date: string; slots: string[] }
interface BookedRow { date: string; slot: string }

// Generate pseudo-availability: 3 upcoming days, business-hour style half-hour slots.
function generateBaseSlots(): string[] {
  const slots: string[] = [];
  for (let h=9; h<=16; h++) { // 09:00 .. 16:30 (last start 16:30)
    slots.push(`${String(h).padStart(2,'0')}:00`);
    slots.push(`${String(h).padStart(2,'0')}:30`);
  }
  return slots;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const therapistId = searchParams.get('therapistId')?.trim();
    if (!therapistId) return NextResponse.json({ error: 'therapistId required' }, { status: 400 });

  const now = new Date();
    const supabase = getSupabaseAdmin();

    // Serve from cache if fresh (<5 min)
    const cached = availabilityCache[therapistId];
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json({ days: cached.days, cached: true });
    }

    // Determine the next 3 distinct date strings (today + next 2)
    const days: AvailabilityDay[] = [];
    for (let i=0; i<3; i++) {
      const d = new Date(now.getTime() + i*24*60*60*1000);
      const dateStr = d.toISOString().slice(0,10); // YYYY-MM-DD
      days.push({ date: dateStr, slots: [] });
    }

    // Fetch booked slots for those days
    const bookedResp = await supabase
      .from('bookings')
      .select('date, slot')
      .eq('therapist_id', therapistId)
      .in('date', days.map(d => d.date));
    if (bookedResp.error) throw bookedResp.error;
  const bookedRows = bookedResp.data as BookedRow[] | null;
  const bookedMap: Record<string, Set<string>> = {};
  (bookedRows||[]).forEach((b: BookedRow) => {
      if(!bookedMap[b.date]) bookedMap[b.date] = new Set();
      bookedMap[b.date].add(b.slot);
    });

    const baseSlots = generateBaseSlots();
    const currentHM = now.toTimeString().slice(0,5); // HH:MM

    for (const day of days) {
      const isToday = day.date === now.toISOString().slice(0,10);
      const taken = bookedMap[day.date] || new Set<string>();
      day.slots = baseSlots.filter(slot => {
        if (taken.has(slot)) return false; // already booked
        if (isToday && slot <= currentHM) return false; // past time today
        return true;
      });
    }

    // Cache
    availabilityCache[therapistId] = { expires: Date.now() + 5*60*1000, days };
    return NextResponse.json({ days, cached: false });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';