import type { NoteEvent } from '../music/types';
import { midiFrequency } from '../music/noteUtils';

export interface PlaybackPlan { id: string; midi: number; onset: number; duration: number; }
export function planPlayback(notes: NoteEvent[], position: number, speed: number): PlaybackPlan[] {
  return notes.filter(n => n.onset + n.duration > position).map(n => ({ id: n.id, midi: n.midi,
    onset: Math.max(0, n.onset - position) / speed, duration: Math.max(.015, (n.duration - Math.max(0, position - n.onset)) / speed) }));
}
export function recordingLength(notes: NoteEvent[]): number {
  return notes.reduce((end, note) => Math.max(end, note.onset + Math.max(.06, note.duration)), 0);
}

/** Synthesizes recorded symbolic notes. It does not claim to replay original microphone audio. */
export class SessionPlayer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private wave: PeriodicWave | null = null;
  private voices: { oscillator: OscillatorNode; gain: GainNode; filter: BiquadFilterNode }[] = [];
  private queue: PlaybackPlan[] = [];
  private timer: number | null = null;
  private origin = 0;
  private offset = 0;
  private speed = 1;
  private generation = 0;
  playing = false;
  get position(): number { return this.offset + (this.playing && this.context ? Math.max(0, this.context.currentTime - this.origin) * this.speed : 0); }
  prepare(): Promise<void> {
    if (!this.context || this.context.state === 'closed') {
      const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return Promise.reject(new Error('AudioContext unavailable'));
      this.context = new Constructor({ latencyHint: 'interactive' });
      this.master = this.context.createGain(); this.master.gain.value = .55;
      this.compressor = this.context.createDynamicsCompressor(); this.compressor.threshold.value = -14; this.compressor.ratio.value = 5;
      this.master.connect(this.compressor); this.compressor.connect(this.context.destination);
      this.wave = this.context.createPeriodicWave(new Float32Array(7), new Float32Array([0, 1, .48, .2, .1, .06, .025]));
    }
    return this.context.resume();
  }
  async play(notes: NoteEvent[], position: number, speed: number, volume: number): Promise<void> {
    this.halt(); const generation = this.generation;
    await this.prepare();
    if (generation !== this.generation || !this.context) return;
    this.offset = position; this.speed = speed; this.origin = this.context.currentTime + .045; this.playing = true;
    this.setVolume(volume); this.queue = planPlayback(notes, position, speed);
    this.schedule(); this.timer = window.setInterval(() => this.schedule(), 25);
  }
  private schedule(): void {
    const context = this.context; if (!context || !this.playing || !this.master || !this.wave) return;
    while (this.queue.length && this.origin + this.queue[0].onset < context.currentTime + .18) {
      const note = this.queue.shift()!;
      const requested = this.origin + note.onset;
      const when = Math.max(context.currentTime, requested);
      const duration = note.duration - Math.max(0, when - requested); if (duration <= .005) continue;
      const oscillator = context.createOscillator(), gain = context.createGain(), filter = context.createBiquadFilter();
      oscillator.frequency.value = midiFrequency(note.midi); oscillator.setPeriodicWave(this.wave);
      filter.type = 'lowpass'; filter.frequency.value = Math.min(12000, midiFrequency(note.midi) * 12);
      oscillator.connect(filter); filter.connect(gain); gain.connect(this.master);
      gain.gain.setValueAtTime(.0001, when); gain.gain.exponentialRampToValueAtTime(.19, when + Math.min(.008, duration / 3));
      gain.gain.exponentialRampToValueAtTime(.055, when + Math.max(.01, duration));
      gain.gain.exponentialRampToValueAtTime(.0001, when + duration + .09);
      const voice = { oscillator, gain, filter }; this.voices.push(voice);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); filter.disconnect(); this.voices = this.voices.filter(v => v !== voice); };
      oscillator.start(when); oscillator.stop(when + duration + .1);
    }
  }
  setVolume(volume: number): void { if (this.context && this.master) this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.context.currentTime, .015); }
  halt(): void {
    this.offset = this.position; this.playing = false; this.generation++;
    if (this.timer !== null) clearInterval(this.timer); this.timer = null; this.queue = [];
    for (const voice of this.voices) { voice.oscillator.onended = null; try { voice.oscillator.stop(); } catch { /* Already ended. */ } voice.oscillator.disconnect(); voice.gain.disconnect(); voice.filter.disconnect(); }
    this.voices = [];
  }
  async dispose(): Promise<void> { this.halt(); const context = this.context; this.context = null; if (context && context.state !== 'closed') await context.close(); }
}
