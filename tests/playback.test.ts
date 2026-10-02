import { expect, it } from 'vitest';
import { planPlayback, recordingLength } from '../src/audio/sessionPlayer';
import { groupNotes } from '../src/music/noteGroups';
import { midiFrequency, mapFrequency } from '../src/music/noteUtils';
import { midiExporter, musicXmlExporter } from '../src/session/exports';
import type { NoteEvent, PracticeSession } from '../src/music/types';
function note(midi: number, onset: number, duration: number): NoteEvent {
  return { ...mapFrequency(midiFrequency(midi)), id: `${midi}:${onset}`, onset, duration, confidence: .95, rhythm: 'q', bpm: 120, ended: true };
}
const notes = [note(60, 1, 1), note(64, 1, .5), note(67, 1, 1), note(69, 3, 1)];
it('preserves simultaneous notes and silence in a playback plan', () => {
  expect(planPlayback(notes, 0, 1).map(n => [n.midi, n.onset, n.duration])).toEqual([[60, 1, 1], [64, 1, .5], [67, 1, 1], [69, 3, 1]]);
  expect(recordingLength(notes)).toBe(4);
});
it('seeking resumes remaining held notes without replaying ended voices', () => {
  expect(planPlayback(notes, 1.6, 1).map(n => [n.midi, n.onset])).toEqual([[60, 0], [67, 0], [69, 1.4]]);
  expect(planPlayback(notes, 1.6, 1)[0].duration).toBeCloseTo(.4);
});
it('speed scales onset and duration together without changing pitches', () => {
  expect(planPlayback(notes, 0, 2).map(n => [n.midi, n.onset, n.duration])).toEqual([[60, .5, .5], [64, .5, .25], [67, .5, .5], [69, 1.5, .5]]);
});
it('groups simultaneous voices for notation but preserves separate articulation', () => {
  expect(groupNotes(notes).map(g => g.notes.map(n => n.midi))).toEqual([[60, 64, 67], [69]]);
  expect(groupNotes([note(60, 0, .02), note(64, .04, .5)])).toHaveLength(2);
});
it('exports simultaneous notes as actual MusicXML chords on aligned staves', () => {
  const session: PracticeSession = { version: 2, id: 'chord', bpm: 120, startedAt: '2026-10-01T00:00:00Z', elapsed: 4, notes: [note(48, 0, .5), note(60, 0, .5), note(64, 0, .5), note(67, 0, .5)] };
  const xml = musicXmlExporter.serialize(session, 'sharps') as string;
  expect(xml.match(/<chord\/>/g)).toHaveLength(2); expect(xml).toContain('<backup><duration>2</duration></backup>');
  const midi = midiExporter.serialize(session, 'sharps') as Uint8Array;
  expect([...midi].filter(byte => byte === 0x90)).toHaveLength(4);
});
