import { describe, expect, it } from 'vitest';
import { downsample, YinDetector } from '../src/audio/pitchDetector';
import { dbToAmplitude, rmsLevel } from '../src/audio/noiseGate';
import { mapFrequency, midiFrequency, midiName } from '../src/music/noteUtils';
import { quantizeDuration } from '../src/music/rhythmDetector';
import { NoteTracker } from '../src/audio/noteTracker';
import type { NoteEvent, PitchFrame } from '../src/music/types';

function tone(frequency: number, sampleRate: number, harmonic = false) {
  return Float32Array.from({ length: sampleRate <= 48000 ? 8192 : 16384 }, (_, i) => {
    const t = i / sampleRate;
    return harmonic ? 0.14 * Math.sin(2 * Math.PI * frequency * t) + 0.21 * Math.sin(4 * Math.PI * frequency * t) + 0.07 * Math.sin(6 * Math.PI * frequency * t) : 0.3 * Math.sin(2 * Math.PI * frequency * t);
  });
}
describe('real signal YIN detection', () => {
  const detector = new YinDetector();
  for (const rate of [44100, 48000, 96000]) for (const midi of [21, 33, 48, 60, 61, 69, 81, 96, 108]) {
    it(`${midiName(midi)} at ${rate} Hz`, () => {
      const reduced = downsample(tone(midiFrequency(midi), rate), rate);
      const pitch = detector.detect(reduced.samples, reduced.sampleRate);
      expect(pitch.frequency).not.toBeNull();
      expect(mapFrequency(pitch.frequency!).midi).toBe(midi);
      expect(Math.abs(1200 * Math.log2(pitch.frequency! / midiFrequency(midi)))).toBeLessThan(midi > 96 ? 40 : 12);
      expect(pitch.confidence).toBeGreaterThan(0.9);
    });
  }
  for (const midi of [33, 48, 60, 69, 81]) it(`finds fundamental of harmonic-rich ${midiName(midi)}`, () => {
    const reduced = downsample(tone(midiFrequency(midi), 48000, true), 48000);
    const pitch = detector.detect(reduced.samples, reduced.sampleRate);
    expect(mapFrequency(pitch.frequency!).midi).toBe(midi);
  });
  it('rejects silence and non-periodic noise', () => {
    expect(detector.detect(new Float32Array(4096), 24000).frequency).toBeNull();
    let seed = 42;
    const noise = Float32Array.from({ length: 4096 }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed / 2 ** 32 - 0.5) * 0.5; });
    expect(detector.detect(noise, 24000).frequency).toBeNull();
    expect(rmsLevel(new Float32Array(4096)).rms).toBeLessThan(dbToAmplitude(-45));
  });
  it('reports signed tuning deviation', () => {
    expect(mapFrequency(440 * 2 ** (20 / 1200)).cents).toBeCloseTo(20, 5);
    expect(mapFrequency(440 * 2 ** (-20 / 1200)).cents).toBeCloseTo(-20, 5);
    expect(midiName(61, 'flats')).toBe('Db4');
  });
});
function frame(frequency: number | null, rms = 0.1): PitchFrame {
  return { frequency, rms, peak: rms * 2, confidence: frequency ? 0.97 : 0, processingMs: 2, sampleRate: 48000, windowMs: 170, timestamp: 0 };
}
describe('note segmentation and approximate rhythm', () => {
  it('requires two stable frames, sustains a note, ends it on silence, and switches pitch', () => {
    const tracker = new NoteTracker(), started: NoteEvent[] = [], ended: NoteEvent[] = [];
    tracker.onStart = n => started.push(n); tracker.onEnd = n => ended.push(n);
    tracker.process(frame(261.6256), 0, 120); expect(started).toHaveLength(0);
    tracker.process(frame(261.6256), 0.043, 120); expect(started).toHaveLength(1);
    tracker.process(frame(261.7), 0.5, 120); expect(started).toHaveLength(1);
    tracker.process(frame(null, 0), 0.57, 120); expect(tracker.active?.midi).toBe(60);
    tracker.process(frame(null, 0), 0.7, 120); expect(tracker.active).toBeNull();
    expect(ended[0].duration).toBeCloseTo(0.5); expect(ended[0].rhythm).toBe('q');
    tracker.process(frame(440), 0.8, 120); tracker.process(frame(440), 0.85, 120);
    tracker.process(frame(493.88), 1, 120); tracker.process(frame(493.88), 1.05, 120);
    expect(started.map(n => n.midi)).toEqual([60, 69, 71]); expect(ended).toHaveLength(2);
  });
  it('does not create notes from low-confidence pitch frames', () => {
    const tracker = new NoteTracker();
    for (let i = 0; i < 20; i++) tracker.process({ ...frame(440), confidence: 0.4 }, i * 0.04, 120);
    expect(tracker.active).toBeNull();
  });
  it('separates an amplitude valley and new attack on the same pitch', () => {
    const tracker = new NoteTracker(); const starts: NoteEvent[] = [];
    tracker.onStart = n => starts.push(n);
    tracker.process(frame(440, .1), 0, 120); tracker.process(frame(440, .1), .04, 120);
    tracker.process(frame(440, .03), .4, 120); tracker.process(frame(440, .13), .5, 120);
    expect(starts).toHaveLength(2);
  });
  it('maps duration against configurable BPM', () => {
    expect(quantizeDuration(.25, 120)).toBe('8'); expect(quantizeDuration(.5, 120)).toBe('q');
    expect(quantizeDuration(1, 120)).toBe('h'); expect(quantizeDuration(2, 120)).toBe('w');
    expect(quantizeDuration(1, 60)).toBe('q');
  });
});
