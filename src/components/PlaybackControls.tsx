import { Play, Pause, Square, Volume2, Headphones } from 'lucide-react';
import { useT } from '../i18n';
import { formatTime, midiName } from '../music/noteUtils';
import { detectChord, chordSymbol } from '../music/chordDetector';
import type { Spelling } from '../music/types';
import type { useSessionPlayer } from '../hooks/useSessionPlayer';
export function PlaybackControls({ player, blocked, hasNotes, autoReplay, setAutoReplay, spelling }: {
  player: ReturnType<typeof useSessionPlayer>; blocked: boolean; hasNotes: boolean; autoReplay: boolean;
  setAutoReplay: (value: boolean) => void; spelling: Spelling;
}) {
  const t = useT();
  const chord = detectChord(player.active.map(n => ({ midi: n.midi, frequency: n.frequency, confidence: n.confidence })));
  return <section className={`card playback-card ${player.status === 'playing' ? 'is-playing' : ''}`} aria-labelledby="playback-title">
    <div className="card-heading"><h2 id="playback-title"><Headphones size={18}/>{t('playback')}<span className="feature-badge">2.0</span></h2><label className="auto-replay"><input type="checkbox" checked={autoReplay} onChange={e => setAutoReplay(e.target.checked)}/>{t('autoReplay')}</label></div>
    <div className="playback-main"><div className="transport"><button className="play-button" disabled={blocked || !hasNotes} onClick={() => player.status === 'playing' ? player.pause() : void player.play()} aria-label={t(player.status === 'playing' ? 'pausePlayback' : 'playRecording')}>{player.status === 'playing' ? <Pause size={22}/> : <Play size={22}/>}</button><button className="icon-button" disabled={blocked || !hasNotes} onClick={player.stop} aria-label={t('stopPlayback')}><Square size={17}/></button></div><div className="playback-track"><div className="playback-info"><span>{blocked ? t('playbackDisabled') : player.status === 'playing' ? t('playing') : player.status === 'paused' ? t('playbackPaused') : t(hasNotes ? 'playbackReady' : 'playbackEmpty')}</span><span className="mono" dir="ltr" data-testid="playback-clock">{formatTime(player.position)} / {formatTime(player.duration)}</span></div><input className="playback-seek" type="range" min={0} max={Math.max(.01, player.duration)} step={.01} value={Math.min(player.position, player.duration)} onChange={e => player.seek(Number(e.target.value))} disabled={blocked || !hasNotes} aria-label={t('seekPlayback')}/><div className="playback-notes" dir="ltr">{player.active.map(note => <span key={note.id}>{midiName(note.midi, spelling)}</span>)}{chord.status === 'detected' && <strong>{chordSymbol(chord, spelling)}</strong>}</div></div></div>
    <div className="playback-settings"><span className="playback-disclosure">{t('playbackTone')}</span><label>{t('playbackSpeed')}<select aria-label={t('playbackSpeed')} value={player.speed} onChange={e => player.setSpeed(Number(e.target.value))}><option value={.5}>0.5×</option><option value={.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label><label className="volume-control"><Volume2 size={14}/><input aria-label={t('volume')} type="range" min={0} max={1} step={.01} value={player.volume} onChange={e => player.setVolume(Number(e.target.value))}/></label><label className="loop-control"><input type="checkbox" checked={player.loop} onChange={e => player.setLoop(e.target.checked)}/>{t('loop')}</label></div>
    {player.error && <p className="playback-error" role="alert">{t('playbackError')}</p>}
  </section>;
}
