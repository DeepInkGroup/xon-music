import type { RhythmValue } from './types';
export const RHYTHM_BEATS: Record<RhythmValue, number> = { '8': 0.5, q: 1, h: 2, w: 4 };
// Nearest supported duration, in beats. Kept separate for future quantization.
export function quantizeDuration(seconds: number, bpm: number): RhythmValue {
  const beats = seconds * bpm / 60;
  return (Object.keys(RHYTHM_BEATS) as RhythmValue[]).reduce((best, value) =>
    Math.abs(beats - RHYTHM_BEATS[value]) < Math.abs(beats - RHYTHM_BEATS[best]) ? value : best, '8');
}
