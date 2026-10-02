import { midiName } from './noteUtils';
import type { ChordQuality, DetectedPitch, Spelling } from './types';

export interface PolyphonicFrame { pitches: DetectedPitch[]; timestamp: number; }
export interface ChordResult {
  status: 'uncertain' | 'detected'; root: number | null; bass: number | null;
  quality: ChordQuality | null; confidence: number; midis: number[];
}
const SHAPES: { quality: ChordQuality; intervals: number[] }[] = [
  { quality: 'major', intervals: [0, 4, 7] }, { quality: 'minor', intervals: [0, 3, 7] },
  { quality: 'diminished', intervals: [0, 3, 6] }, { quality: 'augmented', intervals: [0, 4, 8] },
  { quality: 'sus2', intervals: [0, 2, 7] }, { quality: 'sus4', intervals: [0, 5, 7] },
  { quality: 'dominant7', intervals: [0, 4, 7, 10] }, { quality: 'major7', intervals: [0, 4, 7, 11] },
  { quality: 'minor7', intervals: [0, 3, 7, 10] }, { quality: 'halfDiminished7', intervals: [0, 3, 6, 10] },
  { quality: 'diminished7', intervals: [0, 3, 6, 9] },
];
// Exact simultaneous pitch-class matching. Extra/missing notes are never invented.
export function detectChord(pitches: DetectedPitch[]): ChordResult {
  const sorted = [...pitches].sort((a, b) => a.midi - b.midi);
  const midis = sorted.map(p => p.midi), classes = [...new Set(midis.map(n => n % 12))];
  const unknown: ChordResult = { status: 'uncertain', root: null, bass: midis[0] ?? null, quality: null, confidence: 0, midis };
  if (classes.length < 3 || classes.length > 4 || sorted.some(p => p.confidence < 0.7)) return unknown;
  const matches: { root: number; quality: ChordQuality }[] = [];
  for (const root of classes) for (const shape of SHAPES) {
    if (classes.length === shape.intervals.length && shape.intervals.every(interval => classes.includes((root + interval) % 12))) matches.push({ root, quality: shape.quality });
  }
  if (!matches.length) return unknown;
  const match = matches.find(m => m.root === midis[0] % 12) ?? (matches.length === 1 ? matches[0] : null);
  if (!match) return unknown;
  return { status: 'detected', root: match.root, bass: midis[0] % 12, quality: match.quality,
    confidence: Math.min(...sorted.map(p => p.confidence)), midis };
}
export function chordRootName(root: number, spelling: Spelling): string { return midiName(root + 60, spelling).slice(0, -1); }
export const CHORD_SYMBOLS: Record<ChordQuality, string> = { major: '', minor: 'm', diminished: 'dim', augmented: 'aug', sus2: 'sus2', sus4: 'sus4', dominant7: '7', major7: 'maj7', minor7: 'm7', halfDiminished7: 'm7b5', diminished7: 'dim7' };
export function chordSymbol(chord: Pick<ChordResult, 'root' | 'bass' | 'quality'>, spelling: Spelling = 'sharps'): string {
  if (chord.root === null || !chord.quality) return '—';
  return `${chordRootName(chord.root, spelling)}${CHORD_SYMBOLS[chord.quality]}${chord.bass !== null && chord.bass !== chord.root ? `/${chordRootName(chord.bass, spelling)}` : ''}`;
}
