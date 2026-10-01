import { downsample, YinDetector } from './pitchDetector';
import { dbToAmplitude, rmsLevel } from './noiseGate';
import type { PitchFrame } from '../music/types';

const detector = new YinDetector();
type AnalysisMessage = { samples: Float32Array; sampleRate: number; timestamp: number; gateDb: number };
self.onmessage = ({ data }: MessageEvent<AnalysisMessage>) => {
  const started = performance.now();
  const { rms, peak } = rmsLevel(data.samples);
  const reduced = downsample(data.samples, data.sampleRate);
  const pitch = rms >= dbToAmplitude(data.gateDb) ? detector.detect(reduced.samples, reduced.sampleRate) : { frequency: null, confidence: 0 };
  const frame: PitchFrame = { ...pitch, rms, peak, processingMs: performance.now() - started,
    sampleRate: data.sampleRate, windowMs: data.samples.length / data.sampleRate * 1000, timestamp: data.timestamp };
  self.postMessage(frame);
};
