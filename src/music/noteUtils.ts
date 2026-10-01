import type { MusicalPitch, Spelling } from './types';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SOLFEGE = ['Do', 'Di / Ra', 'Re', 'Ri / Me', 'Mi', 'Fa', 'Fi / Se', 'Sol', 'Si / Le', 'La', 'Li / Te', 'Ti'];

export function midiFrequency(midi: number): number { return 440 * 2 ** ((midi - 69) / 12); }
export function midiName(midi: number, spelling: Spelling = 'sharps'): string {
  return `${(spelling === 'sharps' ? SHARPS : FLATS)[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
export function mapFrequency(frequency: number, spelling: Spelling = 'sharps'): MusicalPitch {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const octave = Math.floor(midi / 12) - 1;
  const referenceFrequency = midiFrequency(midi);
  return { midi, name: midiName(midi, spelling), pitchClass: (spelling === 'sharps' ? SHARPS : FLATS)[midi % 12], octave,
    solfege: SOLFEGE[midi % 12], frequency, referenceFrequency, cents: 1200 * Math.log2(frequency / referenceFrequency) };
}
export function formatTime(seconds: number, milliseconds = false): string {
  const total = Math.max(0, Math.round(seconds * 1000));
  return `${String(Math.floor(total / 60000)).padStart(2, '0')}:${String(Math.floor(total / 1000) % 60).padStart(2, '0')}${milliseconds ? `.${String(total % 1000).padStart(3, '0')}` : ''}`;
}
export function isBlack(midi: number): boolean { return [1, 3, 6, 8, 10].includes(midi % 12); }
