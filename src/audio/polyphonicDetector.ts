import { mapFrequency, midiFrequency } from '../music/noteUtils';
import type { DetectedPitch } from '../music/types';
import { magnitudeSpectrum, spectralPeaks, type SpectralPeak } from './spectrum';

interface Candidate { midi: number; frequency: number; fundamental: SpectralPeak; partials: (SpectralPeak | undefined)[]; coefficient: number; }
const HARMONICS = [1, .65, .35, .18, .12, .08, .05, .04];
/** Experimental multi-pitch spectral decomposition. Requires directly observed fundamentals.
 * Sparse nonnegative least squares assigns observed harmonic peaks to note templates.
 * Novel-partial checks suppress octave/upper-harmonic ghosts instead of claiming ambiguous notes.
 */
export class PolyphonicDetector {
  private previousSpectrum: Float64Array | null = null;
  private previousRate = 0;
  private previousRms = 0;
  private frameNumber = 0;
  private lastAttackFrame = 0;
  private recent = new Map<number, number>();

  reset(): void {
    this.previousSpectrum = null;
    this.previousRate = 0;
    this.previousRms = 0;
    this.frameNumber = 0;
    this.lastAttackFrame = 0;
    this.recent.clear();
  }

  detect(samples: Float32Array, sampleRate: number): { pitches: DetectedPitch[]; fit: number } {
    const spectrum = magnitudeSpectrum(samples), peaks = spectralPeaks(spectrum, sampleRate);
    let squared = 0; for (const sample of samples) squared += sample * sample;
    const rms = Math.sqrt(squared / samples.length);
    const frameNumber = ++this.frameNumber;
    const previousSpectrum = this.previousRate === sampleRate ? this.previousSpectrum : null;
    const previousRms = this.previousRms;
    this.previousSpectrum = spectrum; this.previousRate = sampleRate; this.previousRms = rms;
    if (rms > previousRms * 1.35 && rms - previousRms > .001) this.lastAttackFrame = frameNumber;
    if (!peaks.length) return { pitches: [], fit: 0 };
    const maxAmplitude = Math.max(...peaks.map(p => p.amplitude));
    const resolution = sampleRate / samples.length;
    const match = (frequency: number): SpectralPeak | undefined => {
      const tolerance = Math.max(resolution * .65, frequency * .009);
      return peaks.filter(p => Math.abs(p.frequency - frequency) < tolerance).sort((a, b) => Math.abs(a.frequency - frequency) - Math.abs(b.frequency - frequency))[0];
    };
    const candidates: Candidate[] = [];
    for (const fundamental of peaks) {
      const pitch = mapFrequency(fundamental.frequency);
      if (pitch.midi < 36 || pitch.midi > 96 || Math.abs(pitch.cents) > 38 || fundamental.amplitude < maxAmplitude * .075) continue;
      if (candidates.some(c => c.midi === pitch.midi)) continue;
      const partials = HARMONICS.map((_, i) => match(fundamental.frequency * (i + 1)));
      candidates.push({ midi: pitch.midi, frequency: fundamental.frequency, fundamental, partials, coefficient: 0 });
    }
    candidates.sort((a, b) => a.midi - b.midi);
    const residual = peaks.map(p => p.amplitude);
    for (let iteration = 0; iteration < 24; iteration++) for (const candidate of candidates) {
      let dot = 0, norm = 0;
      for (let h = 0; h < HARMONICS.length; h++) {
        const peak = candidate.partials[h]; const weight = HARMONICS[h]; norm += weight * weight;
        if (peak) dot += residual[peaks.indexOf(peak)] * weight;
      }
      const next = Math.max(0, candidate.coefficient + dot / norm);
      const delta = next - candidate.coefficient; candidate.coefficient = next;
      for (let h = 0; h < HARMONICS.length; h++) { const peak = candidate.partials[h]; if (peak) residual[peaks.indexOf(peak)] -= delta * HARMONICS[h]; }
    }
    const maximumCoefficient = Math.max(0, ...candidates.map(c => c.coefficient));
    const selected: Candidate[] = [];
    for (const candidate of candidates) {
      if (candidate.coefficient < maximumCoefficient * .17 || candidate.fundamental.amplitude < maxAmplitude * .09) continue;
      const isExplained = (peak: SpectralPeak) => selected.some(lower => {
        const harmonic = Math.round(peak.frequency / lower.frequency);
        return harmonic >= 2 && harmonic <= 12 && Math.abs(peak.frequency - harmonic * lower.frequency) < Math.max(resolution * .7, peak.frequency * .009);
      });
      if (isExplained(candidate.fundamental) && candidate.partials.slice(1, 4).filter(p => p && !isExplained(p)).length < 2) continue;
      selected.push(candidate);
    }
    const totalEnergy = peaks.reduce((sum, p) => sum + p.amplitude ** 2, 0);
    const residualEnergy = residual.reduce((sum, value) => sum + value ** 2, 0);
    const fit = Math.max(0, Math.min(1, 1 - residualEnergy / (totalEnergy || 1)));
    const pitches = selected.slice(0, 6).map(candidate => {
      const observed = candidate.partials.map(p => p?.amplitude ?? 0);
      const norm = Math.sqrt(observed.reduce((sum, n) => sum + n * n, 0));
      const templateNorm = Math.sqrt(HARMONICS.reduce((sum, n) => sum + n * n, 0));
      const harmonicFit = observed.reduce((sum, n, i) => sum + n * HARMONICS[i], 0) / (norm * templateNorm || 1);
      return { midi: candidate.midi, frequency: candidate.frequency, confidence: Math.max(0, Math.min(1, harmonicFit * Math.sqrt(fit))) };
    }).filter(p => p.confidence >= .7 && Math.abs(1200 * Math.log2(p.frequency / midiFrequency(p.midi))) <= 38)
      .filter(p => {
        if (!previousSpectrum || frameNumber <= 4 || frameNumber - this.lastAttackFrame <= 14 || frameNumber - (this.recent.get(p.midi) ?? -100) <= 5) return true;
        // A decaying harmonic is not a new struck key. A new voice needs a rise at
        // its fundamental (or a clearly renewed whole-signal attack). Compare
        // absolute magnitudes, since relative spectrum shares change during decay.
        const bin = Math.round(p.frequency * previousSpectrum.length * 2 / sampleRate);
        let oldAmplitude = 0;
        for (let i = Math.max(0, bin - 2); i <= Math.min(previousSpectrum.length - 1, bin + 2); i++) oldAmplitude = Math.max(oldAmplitude, previousSpectrum[i]);
        const current = candidates.find(c => c.midi === p.midi)?.fundamental.amplitude ?? 0;
        return current > oldAmplitude * 1.35 || rms > previousRms * 1.14;
      });
    for (const pitch of pitches) this.recent.set(pitch.midi, frameNumber);
    for (const [midi, last] of this.recent) if (frameNumber - last > 24) this.recent.delete(midi);
    return { pitches, fit };
  }
}
