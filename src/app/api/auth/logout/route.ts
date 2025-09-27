import { cookies } from 'next/headers';

export async function POST() {
  const store = await cookies();
  store.set({
    name: 'cred_session',
    value: '',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0
  });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
