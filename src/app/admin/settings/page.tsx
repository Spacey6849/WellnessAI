"use client";
import { useEffect, useState } from 'react';

interface Setting { key:string; value:unknown; description?:string }

export default function AdminSettingsPage(){
  const [settings,setSettings]=useState<Setting[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [editing,setEditing]=useState<Setting|null>(null);
  const [valueText,setValueText]=useState('');

  const load=async()=>{
    setLoading(true); setError(null);
    try {
      const res=await fetch('/api/admin/settings');
      const json=await res.json();
      if(!res.ok) throw new Error(json.error||'Failed');
      setSettings(json.settings||[]);
    } catch(e){ const err=e as Error; setError(err.message);} finally { setLoading(false);} }
  useEffect(()=>{ load(); },[]);

  const startEdit=(s:Setting)=>{ setEditing(s); setValueText(JSON.stringify(s.value, null, 2)); };
  const cancel=()=>{ setEditing(null); setValueText(''); };
  const save=async()=>{
    if(!editing) return;
  let parsed:unknown; try { parsed=JSON.parse(valueText||'{}'); } catch { setError('Invalid JSON'); return; }
    const res=await fetch('/api/admin/settings',{method:'POST', headers:{'Content-Type':'application/json','x-role':'admin'}, body:JSON.stringify({ key: editing.key, value: parsed })});
    const json=await res.json();
    if(!res.ok){ setError(json.error||'Failed'); return; }
    cancel(); load();
  };

  return (
    <div className="mx-auto max-w-5xl w-full py-12 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white">App Settings</h1>
        <p className="text-slate-300 text-sm">Feature flags and configuration.</p>
      </header>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading ? <p className="text-slate-400 text-sm">Loading...</p> : (
        <div className="grid gap-6 md:grid-cols-2">
          {settings.map(s => (
            <div key={s.key} className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{s.key}</p>
                  {s.description && <p className="text-xs text-slate-400 mt-1">{s.description}</p>}
                </div>
                <button onClick={()=>startEdit(s)} className="text-xs rounded-full bg-blue-500/20 px-3 py-1 font-semibold text-blue-200 hover:bg-blue-500/30">Edit</button>
              </div>
              <pre className="text-[11px] leading-relaxed rounded-xl bg-black/40 p-3 text-slate-300 overflow-x-auto whitespace-pre">{JSON.stringify(s.value,null,2)}</pre>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Edit {editing.key}</h2>
            <textarea value={valueText} onChange={e=>setValueText(e.target.value)} className="h-60 w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-[12px] text-white font-mono outline-none focus:border-blue-400" />
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={cancel} className="rounded-full border border-white/10 px-4 py-1.5 text-xs text-slate-300 hover:bg-white/10">Cancel</button>
              <button onClick={save} className="rounded-full bg-blue-600 px-5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}