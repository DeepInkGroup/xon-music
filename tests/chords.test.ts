import { describe, expect, it } from 'vitest';
import { PolyphonicDetector } from '../src/audio/polyphonicDetector';
import { detectChord, chordSymbol } from '../src/music/chordDetector';
import { midiFrequency } from '../src/music/noteUtils';
import { downsample } from '../src/audio/pitchDetector';
import { PolyphonicTracker } from '../src/audio/polyphonicTracker';
import type { NoteEvent, PitchFrame } from '../src/music/types';

function chordAudio(midis: number[], rate = 48000, harmonics = [1, .65, .35, .18, .12, .08]): Float32Array {
  return Float32Array.from({ length: rate <= 48000 ? 8192 : 16384 }, (_, i) => midis.reduce((sum, midi, j) => {
    const frequency = midiFrequency(midi);
    return sum + harmonics.reduce((v, gain, h) => v + gain * Math.sin(2 * Math.PI * frequency * (h + 1) * i / rate + j * .7), 0) * .15 / midis.length;
  }, 0));
}
describe('simultaneous microphone signal decomposition', () => {
  const detector = new PolyphonicDetector();
  const cases: [number[], string][] = [[[60, 64, 67], 'C'], [[57, 60, 64], 'Am'], [[55, 59, 62, 65], 'G7'], [[64, 67, 72], 'C/E'], [[48, 52, 55], 'C'], [[60, 64, 67, 71], 'Cmaj7'], [[60, 63, 67, 70], 'Cm7']];
  for (const rate of [44100, 48000, 96000]) for (const [midis, symbol] of cases) it(`${symbol} (${midis}) at ${rate} Hz`, () => {
    const reduced = downsample(chordAudio(midis, rate), rate);
    const result = detector.detect(reduced.samples, reduced.sampleRate);
    expect(result.pitches.map(p => p.midi)).toEqual(midis);
    expect(chordSymbol(detectChord(result.pitches))).toBe(symbol);
  });
  for (const harmonics of [[1], [1, .8, .3], [.6, 1, .5, .15], [1, .3, .14, .08]]) it(`no fabricated chord from one note with partials ${harmonics}`, () => {
    const reduced = downsample(chordAudio([60], 48000, harmonics), 48000);
    const result = detector.detect(reduced.samples, reduced.sampleRate);
    expect(result.pitches.map(p => p.midi)).toEqual([60]); expect(detectChord(result.pitches).status).toBe('uncertain');
  });
  it('rejects silence, noise, incomplete and unsupported clusters', () => {
    expect(detector.detect(new Float32Array(4096), 24000).pitches).toEqual([]);
    let seed = 8; const noise = Float32Array.from({ length: 4096 }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 - .5; });
    expect(detector.detect(noise, 24000).pitches).toEqual([]);
    for (const midis of [[60, 64], [60, 61, 68]]) expect(detectChord(midis.map(midi => ({ midi, frequency: midiFrequency(midi), confidence: .95 }))).status).toBe('uncertain');
  });
  it('tracks independent voices, persists a held note and releases each ended note', () => {
    const tracker = new PolyphonicTracker(), starts: NoteEvent[] = [], ends: NoteEvent[] = [];
    tracker.onStart = n => starts.push(n); tracker.onEnd = n => ends.push(n);
    const frame = (midis: number[]): PitchFrame => ({ mode: 'chords', pitches: midis.map(midi => ({ midi, frequency: midiFrequency(midi), confidence: .95 })), frequency: null, confidence: 0, rms: .1, peak: .3, sampleRate: 48000, timestamp: 0, windowMs: 170, processingMs: 2 });
    for (const time of [0, .04, .08, .3]) tracker.process(frame([60, 64, 67]), time, 120);
    expect(starts.map(n => n.midi)).toEqual([60, 64, 67]);
    tracker.process(frame([60]), .4, 120); tracker.process(frame([60]), .5, 120);
    expect(tracker.active.map(n => n.midi)).toEqual([60]); expect(ends.map(n => n.midi)).toEqual([64, 67]);
    tracker.finish(.8); expect(tracker.active).toHaveLength(0);
  });
});
