import type { NoteEvent } from './types';
export interface NoteGroup { onset: number; duration: number; notes: NoteEvent[]; }
/** Group near-simultaneous overlapping notes; never group a sequence that ended before the next onset. */
export function groupNotes(notes: NoteEvent[]): NoteGroup[] {
  const groups: NoteGroup[] = [];
  for (const note of [...notes].sort((a, b) => a.onset - b.onset || a.midi - b.midi)) {
    const previous = groups.at(-1);
    if (previous && note.onset - previous.onset <= .055 && previous.notes.every(n => !n.ended || n.onset + n.duration > note.onset)) {
      previous.notes.push(note); previous.duration = Math.max(previous.duration, note.duration);
    } else groups.push({ onset: note.onset, duration: note.duration, notes: [note] });
  }
  return groups;
}
