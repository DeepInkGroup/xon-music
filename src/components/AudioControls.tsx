import { Mic, Square, Pause, Play, RotateCcw, Trash2, CircleHelp } from 'lucide-react';
import type { PracticeStatus } from '../hooks/usePractice';
import type { TranslationKey } from '../i18n';
import { useT } from '../i18n';
import { formatTime } from '../music/noteUtils';
export function AudioControls({ status, micState, elapsed, count, bpm, rms, start, stop, restart, setBpm, onGuide }: {
  status: PracticeStatus; micState: TranslationKey; elapsed: number; count: number; bpm: number; rms: number;
  start: () => void; stop: (pause?: boolean) => void; restart: (listen?: boolean) => void; setBpm: (bpm: number) => void; onGuide: () => void;
}) {
  const t = useT();
  const listening = status === 'listening';
  const db = rms > 0 ? 20 * Math.log10(rms) : -80;
  return <section className="card session-card" aria-labelledby="session-title">
    <div className="card-heading"><h2 id="session-title">{t('session')}</h2><button className="icon-button small" onClick={onGuide} aria-label={t('guide')}><CircleHelp size={16}/></button></div>
    <div className="session-overview"><span className="eyebrow">{t('elapsed')}</span><div className="session-clock" dir="ltr" data-testid="session-clock">{formatTime(elapsed)}<span>{String(Math.floor(elapsed * 10) % 10)}</span></div><span className="notes-recorded"><i/>{count} {t('notes')}</span></div>
    <div className="tempo-control"><label htmlFor="bpm">{t('tempo')}</label><div dir="ltr"><button aria-label={t('decreaseBpm')} onClick={() => setBpm(bpm - 5)} disabled={bpm <= 30}>−</button><input id="bpm" aria-label={t('tempo')} type="number" min={30} max={240} value={bpm} onChange={e => { if (e.target.value) setBpm(Number(e.target.value)); }}/><span>BPM</span><button aria-label={t('increaseBpm')} onClick={() => setBpm(bpm + 5)} disabled={bpm >= 240}>+</button></div></div>
    <button className={`primary-button mic-button ${listening ? 'listening' : ''}`} onClick={() => listening || status === 'starting' ? stop(false) : start()}><span>{listening || status === 'starting' ? <Square size={15}/> : <Mic size={17}/>}</span>{t(listening || status === 'starting' ? 'stop' : status === 'paused' ? 'resume' : 'start')}<span className="button-arrow" aria-hidden="true">↗</span></button>
    <div className="session-actions"><button disabled={!listening && status !== 'paused'} onClick={() => listening ? stop(true) : start()}>{status === 'paused' ? <Play size={13}/> : <Pause size={13}/>} {t(status === 'paused' ? 'resume' : 'pause')}</button><button disabled={status === 'starting'} onClick={() => restart()}><RotateCcw size={13}/>{t('restart')}</button><button disabled={!count && !elapsed} onClick={() => restart(false)}><Trash2 size={13}/>{t('clear')}</button></div>
    <div className="input-monitor"><div><span className={`status-dot ${listening ? 'active' : ''}`}/><span role="status">{t(micState)}</span><span dir="ltr">{listening && rms ? `${Math.round(db)} dB` : '—'}</span></div><div className="level-meter" role="meter" aria-label={t('input')} aria-valuemin={-80} aria-valuemax={0} aria-valuenow={Math.max(-80, db)}>{Array.from({ length: 30 }, (_, i) => <i key={i} className={listening && i < Math.max(0, (db + 65) / 65 * 30) ? i > 25 ? 'hot' : 'filled' : ''}/>)}</div></div>
  </section>;
}
