/** Radix-2 FFT of a DC-removed Hann window, with 2× zero padding for peak interpolation. */
export function magnitudeSpectrum(samples: Float32Array): Float64Array {
  let size = 1; while (size < samples.length * 2) size <<= 1;
  const real = new Float64Array(size), imag = new Float64Array(size);
  let mean = 0; for (const sample of samples) mean += sample; mean /= samples.length;
  for (let i = 0; i < samples.length; i++) real[i] = (samples[i] - mean) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (samples.length - 1)));
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { const value = real[i]; real[i] = real[j]; real[j] = value; }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = -2 * Math.PI / length, cosine = Math.cos(angle), sine = Math.sin(angle);
    for (let start = 0; start < size; start += length) {
      let wr = 1, wi = 0;
      for (let offset = 0; offset < length / 2; offset++) {
        const a = start + offset, b = a + length / 2;
        const tr = wr * real[b] - wi * imag[b], ti = wr * imag[b] + wi * real[b];
        real[b] = real[a] - tr; imag[b] = imag[a] - ti; real[a] += tr; imag[a] += ti;
        const next = wr * cosine - wi * sine; wi = wr * sine + wi * cosine; wr = next;
      }
    }
  }
  return Float64Array.from({ length: size / 2 }, (_, i) => Math.hypot(real[i], imag[i]));
}
export interface SpectralPeak { frequency: number; amplitude: number; bin: number; }
export function spectralPeaks(spectrum: Float64Array, sampleRate: number): SpectralPeak[] {
  const binHz = sampleRate / (spectrum.length * 2), peaks: SpectralPeak[] = [];
  let maximum = 0; for (const value of spectrum) maximum = Math.max(maximum, value);
  if (!maximum) return [];
  for (let i = 2; i < spectrum.length - 2; i++) {
    if (spectrum[i] < maximum * .025 || spectrum[i] <= spectrum[i - 1] || spectrum[i] <= spectrum[i + 1]) continue;
    const a = Math.log(spectrum[i - 1] + 1e-12), b = Math.log(spectrum[i] + 1e-12), c = Math.log(spectrum[i + 1] + 1e-12);
    const shift = Math.max(-.5, Math.min(.5, .5 * (a - c) / (a - 2 * b + c)));
    peaks.push({ frequency: (i + shift) * binHz, amplitude: spectrum[i], bin: i });
  }
  return peaks;
}
