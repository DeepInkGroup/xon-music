import { Layers3 } from 'lucide-react';
import { useT } from '../i18n';
import { chordSymbol } from '../music/chordDetector';
import { formatTime } from '../music/noteUtils';
import type { ChordEvent, Spelling } from '../music/types';
export function ChordProgression({ chords, spelling }: { chords: ChordEvent[]; spelling: Spelling }) {
  const t = useT();
  return <section className="card chord-progression" aria-labelledby="progression-title"><div className="card-heading"><h2 id="progression-title"><Layers3 size={16}/>{t('chordHistory')}</h2><span className="count-badge">{chords.length}</span></div><div className="progression-scroll" dir="ltr">{chords.length ? chords.map(chord => <div className="progression-chord" key={chord.id}><strong>{chordSymbol(chord, spelling)}</strong><span>{t(chord.quality)}</span><small>{formatTime(chord.onset)} · {chord.duration.toFixed(1)} s</small></div>) : <p>{t('noChords')}</p>}</div></section>;
}
