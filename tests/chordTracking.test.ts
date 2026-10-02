import { describe, expect, it } from 'vitest';
import { detectChord } from '../src/music/chordDetector';
import { ChordTracker } from '../src/music/chordTracker';
import { midiFrequency } from '../src/music/noteUtils';
import type { ChordEvent } from '../src/music/types';

const chord = (midis: number[]) => detectChord(midis.map(midi => ({ midi, frequency: midiFrequency(midi), confidence: .9 })));

describe('measured chord event tracking', () => {
  it('requires repeated simultaneous evidence and tolerates brief microphone dropouts', () => {
    const tracker = new ChordTracker(), ended: ChordEvent[] = [];
    tracker.onEnd = event => ended.push(event);
    expect(tracker.process(chord([60, 64, 67]), 0).status).toBe('uncertain');
    expect(tracker.process(chord([60, 64, 67]), .046).quality).toBe('major');
    expect(tracker.process(chord([60, 67]), .10).quality).toBe('major');
    expect(tracker.process(chord([60, 64, 67]), .15).quality).toBe('major');
    expect(tracker.process(chord([60, 64, 67]), .20).quality).toBe('major');
    expect(ended).toHaveLength(0);
    tracker.process(chord([]), .55);
    expect(ended).toHaveLength(1);
    expect(ended[0].root).toBe(0);
    expect(ended[0].duration).toBeGreaterThan(.15);
    expect(ended[0].duration).toBeLessThan(.3);
  });

  it('does not turn the decay of a seventh chord into a new triad event', () => {
    const tracker = new ChordTracker(), ended: ChordEvent[] = [];
    tracker.onEnd = event => ended.push(event);
    tracker.process(chord([55, 59, 62, 65]), 0);
    tracker.process(chord([55, 59, 62, 65]), .05);
    expect(tracker.process(chord([55, 59, 62]), .1).quality).toBe('dominant7');
    expect(tracker.process(chord([55, 59, 62]), .15).quality).toBe('dominant7');
    expect(tracker.process(chord([55, 59, 62]), .4).status).toBe('uncertain');
    expect(tracker.process(chord([55, 59, 62]), .45).status).toBe('uncertain');
    expect(ended.map(event => event.quality)).toEqual(['dominant7']);
  });

  it('records a genuinely changed chord and retains its measured onset', () => {
    const tracker = new ChordTracker(), ended: ChordEvent[] = [];
    tracker.onEnd = event => ended.push(event);
    tracker.process(chord([60, 64, 67]), .2);
    tracker.process(chord([60, 64, 67]), .25);
    tracker.process(chord([57, 60, 64]), .5);
    expect(tracker.process(chord([57, 60, 64]), .55).quality).toBe('minor');
    tracker.finish(.8);
    expect(ended.map(event => [event.root, event.quality])).toEqual([[0, 'major'], [9, 'minor']]);
    expect(ended[1].onset).toBe(.5);
  });
});
