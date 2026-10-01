export function rmsLevel(samples: Float32Array): { rms: number; peak: number } {
  let energy = 0, peak = 0;
  for (const sample of samples) { energy += sample * sample; peak = Math.max(peak, Math.abs(sample)); }
  return { rms: Math.sqrt(energy / samples.length), peak };
}
export function dbToAmplitude(db: number): number { return 10 ** (db / 20); }
