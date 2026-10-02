import { AudioLines, Layers3 } from 'lucide-react';
import { useT } from '../i18n';
import { chordSymbol, type ChordResult } from '../music/chordDetector';
import { midiName } from '../music/noteUtils';
import type { NoteEvent, PitchFrame, Spelling } from '../music/types';

const roles: Record<number, 'rootRole' | 'secondRole' | 'minorThirdRole' | 'majorThirdRole' | 'fourthRole' | 'flatFifthRole' | 'fifthRole' | 'augFifthRole' | 'sixthRole' | 'flatSeventhRole' | 'majorSeventhRole'> = {
  0: 'rootRole', 2: 'secondRole', 3: 'minorThirdRole', 4: 'majorThirdRole', 5: 'fourthRole',
  6: 'flatFifthRole', 7: 'fifthRole', 8: 'augFifthRole', 9: 'sixthRole', 10: 'flatSeventhRole', 11: 'majorSeventhRole',
};

export function ChordAnalysis({ chord, activeNotes, frame, spelling, listening }: {
  chord: ChordResult; activeNotes: NoteEvent[]; frame: PitchFrame | null; spelling: Spelling; listening: boolean;
}) {
  const t = useT();
  const recognized = chord.status === 'detected';
  const measured = activeNotes.length;
  const instruction = measured < 3 ? t('playThree') : t('holdChord');
  return <section className={`card chord-analysis ${recognized ? 'has-chord' : ''}`} aria-labelledby="chord-analysis-title">
    <div className="card-heading"><h2 id="chord-analysis-title"><Layers3 size={18}/>{t('harmony')}</h2><span className="feature-badge">{t('experimental')}</span></div>
    <div className="chord-analysis-main">
      <div className="chord-identity"><span className="eyebrow">{t(recognized ? 'recognizedChord' : 'listeningForChord')}</span>
        <div className="chord-symbol" dir="ltr">{recognized ? chordSymbol(chord, spelling) : '—'}</div>
        <p>{recognized ? t(chord.quality!) : listening ? instruction : t('startChord')}</p>
      </div>
      <div className="chord-voices"><div className="chord-voices-heading"><span><AudioLines size={14}/>{t('measuredVoices')}</span><strong dir="ltr">{measured}</strong></div>
        <div className="voice-list">{measured ? activeNotes.map(note => {
          const role = recognized && chord.root !== null ? roles[((note.midi - chord.root) % 12 + 12) % 12] : null;
          return <div className="voice-row" key={note.id}><strong dir="ltr">{midiName(note.midi, spelling)}</strong><span>{role ? t(role) : t('detectedVoice')}</span><div className="voice-strength"><i style={{ width: `${Math.round(note.confidence * 100)}%` }}/></div><small dir="ltr">{Math.round(note.confidence * 100)}%</small></div>;
        }) : <p className="voice-empty">{t('noVoices')}</p>}</div>
      </div>
    </div>
    <div className="chord-analysis-footer"><span>{t('chordAnalysisHint')}</span><span dir="ltr">{frame?.spectralFit !== undefined && listening ? `${t('spectralFit')}: ${Math.round(frame.spectralFit * 100)}%` : ''}</span></div>
  </section>;
}
