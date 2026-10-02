import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Piano } from 'lucide-react';
import { isBlack, midiName } from '../music/noteUtils';
import type { Spelling } from '../music/types';
import { useT } from '../i18n';

const MIDIS = Array.from({ length: 88 }, (_, i) => i + 21);
const WHITES = MIDIS.filter(midi => !isBlack(midi));
const WHITE_WIDTH = 38;
export function PianoKeyboard({ activeMidis, spelling }: { activeMidis: number[]; spelling: Spelling }) {
  const t = useT();
  const [labels, setLabels] = useState(true);
  const [follow, setFollow] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const activeMidi = activeMidis[0] ?? null;
  const targetKey = (midi: number) => scroller.current?.querySelector<HTMLElement>(`[data-midi="${midi}"]`);
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const observer = new ResizeObserver(() => { node.scrollLeft = Math.max(0, WHITES.indexOf(60) * WHITE_WIDTH - node.clientWidth / 2); });
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!follow || activeMidi === null) return;
    const node = scroller.current, key = targetKey(activeMidi);
    if (node && key && (key.offsetLeft < node.scrollLeft + 25 || key.offsetLeft + WHITE_WIDTH > node.scrollLeft + node.clientWidth - 25)) {
      node.scrollTo({ left: key.offsetLeft - node.clientWidth / 2, behavior: 'smooth' });
    }
  }, [activeMidi, follow]);
  return <section className="card keyboard-card" aria-labelledby="keyboard-title">
    <div className="card-heading keyboard-heading"><div><h2 id="keyboard-title"><Piano size={18}/>{t('keyboard')}</h2><p className="muted keyboard-description">{t('keyboardSub')}</p></div><div className="keyboard-options"><label><input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)}/>{t('follow')}</label><label><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)}/>{t('labels')}</label></div></div>
    <div className="keyboard-scroll" ref={scroller} dir="ltr" tabIndex={0} aria-label={t('keyboard')}>
      <div className="piano-keys" style={{ width: WHITES.length * WHITE_WIDTH }}>
        {WHITES.map(midi => <div key={midi} className={`piano-key white ${activeMidis.includes(midi) ? 'active' : ''}`} data-midi={midi} role="img" aria-label={`${midiName(midi, spelling)}${activeMidis.includes(midi) ? `, ${t('activeNote')}` : ''}`} style={{ width: WHITE_WIDTH }}><span className={midi % 12 === 0 ? 'c-label' : ''}>{labels ? midiName(midi, spelling) : midi % 12 === 0 ? `C${Math.floor(midi / 12) - 1}` : ''}</span>{activeMidis.includes(midi) && <i/>}</div>)}
        {MIDIS.filter(isBlack).map(midi => {
          const whiteIndex = WHITES.filter(n => n < midi).length;
          return <div key={midi} className={`piano-key black ${activeMidis.includes(midi) ? 'active' : ''}`} data-midi={midi} role="img" aria-label={`${midiName(midi, spelling)}${activeMidis.includes(midi) ? `, ${t('activeNote')}` : ''}`} style={{ left: whiteIndex * WHITE_WIDTH - 12, width: 24 }}><span>{labels ? midiName(midi, spelling) : ''}</span>{activeMidis.includes(midi) && <i/>}</div>;
        })}
      </div>
    </div>
    <div className="keyboard-footer"><span dir="ltr">{t('keyHint')}</span><div className="keyboard-position" dir="ltr"><button className="icon-button small" aria-label={t('lowerOctaves')} onClick={() => scroller.current?.scrollBy({ left: -WHITE_WIDTH * 7, behavior: 'smooth' })}><ChevronLeft size={16}/></button><span dir="ltr">A0 <i/> C8</span><button className="icon-button small" aria-label={t('higherOctaves')} onClick={() => scroller.current?.scrollBy({ left: WHITE_WIDTH * 7, behavior: 'smooth' })}><ChevronRight size={16}/></button></div><span dir="ltr">{activeMidi === null ? '—' : midiName(activeMidi, spelling)}</span></div>
  </section>;
}
