import { useEffect, useRef, useState } from 'react';
import { ListMusic, ArrowUpRight, Music2 } from 'lucide-react';
import { useT } from '../i18n';
import { formatTime, midiName } from '../music/noteUtils';
import type { NoteEvent, Spelling } from '../music/types';
export function Timeline({ notes, spelling }: { notes: NoteEvent[]; spelling: Spelling }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const displayed = expanded ? notes : notes.slice(-30);
  useEffect(() => { if (body.current) body.current.scrollTop = body.current.scrollHeight; }, [notes.length]);
  return <section className="card timeline-card" aria-labelledby="timeline-title">
    <div className="card-heading"><h2 id="timeline-title"><ListMusic size={17}/>{t('timeline')}</h2><span className="count-badge">{notes.length}</span></div>
    <div className="timeline-columns"><span>{t('note')}</span><span>{t('onset')}</span><span>{t('duration')}</span></div>
    <div className="timeline-body" ref={body} data-testid="timeline">
      {notes.length === 0 ? <div className="timeline-empty"><div className="empty-symbol"><Music2 size={25}/></div><p>{t('timelineEmpty')}</p><span>{t('timelineHelp')}</span><div className="empty-lines"><i/><i/><i/></div></div> : displayed.map((note, index) => <div className={`timeline-row ${note.ended ? '' : 'current'}`} key={note.id} data-testid="timeline-note"><div><span className="note-index">{String((expanded ? 0 : Math.max(0, notes.length - 30)) + index + 1).padStart(2, '0')}</span><strong dir="ltr">{midiName(note.midi, spelling)}</strong><small dir="ltr">{note.frequency.toFixed(2)} Hz</small></div><span className="mono" dir="ltr">{formatTime(note.onset, true)}</span><span className="mono" dir="ltr">{note.ended ? `${note.duration.toFixed(2)} s` : '•••'}</span></div>)}
    </div>
    <div className="timeline-footer">{notes.length > 30 ? <button className="text-button" onClick={() => setExpanded(v => !v)}>{t(expanded ? 'showLess' : 'viewAll')}<ArrowUpRight size={13}/></button> : <span>{t('exportHint')}</span>}</div>
  </section>;
}
