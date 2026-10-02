import { useEffect, useMemo, useRef, useState } from 'react';
import { Accidental, Formatter, GhostNote, Renderer, Stave, StaveConnector, StaveNote, Voice } from 'vexflow/bravura';
import { ChevronLeft, ChevronRight, Music2 } from 'lucide-react';
import type { ClefMode, NoteEvent, Spelling } from '../music/types';
import { midiName } from '../music/noteUtils';
import { useT } from '../i18n';
import { groupNotes } from '../music/noteGroups';
import { quantizeDuration } from '../music/rhythmDetector';

const PAGE_SIZE = 24;
export function MusicStaff({ notes, activeIds, spelling }: { notes: NoteEvent[]; activeIds: string[]; spelling: Spelling }) {
  const t = useT();
  const [clef, setClef] = useState<ClefMode>('grand');
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(800);
  const [drawError, setDrawError] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const drawing = useRef<HTMLDivElement>(null);
  const previousCount = useRef(0);
  const groups = useMemo(() => groupNotes(notes), [notes]);
  const activeKey = activeIds.join(',');
  const pages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  useEffect(() => {
    if (groups.length !== previousCount.current) { setPage(Math.max(0, Math.ceil(groups.length / PAGE_SIZE) - 1)); previousCount.current = groups.length; }
  }, [groups.length]);
  useEffect(() => {
    if (!activeKey) return;
    const index = groups.findIndex(group => group.notes.some(n => activeKey.split(',').includes(n.id)));
    if (index >= 0) setPage(Math.floor(index / PAGE_SIZE));
  }, [activeKey, groups]);
  useEffect(() => {
    const node = container.current; if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const node = drawing.current; if (!node) return;
    node.replaceChildren();
    const selected = groups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const selectedNotes = selected.flatMap(group => group.notes);
    // Reserve vertical space for ledger lines even when all pitches use one clef.
    const maximum = Math.max(clef === 'bass' ? 67 : 88, ...selectedNotes.map(n => n.midi));
    const minimum = Math.min(clef === 'treble' ? 55 : 36, ...selectedNotes.map(n => n.midi));
    const y = 35 + Math.max(0, maximum - (clef === 'bass' ? 67 : 88)) * 3;
    const bottomPadding = Math.max(0, (clef === 'treble' ? 55 : 36) - minimum) * 3;
    const sheetWidth = Math.max(width - 36, selected.length ? 500 : 260, selected.length * 68 + 140);
    const height = (clef === 'grand' ? y + 218 : y + 170) + bottomPadding;
    const activeGlyphs: StaveNote[] = [];
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
        for (const group of selected) {
          const duration = quantizeDuration(Math.max(.06, group.duration), group.notes[0].bpm);
          const buildNote = (events: NoteEvent[], useBass: boolean): StaveNote | GhostNote => {
            if (!events.length) return new GhostNote({ duration });
            const keys = events.map(event => `${midiName(event.midi, spelling).slice(0, -1).toLowerCase()}/${event.octave}`);
            const note = new StaveNote({ clef: useBass ? 'bass' : 'treble', keys, duration });
            events.forEach((event, index) => {
              const pitchClass = keys[index].split('/')[0];
              const accidental = pitchClass.includes('#') ? '#' : pitchClass.includes('b') ? 'b' : 'n';
              const key = `${useBass}:${pitchClass[0]}${event.octave}`;
              if (accidental !== (accidentalState.get(key) ?? 'n')) note.addModifier(new Accidental(accidental), index);
              accidentalState.set(key, accidental);
              if (activeKey.split(',').includes(event.id)) note.setKeyStyle(index, { fillStyle: '#668b2c', strokeStyle: '#668b2c' });
            });
            if (events.some(event => activeKey.split(',').includes(event.id))) activeGlyphs.push(note);
            return note;
          };
          if (clef === 'grand') { upper.push(buildNote(group.notes.filter(n => n.midi >= 60), false)); lower.push(buildNote(group.notes.filter(n => n.midi < 60), true)); }
          else upper.push(buildNote(group.notes, clef === 'bass'));
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
      if (scroll.current) {
        if (activeGlyphs.length) {
          const x = activeGlyphs[0].getAbsoluteX(), viewport = scroll.current;
          if (x < viewport.scrollLeft + 40 || x > viewport.scrollLeft + viewport.clientWidth - 40) viewport.scrollLeft = Math.max(0, x - viewport.clientWidth / 2);
        } else if (page === pages - 1) scroll.current.scrollLeft = selected.length ? scroll.current.scrollWidth : 0;
      }
    } catch (error) { console.error('Notation rendering failed', error); setDrawError(true); }
  }, [activeKey, clef, groups, page, pages, spelling, width]);
  return <section className="card sheet-card" ref={container} aria-labelledby="sheet-title">
    <div className="card-heading"><h2 id="sheet-title"><Music2 size={17}/>{t('sheet')}</h2><div className="segmented" aria-label={t('sheet')}>{(['grand', 'treble', 'bass'] as ClefMode[]).map(mode => <button key={mode} className={clef === mode ? 'selected' : ''} onClick={() => setClef(mode)} aria-pressed={clef === mode}>{t(mode)}</button>)}</div></div>
    <div className="sheet-paper">
      <div className="sheet-topline"><span>XON <b>MUSIC</b></span><span>{t('rhythm')}</span></div>
      <div ref={scroll} className="sheet-scroll" dir="ltr" tabIndex={0} aria-label={`${t('sheet')}: ${groups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).flatMap(group => group.notes).map(n => midiName(n.midi, spelling)).join(', ')}`}><div ref={drawing}/></div>
      {notes.length === 0 && <div className="sheet-empty"><p>{t('sheetEmpty')}</p><span>{t('sheetHelp')}</span></div>}
      {drawError && <p role="alert">{t('unavailable')}</p>}
      <div className="sheet-bottomline"><span>{notes.length} {t('notes')}</span><div dir="ltr"><button className="paper-button" disabled={page === 0} aria-label={t('previousNotes')} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/></button><span>{page + 1} / {pages}</span><button className="paper-button" disabled={page >= pages - 1} aria-label={t('nextNotes')} onClick={() => setPage(p => p + 1)}><ChevronRight size={15}/></button></div><span>♪</span></div>
    </div>
  </section>;
}
