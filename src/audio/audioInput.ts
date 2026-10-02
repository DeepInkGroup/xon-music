import type { DetectionMode, PitchFrame } from '../music/types';

export class AudioInput {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private capture: AudioWorkletNode | null = null;
  private worker: Worker | null = null;
  private cancelled = false;
  gateDb = -45;
  mode: DetectionMode = 'chords';
  onFrame: (frame: PitchFrame) => void = () => {};
  onInterrupted: () => void = () => {};
  get currentTime(): number { return this.context?.currentTime ?? 0; }

  async start(): Promise<void> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('secure');
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) throw new Error('unsupported');
    // Create and resume synchronously inside the user gesture (especially iOS).
    const context = new AudioContextClass({ latencyHint: 'interactive' });
    this.context = context;
    try {
      const resumed = context.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: { ideal: 1 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      } });
      if (this.cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      await resumed;
      if (!context.audioWorklet) throw new Error('unsupported');
      await context.audioWorklet.addModule(`${import.meta.env.BASE_URL}audio/capture.worklet.js`);
      if (this.cancelled) return;
      this.worker = new Worker(new URL('./pitch.worker.ts', import.meta.url), { type: 'module' });
      this.capture = new AudioWorkletNode(context, 'piano-capture');
      this.worker.onmessage = ({ data }: MessageEvent<PitchFrame>) => {
        if (!this.cancelled) { this.onFrame(data); this.capture?.port.postMessage('ready'); }
      };
      this.worker.onerror = () => this.onInterrupted();
      this.capture.onprocessorerror = () => this.onInterrupted();
      this.capture.port.onmessage = ({ data }: MessageEvent<{ samples: Float32Array; sampleRate: number; timestamp: number }>) => {
        this.worker?.postMessage({ ...data, gateDb: this.gateDb, mode: this.mode }, [data.samples.buffer]);
      };
      this.source = context.createMediaStreamSource(stream);
      this.source.connect(this.capture);
      this.capture.connect(context.destination);
      stream.getAudioTracks().forEach(track => track.addEventListener('ended', this.onInterrupted));
      context.onstatechange = () => { if (!this.cancelled && context.state !== 'running') this.onInterrupted(); };
    } catch (error) { await this.stop(); throw error; }
  }
  async stop(): Promise<void> {
    this.cancelled = true;
    this.capture?.disconnect(); this.source?.disconnect();
    this.worker?.terminate(); this.worker = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    const context = this.context; this.context = null;
    if (context && context.state !== 'closed') await context.close();
    this.capture = null; this.source = null;
  }
}
