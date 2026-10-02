import { mapFrequency } from '../music/noteUtils';
import { quantizeDuration } from '../music/rhythmDetector';
import { createId } from '../music/id';
import type { NoteEvent, PitchFrame } from '../music/types';

/** Pitch persistence, release hysteresis and same-note reattack segmentation. */
export class NoteTracker {
  constructor(private minimumConfidence = .85, private stableFrames = 2, private allowRetrigger = true) {}
  active: NoteEvent | null = null;
  private candidate: { midi: number; count: number; since: number } | null = null;
  private lastGoodTime = 0;
  private previousRms = 0;
  private valleyRms = Infinity;
  private lastRetrigger = 0;
  onStart: (note: NoteEvent) => void = () => {};
  onEnd: (note: NoteEvent) => void = () => {};
  onUpdate: (note: NoteEvent) => void = () => {};

  process(frame: PitchFrame, time: number, bpm: number): void {
    const good = frame.frequency !== null && frame.confidence >= this.minimumConfidence;
    const pitch = good ? mapFrequency(frame.frequency!) : null;
    if (!pitch || pitch.midi < 21 || pitch.midi > 108) {
      this.candidate = null;
      if (this.active && time - this.lastGoodTime > 0.14) this.finish(this.lastGoodTime);
      this.previousRms = frame.rms;
      return;
    }
    if (this.active?.midi === pitch.midi) {
      this.lastGoodTime = time;
      this.valleyRms = Math.min(this.valleyRms, frame.rms);
      // Require an amplitude valley and a rising attack, with a minimum interval.
      const reattack = this.allowRetrigger && time - this.lastRetrigger > 0.22 && frame.rms > this.valleyRms * 2.2 && frame.rms > this.previousRms * 1.3;
      if (reattack) {
        this.finish(time);
        this.begin(pitch.frequency, frame.confidence, time, bpm);
      } else {
        this.active = { ...this.active, ...pitch, confidence: frame.confidence, duration: Math.max(0, time - this.active.onset),
          rhythm: quantizeDuration(time - this.active.onset, this.active.bpm) };
        this.onUpdate(this.active);
      }
      this.candidate = null;
    } else {
      if (this.candidate?.midi === pitch.midi) this.candidate.count++;
      else this.candidate = { midi: pitch.midi, count: 1, since: time };
      if (this.candidate.count >= this.stableFrames) {
        const onset = this.candidate.since;
        this.finish(onset);
        this.begin(pitch.frequency, frame.confidence, onset, bpm);
        this.lastGoodTime = time;
        this.candidate = null;
      } else if (this.active && time - this.lastGoodTime > 0.14) {
        const candidate = this.candidate;
        this.finish(this.lastGoodTime);
        this.candidate = candidate;
      }
    }
    this.previousRms = frame.rms;
  }
  private begin(frequency: number, confidence: number, onset: number, bpm: number): void {
    this.active = { ...mapFrequency(frequency), id: createId(), onset, duration: 0, confidence, rhythm: '8', bpm, ended: false };
    this.lastGoodTime = onset; this.lastRetrigger = onset; this.valleyRms = this.previousRms || Infinity;
    this.onStart(this.active);
  }
  finish(time: number): void {
    if (this.active) {
      const duration = Math.max(0.06, time - this.active.onset);
      this.onEnd({ ...this.active, duration, rhythm: quantizeDuration(duration, this.active.bpm), ended: true });
    }
    this.active = null; this.candidate = null; this.valleyRms = Infinity;
  }
  reset(): void { this.active = null; this.candidate = null; this.previousRms = 0; this.valleyRms = Infinity; this.lastGoodTime = 0; }
}
