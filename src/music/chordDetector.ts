// Future polyphonic detectors must provide independent, simultaneous pitch evidence.
// A sequence of monophonic notes cannot establish a chord.
export interface PolyphonicFrame { pitches: { midi: number; confidence: number }[]; timestamp: number; }
export interface ChordResult { label: string | null; confidence: number; status: 'unavailable' | 'uncertain' | 'detected'; }
export interface ChordDetector { analyze(frame: PolyphonicFrame): ChordResult; }
export class UnavailableChordDetector implements ChordDetector {
  analyze(_frame: PolyphonicFrame): ChordResult { return { label: null, confidence: 0, status: 'unavailable' }; }
}
