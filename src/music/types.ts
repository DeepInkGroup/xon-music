export type Spelling = 'sharps' | 'flats';
export type ClefMode = 'grand' | 'treble' | 'bass';
export type RhythmValue = 'w' | 'h' | 'q' | '8';
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
  version: 1;
  id: string;
  startedAt: string;
  bpm: number;
  elapsed: number;
  notes: NoteEvent[];
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
}
