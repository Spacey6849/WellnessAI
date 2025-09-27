import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface Therapist { id: string; name: string; specialty: string; category: string; location: string; languages: string[] }

const file = path.join(process.cwd(),'src','data','therapists.json');

async function ensure() {
  try { await fs.access(file); } catch { await fs.mkdir(path.dirname(file), {recursive:true}); await fs.writeFile(file,'[]'); }
}

export async function listTherapists(): Promise<Therapist[]> { await ensure(); return JSON.parse(await fs.readFile(file,'utf8')) as Therapist[]; }
export async function saveTherapists(list: Therapist[]) { await fs.writeFile(file, JSON.stringify(list,null,2)); }
export function newId() { return crypto.randomBytes(6).toString('hex'); }
export async function addTherapist(data: Omit<Therapist,'id'>): Promise<Therapist> { const list = await listTherapists(); const t: Therapist = { id: newId(), ...data }; list.push(t); await saveTherapists(list); return t; }