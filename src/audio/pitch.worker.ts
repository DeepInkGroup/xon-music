import { downsample, YinDetector } from './pitchDetector';
import { dbToAmplitude, rmsLevel } from './noiseGate';
import type { PitchFrame } from '../music/types';
import type { DetectionMode } from '../music/types';
import { PolyphonicDetector } from './polyphonicDetector';
import { mapFrequency } from '../music/noteUtils';

const detector = new YinDetector();
const polyphonic = new PolyphonicDetector();
type AnalysisMessage = { samples: Float32Array; sampleRate: number; timestamp: number; gateDb: number; mode: DetectionMode };
self.onmessage = ({ data }: MessageEvent<AnalysisMessage>) => {
  const started = performance.now();
  const { rms, peak } = rmsLevel(data.samples);
  const reduced = downsample(data.samples, data.sampleRate);
  const pitch = rms >= dbToAmplitude(data.gateDb) ? detector.detect(reduced.samples, reduced.sampleRate) : { frequency: null, confidence: 0 };
  const poly = data.mode === 'chords' && rms >= dbToAmplitude(data.gateDb) ? polyphonic.detect(reduced.samples, reduced.sampleRate) : { pitches: [], fit: 0 };
  const mono = pitch.frequency && pitch.confidence >= .85 ? [{ midi: mapFrequency(pitch.frequency).midi, frequency: pitch.frequency, confidence: pitch.confidence }] : [];
  const pitches = data.mode === 'single' ? mono : poly.pitches.length === 1 && mono[0]?.midi === poly.pitches[0].midi ? mono :
    poly.pitches.length === 0 && mono[0] && (mono[0].midi < 36 || mono[0].midi > 96) ? mono : poly.pitches;
  const frame: PitchFrame = { ...pitch, rms, peak, processingMs: performance.now() - started,
    sampleRate: data.sampleRate, windowMs: data.samples.length / data.sampleRate * 1000, timestamp: data.timestamp,
    mode: data.mode, pitches, spectralFit: poly.fit };
  self.postMessage(frame);
};
