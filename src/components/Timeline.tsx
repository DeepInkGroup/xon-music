import { useEffect, useRef, useState } from 'react';
import { ListMusic, ArrowUpRight, Music2 } from 'lucide-react';
import { useT } from '../i18n';
import { formatTime, midiName } from '../music/noteUtils';
import type { NoteEvent, Spelling } from '../music/types';
export function Timeline({ notes, spelling, activeIds }: { notes: NoteEvent[]; spelling: Spelling; activeIds: string[] }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const displayed = expanded ? notes : notes.slice(-30);
  const activeKey = activeIds.join(',');
  useEffect(() => { if (body.current) body.current.scrollTop = body.current.scrollHeight; }, [notes.length]);
  useEffect(() => {
    if (!activeKey || !body.current) return;
    const ids = activeKey.split(',');
    if (!expanded && notes.slice(0, -30).some(note => ids.includes(note.id))) { setExpanded(true); return; }
    const row = Array.from(body.current.children).find(child => ids.includes((child as HTMLElement).dataset.noteId ?? '')) as HTMLElement | undefined;
    if (row) {
      const rowBounds = row.getBoundingClientRect(), bounds = body.current.getBoundingClientRect();
      if (rowBounds.top < bounds.top || rowBounds.bottom > bounds.bottom) body.current.scrollTop += rowBounds.top - bounds.top - body.current.clientHeight / 3;
    }
  }, [activeKey, expanded, notes.length]);
  return <section className="card timeline-card" aria-labelledby="timeline-title">
    <div className="card-heading"><h2 id="timeline-title"><ListMusic size={17}/>{t('timeline')}</h2><span className="count-badge">{notes.length}</span></div>
    <div className="timeline-columns"><span>{t('note')}</span><span>{t('onset')}</span><span>{t('duration')}</span></div>
    <div className="timeline-body" ref={body} data-testid="timeline">
      {notes.length === 0 ? <div className="timeline-empty"><div className="empty-symbol"><Music2 size={25}/></div><p>{t('timelineEmpty')}</p><span>{t('timelineHelp')}</span><div className="empty-lines"><i/><i/><i/></div></div> : displayed.map((note, index) => <div className={`timeline-row ${!note.ended || activeIds.includes(note.id) ? 'current' : ''}`} key={note.id} data-note-id={note.id} data-testid="timeline-note"><div><span className="note-index">{String((expanded ? 0 : Math.max(0, notes.length - 30)) + index + 1).padStart(2, '0')}</span><strong dir="ltr">{midiName(note.midi, spelling)}</strong><small dir="ltr">{note.frequency.toFixed(2)} Hz</small></div><span className="mono" dir="ltr">{formatTime(note.onset, true)}</span><span className="mono" dir="ltr">{note.ended ? `${note.duration.toFixed(2)} s` : '•••'}</span></div>)}
    </div>
    <div className="timeline-footer">{notes.length > 30 ? <button className="text-button" onClick={() => setExpanded(v => !v)}>{t(expanded ? 'showLess' : 'viewAll')}<ArrowUpRight size={13}/></button> : <span>{t('exportHint')}</span>}</div>
  </section>;
}
