import { useEffect, useRef, useState } from 'react';
import { Accidental, Formatter, GhostNote, Renderer, Stave, StaveConnector, StaveNote, Voice } from 'vexflow/bravura';
import { ChevronLeft, ChevronRight, Music2 } from 'lucide-react';
import type { ClefMode, NoteEvent, Spelling } from '../music/types';
import { midiName } from '../music/noteUtils';
import { useT } from '../i18n';

const PAGE_SIZE = 24;
export function MusicStaff({ notes, activeMidi, spelling }: { notes: NoteEvent[]; activeMidi: number | null; spelling: Spelling }) {
  const t = useT();
  const [clef, setClef] = useState<ClefMode>('grand');
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(800);
  const [drawError, setDrawError] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const drawing = useRef<HTMLDivElement>(null);
  const previousCount = useRef(0);
  const pages = Math.max(1, Math.ceil(notes.length / PAGE_SIZE));
  useEffect(() => {
    if (notes.length !== previousCount.current) { setPage(Math.max(0, Math.ceil(notes.length / PAGE_SIZE) - 1)); previousCount.current = notes.length; }
  }, [notes.length]);
  useEffect(() => {
    const node = container.current; if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const node = drawing.current; if (!node) return;
    node.replaceChildren();
    const selected = notes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    // Reserve vertical space for ledger lines even when all pitches use one clef.
    const maximum = Math.max(clef === 'bass' ? 67 : 88, ...selected.map(n => n.midi));
    const minimum = Math.min(clef === 'treble' ? 55 : 36, ...selected.map(n => n.midi));
    const y = 35 + Math.max(0, maximum - (clef === 'bass' ? 67 : 88)) * 3;
    const bottomPadding = Math.max(0, (clef === 'treble' ? 55 : 36) - minimum) * 3;
    const sheetWidth = Math.max(width - 36, selected.length ? 500 : 260, selected.length * 68 + 140);
    const height = (clef === 'grand' ? y + 218 : y + 170) + bottomPadding;
    try {
      const renderer = new Renderer(node, Renderer.Backends.SVG); renderer.resize(sheetWidth, height);
      const context = renderer.getContext(); context.setFillStyle('#343a30'); context.setStrokeStyle('#69705f');
      const top = new Stave(30, y, sheetWidth - 45).addClef(clef === 'bass' ? 'bass' : 'treble');
      top.setContext(context).draw();
      let bottom: Stave | null = null;
      if (clef === 'grand') {
        bottom = new Stave(30, y + 100, sheetWidth - 45).addClef('bass'); bottom.setContext(context).draw();
        new StaveConnector(top, bottom).setType('brace').setContext(context).draw();
        new StaveConnector(top, bottom).setType('singleLeft').setContext(context).draw();
      }
      if (selected.length) {
        const upper: (StaveNote | GhostNote)[] = [], lower: (StaveNote | GhostNote)[] = [];
        const accidentalState = new Map<string, string>();
        for (const event of selected) {
          const useBass = clef === 'bass' || (clef === 'grand' && event.midi < 60);
          const name = midiName(event.midi, spelling);
          const pitchClass = name.slice(0, -1).toLowerCase();
          const note = new StaveNote({ clef: useBass ? 'bass' : 'treble', keys: [`${pitchClass}/${event.octave}`], duration: event.rhythm });
          const accidental = pitchClass.includes('#') ? '#' : pitchClass.includes('b') ? 'b' : 'n';
          const key = `${useBass}:${pitchClass[0]}${event.octave}`;
          const previous = accidentalState.get(key) ?? 'n';
          if (accidental !== previous) note.addModifier(new Accidental(accidental), 0);
          accidentalState.set(key, accidental);
          if (!event.ended && event.midi === activeMidi) note.setStyle({ fillStyle: '#668b2c', strokeStyle: '#668b2c' });
          if (clef === 'grand') {
            upper.push(useBass ? new GhostNote({ duration: event.rhythm }) : note);
            lower.push(useBass ? note : new GhostNote({ duration: event.rhythm }));
          } else upper.push(note);
        }
        const topVoice = new Voice({ num_beats: 4, beat_value: 4 }).setStrict(false).addTickables(upper).setStave(top);
        const formatter = new Formatter().joinVoices([topVoice]);
        const voices = [topVoice];
        if (bottom) { const bottomVoice = new Voice({ num_beats: 4, beat_value: 4 }).setStrict(false).addTickables(lower).setStave(bottom); voices.push(bottomVoice); formatter.joinVoices([bottomVoice]); }
        formatter.format(voices, sheetWidth - 135);
        topVoice.draw(context, top); if (bottom) voices[1].draw(context, bottom);
      }
      node.querySelector('svg')?.setAttribute('aria-hidden', 'true');
      setDrawError(false);
      if (page === pages - 1 && scroll.current) scroll.current.scrollLeft = selected.length ? scroll.current.scrollWidth : 0;
    } catch (error) { console.error('Notation rendering failed', error); setDrawError(true); }
  }, [activeMidi, clef, notes, page, pages, spelling, width]);
  return <section className="card sheet-card" ref={container} aria-labelledby="sheet-title">
    <div className="card-heading"><h2 id="sheet-title"><Music2 size={17}/>{t('sheet')}</h2><div className="segmented" aria-label={t('sheet')}>{(['grand', 'treble', 'bass'] as ClefMode[]).map(mode => <button key={mode} className={clef === mode ? 'selected' : ''} onClick={() => setClef(mode)} aria-pressed={clef === mode}>{t(mode)}</button>)}</div></div>
    <div className="sheet-paper">
      <div className="sheet-topline"><span>XON <b>MUSIC</b></span><span>{t('rhythm')}</span></div>
      <div ref={scroll} className="sheet-scroll" dir="ltr" tabIndex={0} aria-label={`${t('sheet')}: ${notes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(n => midiName(n.midi, spelling)).join(', ')}`}><div ref={drawing}/></div>
      {notes.length === 0 && <div className="sheet-empty"><p>{t('sheetEmpty')}</p><span>{t('sheetHelp')}</span></div>}
      {drawError && <p role="alert">{t('unavailable')}</p>}
      <div className="sheet-bottomline"><span>{notes.length} {t('notes')}</span><div dir="ltr"><button className="paper-button" disabled={page === 0} aria-label={t('previousNotes')} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/></button><span>{page + 1} / {pages}</span><button className="paper-button" disabled={page >= pages - 1} aria-label={t('nextNotes')} onClick={() => setPage(p => p + 1)}><ChevronRight size={15}/></button></div><span>♪</span></div>
    </div>
  </section>;
}
