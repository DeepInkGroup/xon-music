import { createId } from './id';
import type { ChordEvent } from './types';
import type { ChordResult } from './chordDetector';

const HOLD_SECONDS = .26;
const signature = (chord: Pick<ChordResult, 'root' | 'quality' | 'midis'>): string =>
  chord.root === null || chord.quality === null ? '' : `${chord.root}:${chord.quality}:${chord.midis.join(',')}`;

/** Records only complete, repeated simultaneous evidence. Brief dropouts do not split a chord. */
export class ChordTracker {
  active: ChordEvent | null = null;
  onEnd: (event: ChordEvent) => void = () => {};
  private candidate = { signature: '', count: 0, since: 0 };
  private lastObserved = 0;
  private suppressedSubset = '';

  process(result: ChordResult, time: number): ChordResult {
    const key = result.status === 'detected' ? signature(result) : '';
    if (!result.midis.length) this.suppressedSubset = '';
    this.candidate = key === this.candidate.signature && key
      ? { ...this.candidate, count: this.candidate.count + 1 }
      : { signature: key, count: 1, since: time };
    if (this.active && key === signature(this.active)) this.lastObserved = time;
    const oldClasses = new Set(this.active?.midis.map(midi => midi % 12) ?? []);
    const newClasses = new Set(result.midis.map(midi => midi % 12));
    if (this.active && key && newClasses.size < oldClasses.size && [...newClasses].every(note => oldClasses.has(note))) this.suppressedSubset = key;
    if (key && this.candidate.count >= 2 && key !== (this.active && signature(this.active)) && key !== this.suppressedSubset) {
      this.close(Math.max(this.lastObserved, this.candidate.since));
      this.suppressedSubset = '';
      this.active = { id: createId(), onset: this.candidate.since, duration: 0,
        root: result.root!, bass: result.bass!, quality: result.quality!, midis: result.midis, confidence: result.confidence };
      this.lastObserved = time;
    } else if (this.active && time - this.lastObserved > HOLD_SECONDS) this.close(this.lastObserved);
    return this.active ? { ...this.active, status: 'detected' } : {
      status: 'uncertain', root: null, bass: null, quality: null, confidence: 0, midis: result.midis,
    };
  }

  snapshot(time: number): ChordEvent | null {
    return this.active ? { ...this.active, duration: Math.max(.06, Math.min(time, this.lastObserved + HOLD_SECONDS) - this.active.onset) } : null;
  }

  finish(time: number): void { this.close(Math.min(time, this.lastObserved + HOLD_SECONDS)); this.candidate = { signature: '', count: 0, since: 0 }; }
  reset(): void { this.active = null; this.candidate = { signature: '', count: 0, since: 0 }; this.lastObserved = 0; this.suppressedSubset = ''; }
  private close(time: number): void {
    if (!this.active) return;
    this.onEnd({ ...this.active, duration: Math.max(.06, time - this.active.onset) });
    this.active = null;
  }
}
