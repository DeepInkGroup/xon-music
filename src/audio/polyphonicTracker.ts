import { NoteTracker } from './noteTracker';
import type { NoteEvent, PitchFrame } from '../music/types';
export class PolyphonicTracker {
  private voices = new Map<number, NoteTracker>();
  private mono = new NoteTracker();
  onStart: (note: NoteEvent) => void = () => {};
  onEnd: (note: NoteEvent) => void = () => {};
  onUpdate: (note: NoteEvent) => void = () => {};
  get active(): NoteEvent[] { return [this.mono.active, ...[...this.voices.values()].map(v => v.active)].filter((n): n is NoteEvent => n !== null); }
  private connect(tracker: NoteTracker): void {
    tracker.onStart = note => this.onStart(note); tracker.onEnd = note => this.onEnd(note); tracker.onUpdate = note => this.onUpdate(note);
  }
  process(frame: PitchFrame, time: number, bpm: number): void {
    if (frame.mode !== 'chords') { this.connect(this.mono); this.mono.process(frame, time, bpm); return; }
    const pitches = frame.pitches ?? [];
    for (const pitch of pitches) if (!this.voices.has(pitch.midi)) {
      const voice = new NoteTracker(.7, pitches.length > 1 ? 3 : 2, false); this.connect(voice); this.voices.set(pitch.midi, voice);
    }
    for (const [midi, voice] of this.voices) {
      const pitch = pitches.find(p => p.midi === midi);
      voice.process({ ...frame, frequency: pitch?.frequency ?? null, confidence: pitch?.confidence ?? 0 }, time, bpm);
      if (!pitch && !voice.active) this.voices.delete(midi);
    }
  }
  finish(time: number): void { this.mono.finish(time); for (const voice of this.voices.values()) voice.finish(time); this.voices.clear(); }
  reset(): void { this.mono.reset(); this.voices.clear(); }
}
