export interface PitchResult { frequency: number | null; confidence: number; }
export interface PitchDetector { detect(samples: Float32Array, sampleRate: number): PitchResult; }

/** YIN: cumulative mean normalized difference, first trough, parabolic refinement.
 * Confidence is 1 - normalized difference, a periodicity measure, not instrument identification.
 */
export class YinDetector implements PitchDetector {
  private difference = new Float64Array(4096);
  detect(samples: Float32Array, sampleRate: number): PitchResult {
    const minTau = Math.max(2, Math.floor(sampleRate / 4300));
    const maxTau = Math.min(Math.ceil(sampleRate / 27), Math.floor(samples.length / 2) - 1);
    if (maxTau <= minTau) return { frequency: null, confidence: 0 };
    if (this.difference.length <= maxTau + 1) this.difference = new Float64Array(maxTau + 2);
    const yin = this.difference;
    const window = Math.floor(samples.length / 2);
    let running = 0;
    yin[0] = 1;
    for (let tau = 1; tau <= maxTau; tau++) {
      let sum = 0;
      for (let i = 0; i < window; i++) { const delta = samples[i] - samples[i + tau]; sum += delta * delta; }
      running += sum;
      yin[tau] = running === 0 ? 1 : sum * tau / running;
    }
    let candidate = -1;
    for (let tau = minTau; tau < maxTau; tau++) {
      if (yin[tau] < 0.15) {
        while (tau + 1 <= maxTau && yin[tau + 1] < yin[tau]) tau++;
        candidate = tau; break;
      }
    }
    if (candidate < 0) return { frequency: null, confidence: 0 };
    const confidence = Math.max(0, Math.min(1, 1 - yin[candidate]));
    const left = yin[candidate - 1], center = yin[candidate], right = yin[candidate + 1] ?? center;
    const denominator = 2 * (2 * center - right - left);
    const correction = denominator === 0 ? 0 : (right - left) / denominator;
    const frequency = sampleRate / (candidate + Math.max(-1, Math.min(1, correction)));
    return frequency >= 27 && frequency <= 4300 ? { frequency, confidence } : { frequency: null, confidence: 0 };
  }
}

/** Reduce work without moving pitch analysis onto the realtime audio thread. */
export function downsample(samples: Float32Array, sampleRate: number): { samples: Float32Array; sampleRate: number } {
  const factor = Math.max(1, Math.floor(sampleRate / 22050));
  if (factor === 1) return { samples, sampleRate };
  const output = new Float32Array(Math.floor(samples.length / factor));
  for (let i = 0; i < output.length; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += samples[i * factor + j];
    output[i] = sum / factor;
  }
  return { samples: output, sampleRate: sampleRate / factor };
}
