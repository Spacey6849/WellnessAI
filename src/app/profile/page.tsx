import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';

// Temporary: using env directly; in a real app, centralize this.
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

async function fetchProfile(userId: string) {
  if (!supabase) return null;
  const { data } = await supabase.from('user_profiles').select('username, display_name, avatar_url, email_verified_at, role, created_at').eq('user_id', userId).maybeSingle();
  return data;
}

export default async function ProfilePage() {
  // Placeholder: no real server session extraction yet.
  // Replace with Supabase auth server helpers when integrated.
  const mockId = '00000000-0000-0000-0000-000000000000';
  const profile = await fetchProfile(mockId);
  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <h1 className="text-2xl font-semibold text-white">Profile</h1>
        <p className="mt-4 text-sm text-slate-400">User not found or not authenticated (mock state).</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl py-16">
      <h1 className="mb-8 text-2xl font-semibold text-white">Profile</h1>
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
            <div className="flex flex-col items-center gap-4">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.username || 'avatar'} width={96} height={96} className="h-24 w-24 rounded-full object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-2xl font-bold text-white">
                  {(profile.display_name || profile.username || '?').slice(0,1).toUpperCase()}
                </div>
              )}
              <div className="text-center">
                <p className="text-lg font-medium text-white">{profile.display_name || profile.username}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{profile.role}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="sm:col-span-2 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Account</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><dt className="text-slate-400">Username</dt><dd className="font-medium text-white">{profile.username}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-400">Display Name</dt><dd className="font-medium text-white">{profile.display_name || '—'}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-400">Email Verified</dt><dd className="font-medium text-white">{profile.email_verified_at ? 'Yes' : 'No'}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-400">Role</dt><dd className="font-medium text-white">{profile.role}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-400">Joined</dt><dd className="font-medium text-white">{new Date(profile.created_at).toLocaleDateString()}</dd></div>
            </dl>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Actions</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <button className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/10">Change Avatar</button>
              <button className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/10">Edit Profile</button>
              <button className="rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-2 font-medium text-blue-200 transition hover:border-blue-400/60 hover:bg-blue-500/20">Security Settings</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
