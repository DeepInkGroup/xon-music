export type Spelling = 'sharps' | 'flats';
export type ClefMode = 'grand' | 'treble' | 'bass';
export type RhythmValue = 'w' | 'h' | 'q' | '8';
export type DetectionMode = 'single' | 'chords';
export interface DetectedPitch { midi: number; frequency: number; confidence: number; }
export type ChordQuality = 'major' | 'minor' | 'diminished' | 'augmented' | 'sus2' | 'sus4' | 'dominant7' | 'major7' | 'minor7' | 'halfDiminished7' | 'diminished7';
export interface ChordEvent { id: string; onset: number; duration: number; root: number; bass: number; quality: ChordQuality; midis: number[]; confidence: number; }
export interface MusicalPitch {
  midi: number;
  name: string;
  pitchClass: string;
  octave: number;
  solfege: string;
  frequency: number;
  referenceFrequency: number;
  cents: number;
}
export interface NoteEvent extends MusicalPitch {
  id: string;
  onset: number;
  duration: number;
  confidence: number;
  rhythm: RhythmValue;
  bpm: number;
  ended: boolean;
}
export interface PracticeSession {
  version: 1 | 2;
  id: string;
  startedAt: string;
  bpm: number;
  elapsed: number;
  notes: NoteEvent[];
  chords?: ChordEvent[];
  detectionMode?: DetectionMode;
}
export interface PitchFrame {
  frequency: number | null;
  confidence: number;
  rms: number;
  peak: number;
  processingMs: number;
  sampleRate: number;
  windowMs: number;
  timestamp: number;
  pitches?: DetectedPitch[];
  mode?: DetectionMode;
  spectralFit?: number;
}
