"use client";
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from '@/lib/useSession';

interface ProfileData { username: string | null; display_name: string | null; avatar_url: string | null; email_verified_at: string | null; role: string; created_at: string; phone?: string | null }

function Skeleton() {
  return (
    <div className="mx-auto max-w-3xl py-16 animate-pulse">
      <div className="h-6 w-40 rounded bg-white/10" />
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div className="h-64 rounded-2xl border border-white/10 bg-white/5" />
        <div className="space-y-6 sm:col-span-2">
          <div className="h-56 rounded-2xl border border-white/10 bg-white/5" />
          <div className="h-40 rounded-2xl border border-white/10 bg-white/5" />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { session, status } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ display_name: string; username: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/profile', {
        headers: { 'x-user-id': userId }
      });
      if (!r.ok) {
        const j = await r.json().catch(()=>({}));
        throw new Error(j.error || 'Failed to load profile');
      }
      const j = await r.json();
      setProfile(j.profile);
      setForm({ display_name: j.profile.display_name || '', username: j.profile.username || '' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (userId) load(); }, [userId, load]);

  async function save() {
    if (!userId || !form) return;
    setSaving(true); setError(null);
    try {
      const r = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ display_name: form.display_name, username: form.username })
      });
      if (!r.ok) {
        const j = await r.json().catch(()=>({}));
        if (r.status === 409) throw new Error('Username already taken');
        throw new Error(j.error || 'Failed to update profile');
      }
      await load();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally { setSaving(false); }
  }

  if (status === 'loading' || loading) return <Skeleton />;
  if (!session) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <h1 className="text-2xl font-semibold text-white">Profile</h1>
        <p className="mt-4 text-sm text-slate-400">You need to sign in to view your profile.</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <h1 className="text-2xl font-semibold text-white">Profile</h1>
        <p className="mt-4 text-sm text-rose-400">{error}</p>
        <button onClick={load} className="mt-4 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:border-white/30 hover:bg-white/10">Retry</button>
      </div>
    );
  }
  if (!profile) return <Skeleton />;

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
                  {(profile.display_name || profile.username || session.user.name || '?').slice(0,1).toUpperCase()}
                </div>
              )}
              <div className="text-center">
                <p className="text-lg font-medium text-white">{profile.display_name || profile.username || session.user.name}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{profile.role}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="sm:col-span-2 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Account</h2>
            {!editing && (
              <>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between"><dt className="text-slate-400">Username</dt><dd className="font-medium text-white">{profile.username || '—'}</dd></div>
                  <div className="flex items-center justify-between"><dt className="text-slate-400">Email Verified</dt><dd className="font-medium text-white">{profile.email_verified_at ? 'Yes' : 'No'}</dd></div>
                  <div className="flex items-center justify-between"><dt className="text-slate-400">Role</dt><dd className="font-medium text-white">{profile.role}</dd></div>
                  <div className="flex items-center justify-between"><dt className="text-slate-400">Joined</dt><dd className="font-medium text-white">{new Date(profile.created_at).toLocaleDateString()}</dd></div>
                </dl>
                <button onClick={()=>{ setEditing(true); setForm({ display_name: profile.display_name || '', username: profile.username || '' }); }} className="mt-6 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 hover:border-white/30 hover:bg-white/10">Edit Profile</button>
              </>
            )}
            {editing && form && (
              <form onSubmit={(e)=>{ e.preventDefault(); save(); }} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-slate-400">Display Name</span>
                    <input value={form.display_name} onChange={e=>setForm(f=>({...f!, display_name:e.target.value}))} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none" maxLength={60} />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-slate-400">Username</span>
                    <input value={form.username} onChange={e=>setForm(f=>({...f!, username:e.target.value}))} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none" pattern="^[-_a-zA-Z0-9]{3,30}$" title="3-30 chars letters, numbers, - or _" />
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <button type="submit" disabled={saving} className="rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-200 transition hover:border-blue-400/60 hover:bg-blue-500/20 disabled:opacity-50">{saving? 'Saving...' : 'Save'}</button>
                  <button type="button" onClick={()=>{ setEditing(false); setError(null); }} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 hover:border-white/30 hover:bg-white/10">Cancel</button>
                </div>
              </form>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Actions</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <button className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/10">Change Avatar (coming soon)</button>
              <button disabled className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-medium text-slate-100 opacity-50">Security Settings (todo)</button>
            </div>
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
