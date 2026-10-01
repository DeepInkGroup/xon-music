import { AudioLines, Radio, ShieldCheck } from 'lucide-react';
import { useT } from '../i18n';
import type { MusicalPitch, PitchFrame, Spelling } from '../music/types';
import { midiName } from '../music/noteUtils';
import { Tuner } from './Tuner';
export function LiveNote({ pitch, frame, listening, levels, spelling }: { pitch: MusicalPitch | null; frame: PitchFrame | null; listening: boolean; levels: number[]; spelling: Spelling }) {
  const t = useT();
  const name = pitch ? midiName(pitch.midi, spelling) : '';
  return <section className="card detector" aria-labelledby="live-note-title">
    <div className="card-heading"><h2 id="live-note-title"><AudioLines size={17}/>{t('liveNote')}</h2><span className={`live-badge ${listening ? 'is-live' : ''}`}><span/>{t(listening ? 'live' : 'idle')}</span></div>
    <div className="detector-body">
      <div className="pitch-display" data-testid="live-note" dir="ltr"><span className={pitch ? '' : 'empty-note'}>{pitch ? name.slice(0, -1) : '—'}</span>{pitch && <sub>{pitch.octave}</sub>}</div>
      <div className="pitch-detail">{pitch ? <><p className="solfege" dir="ltr">{pitch.solfege}</p><div className="pitch-metrics"><div><span>{t('frequency')}</span><strong dir="ltr">{pitch.frequency.toFixed(2)} <small>Hz</small></strong></div><div><span>{t('confidence')}</span><strong dir="ltr">{Math.round((frame?.confidence ?? 0) * 100)}<small>%</small></strong></div></div></> : <><p className="waiting-title">{listening && frame?.rms && frame.rms > 0.005 ? t('noPitch') : t('waiting')}</p><p className="muted">{t('waitingDetail')}</p></>}</div>
      <div className="signal-visual" aria-hidden="true">{levels.map((level, i) => <i key={i} style={{ height: `${Math.max(3, Math.min(58, Math.sqrt(level) * 140))}px`, opacity: 0.2 + i / levels.length * 0.7 }}/>)}</div>
    </div>
    <Tuner cents={pitch?.cents ?? null}/>
    <div className="detector-footer"><span><Radio size={13}/>{t('mono')}</span><span>{t('chord')}: <span title={t('limitationDetail')}>{t('uncertain')}</span></span><span dir="ltr">{t('reference')}</span></div>
    <div className="privacy-mobile"><ShieldCheck size={14}/>{t('privacyShort')}</div>
  </section>;
}
