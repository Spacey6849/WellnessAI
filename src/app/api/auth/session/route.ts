import { cookies } from 'next/headers';
import crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function verify(signed: string): any | null {
  const secret = process.env.CREDENTIAL_SESSION_SECRET || 'dev-insecure-secret';
  const parts = signed.split('.');
  if (parts.length < 2) return null;
  const sig = parts.pop() as string;
  const value = parts.join('.');
  const expected = crypto.createHmac('sha256', secret).update(value).digest('base64url');
  if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    try {
      const json = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      return json;
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET() {
  const store = await cookies();
  const raw = store.get('cred_session')?.value;
  if (!raw) return new Response(JSON.stringify({ session: null }), { status: 200 });
  const parsed = verify(raw);
  if (!parsed?.u) return new Response(JSON.stringify({ session: null }), { status: 200 });
  return new Response(JSON.stringify({ session: { user: parsed.u } }), { status: 200 });
}
