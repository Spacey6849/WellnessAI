import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Basic role guard using header (placeholder until auth integration)
function isAdmin(req: NextRequest) {
  return req.headers.get('x-role') === 'admin';
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('therapists')
      .select('id,name,specialty,email,phone,bio,active,created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ therapists: data });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const { name, specialty, email, phone, bio } = body || {};
    if (!name || !specialty || !email) {
      return NextResponse.json({ error: 'name, specialty, email required' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
  interface TherapistInsert { name: string; specialty: string; email: string; phone: string | null; bio: string | null }
  const insertPayload: TherapistInsert = { name, specialty, email, phone: phone || null, bio: bio || null };
    // Minimal fluent builder interface to satisfy TS without generated table types
    interface RowShape { id: string; name: string; specialty: string; email: string; phone: string | null; bio: string | null; active: boolean; created_at: string }
    interface MinimalBuilder {
      insert(v: TherapistInsert): MinimalBuilder;
      select(columns: string): MinimalBuilder;
      single(): Promise<{ data: RowShape | null; error: { message: string } | null }>;
    }
    const builder = supabase.from('therapists') as unknown as MinimalBuilder;
    const { data, error } = await builder
      .insert(insertPayload)
      .select('id,name,specialty,email,phone,bio,active,created_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ therapist: data }, { status: 201 });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    // Surface uniqueness constraint nicely
    if ((err.code === '23505' || /duplicate/i.test(err.message || ''))) {
      return NextResponse.json({ error: 'A therapist with that email already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
