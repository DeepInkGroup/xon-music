import type { PracticeSession } from '../music/types';
import { createId } from '../music/id';
const KEY = 'xon-music.sessions.v1';
export function newSession(bpm = 120): PracticeSession {
  return { version: 1, id: createId(), startedAt: new Date().toISOString(), bpm, elapsed: 0, notes: [] };
}
export function readSessions(): PracticeSession[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is PracticeSession => s?.version === 1 && typeof s.id === 'string' &&
      typeof s.startedAt === 'string' && Number.isFinite(s.bpm) && Number.isFinite(s.elapsed) && Array.isArray(s.notes) &&
      s.notes.every((n: unknown) => !!n && typeof n === 'object' && 'midi' in n && 'onset' in n && 'duration' in n &&
        Number.isFinite(n.midi) && Number.isFinite(n.onset) && Number.isFinite(n.duration)));
  } catch { return []; }
}
export function saveSession(session: PracticeSession): boolean {
  if (!session.notes.length) return true;
  try {
    const others = readSessions().filter(s => s.id !== session.id);
    const snapshot = { ...session, notes: session.notes.map(note => ({ ...note, ended: true })) };
    localStorage.setItem(KEY, JSON.stringify([snapshot, ...others].slice(0, 8)));
    return true;
  } catch { return false; }
}
export function readPreference<T extends string>(key: string, values: readonly T[], fallback: T): T {
  try { const value = localStorage.getItem(`xon-music.${key}`) as T; return values.includes(value) ? value : fallback; } catch { return fallback; }
}
export function writePreference(key: string, value: string): void {
  try { localStorage.setItem(`xon-music.${key}`, value); } catch { /* Session exports remain available. */ }
}
