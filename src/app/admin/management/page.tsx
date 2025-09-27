"use client";
import { useEffect, useState } from 'react';

interface Therapist {
  id: string;
  name: string;
  specialty: string;
  email?: string; // legacy form may not capture now
  phone?: string;
  bio?: string;
  category?: string;
  location?: string;
  languages?: string[];
  active?: boolean;
  created_at?: string;
}

export default function AdminManagementPage() {
  const [therapists,setTherapists]=useState<Therapist[]>([]);
  const [loading,setLoading]=useState(false);
  const [form,setForm]=useState({ name:'', specialty:'', email:'', phone:'', bio:'', category:'', extraSpecialties:'' });
  const [error,setError]=useState<string|null>(null);
  const [submitting,setSubmitting]=useState(false);

  const load=async()=>{
    setLoading(true); setError(null);
    try {
  const res=await fetch('/api/admin/therapists');
      const json=await res.json();
      if(!res.ok) throw new Error(json.error||'Failed');
      setTherapists(json.therapists||[]);
  } catch(e){ const err = e as Error; setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ load(); },[]);

  const onChange=(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>{
    setForm(f=>({...f,[e.target.name]:e.target.value}));
  };

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!form.name||!form.specialty||!form.email) { setError('Name, specialty, email required'); return; }
    setSubmitting(true); setError(null);
    try {
  const payload={...form, specialty: form.specialty + (form.extraSpecialties? ', '+form.extraSpecialties : '' ) };
  const res=await fetch('/api/admin/therapists',{method:'POST', headers:{'Content-Type':'application/json','x-role':'admin'}, body:JSON.stringify(payload)});
      const json=await res.json();
      if(!res.ok) throw new Error(json.error||'Failed');
      setForm({ name:'', specialty:'', email:'', phone:'', bio:'', category:'', extraSpecialties:'' });
      setTherapists(t=>[json.therapist,...t]);
  } catch(e){ const err = e as Error; setError(err.message); }
    finally { setSubmitting(false); }
  };

  const remove=async(id:string)=>{
    if(!confirm('Remove therapist?')) return;
    try {
      const res=await fetch(`/api/admin/therapists/${id}`,{method:'DELETE', headers:{'x-role':'admin'}});
      const json=await res.json();
      if(!res.ok) throw new Error(json.error||'Failed');
      setTherapists(t=>t.filter(x=>x.id!==id));
  } catch(e){ const err = e as Error; alert(err.message); }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] py-12 space-y-10 px-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Admin Management</h1>
        <p className="text-slate-300 text-sm">Add or remove therapists. Connected to booking page.</p>
      </div>
      <div className="grid gap-10 lg:grid-cols-[420px_minmax(0,1fr)] items-start">
        {/* Left: Form Card */}
        <form onSubmit={submit} className="space-y-6 rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-7 backdrop-blur-xl shadow-xl shadow-blue-500/10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Add Therapist</h2>
            <button type="button" onClick={load} className="text-[11px] uppercase tracking-wider rounded-full border border-white/10 px-3 py-1 text-slate-200 hover:bg-white/10">Reload</button>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="grid gap-4">
            {/* Name */}
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <span>Name</span>
              <input id="name" name="name" value={form.name} onChange={onChange} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"/>
            </label>
            {/* Primary Specialty (mapped to normalized category set) */}
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <span>Specialty</span>
              <select id="specialty" name="specialty" value={form.specialty} onChange={onChange} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-400">
                <option value="">Select specialty</option>
                {['Anxiety','Depression','Mindfulness','Sleep','Stress','Relationships','Nutrition','Trauma','Self-Esteem','Movement'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </label>
            {/* Additional specialties comma separated */}
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <span>Additional Specialties (comma separated)</span>
              <input id="extraSpecialties" name="extraSpecialties" value={form.extraSpecialties} placeholder="e.g. CBT, ACT" onChange={onChange} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"/>
            </label>
            {/* Email */}
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <span>Email</span>
              <input id="email" name="email" type="email" value={form.email} onChange={onChange} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"/>
            </label>
            {/* Phone */}
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <span>Phone</span>
              <input id="phone" name="phone" value={form.phone} onChange={onChange} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"/>
            </label>
            {/* Bio */}
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <span>Bio</span>
              <textarea id="bio" name="bio" value={form.bio} onChange={onChange} className="h-28 resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"/>
            </label>
          </div>
          <button disabled={submitting} className="w-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">{submitting? 'Saving…':'Add Therapist'}</button>
          <p className="text-[11px] text-slate-400 leading-relaxed">Fields <strong>name</strong>, <strong>specialty</strong>, and <strong>email</strong> are required. You can add extra specialties (comma separated) which will be appended for search. Category derives from selected specialty.</p>
        </form>
        {/* Right: Table */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-6 shadow-xl shadow-blue-500/5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Therapists</h2>
            <div className="flex items-center gap-2">
              <button onClick={load} className="text-[11px] uppercase tracking-wider rounded-full border border-white/10 px-3 py-1 text-slate-200 hover:bg-white/10">Refresh</button>
            </div>
          </div>
          {loading && <p className="text-slate-400 text-sm">Loading…</p>}
          {!loading && therapists.length===0 && <p className="text-slate-400 text-sm">No therapists added yet.</p>}
          {!loading && therapists.length>0 && (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full text-sm text-slate-200">
                <thead className="bg-white/10 text-[11px] uppercase tracking-wider text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Name</th>
                    <th className="px-3 py-2 text-left font-semibold">Specialty</th>
                    {/* Category column removed per request */}
                    {/* Location column removed as per request */}
                    <th className="px-3 py-2 text-left font-semibold hidden xl:table-cell">Languages</th>
                    <th className="px-3 py-2 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-black/20">
                  {therapists.map(t => (
                    <tr key={t.id} className="hover:bg-white/5 transition">
                      <td className="px-3 py-2 font-medium text-white">{t.name}</td>
                      <td className="px-3 py-2">{t.specialty}</td>
                      {/* Category cell removed */}
                      {/* Location cell removed */}
                      <td className="px-3 py-2 hidden xl:table-cell text-slate-400">{(t.languages||['English']).join(', ')}</td>
                      <td className="px-3 py-2">
                        <button onClick={()=>remove(t.id)} className="text-[11px] rounded-full bg-red-500/20 px-3 py-1 font-semibold text-red-200 hover:bg-red-500/30">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}