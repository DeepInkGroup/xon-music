import { useCallback, useEffect, useRef, useState } from 'react';
import { recordingLength, SessionPlayer } from '../audio/sessionPlayer';
import type { NoteEvent, PracticeSession } from '../music/types';

export function useSessionPlayer(session: PracticeSession) {
  const player = useRef(new SessionPlayer());
  const [status, setStatus] = useState<'stopped' | 'playing' | 'paused'>('stopped');
  const [position, setPosition] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [volume, setVolume] = useState(.55);
  const [loop, setLoop] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState<NoteEvent[]>([]);
  const sessionRef = useRef(session); sessionRef.current = session;
  const positionRef = useRef(0), speedRef = useRef(1), volumeRef = useRef(.55), loopRef = useRef(false);
  const playbackNotes = useRef<NoteEvent[]>([]);
  const token = useRef(0);
  volumeRef.current = volume; loopRef.current = loop;
  const duration = recordingLength(session.notes);
  const prepare = useCallback(() => player.current.prepare(), []);
  const play = useCallback(async (notes = sessionRef.current.notes, from = positionRef.current) => {
    const run = ++token.current; setError(false); playbackNotes.current = notes;
    const end = recordingLength(notes);
    const first = notes.reduce((minimum, note) => Math.min(minimum, note.onset), Infinity);
    const offset = from >= end - .02 ? first : Math.max(first, from);
    if (!notes.length) return;
    try {
      await player.current.play(notes, offset, speedRef.current, volumeRef.current);
      if (run !== token.current) return;
      positionRef.current = offset; setPosition(offset); setStatus('playing');
    } catch { if (run === token.current) { setError(true); setStatus('stopped'); } }
  }, []);
  const pause = useCallback(() => {
    token.current++; positionRef.current = player.current.position; player.current.halt();
    setPosition(positionRef.current); setStatus('paused'); setActive([]);
  }, []);
  const stop = useCallback(() => {
    token.current++; player.current.halt(); positionRef.current = 0; setPosition(0); setStatus('stopped'); setActive([]);
  }, []);
  const seek = useCallback((next: number) => {
    const position = Math.max(0, Math.min(recordingLength(sessionRef.current.notes), next));
    positionRef.current = position; setPosition(position);
    if (player.current.playing) void play(playbackNotes.current, position);
  }, [play]);
  const setSpeed = useCallback((value: number) => {
    const position = player.current.playing ? player.current.position : positionRef.current;
    speedRef.current = value; setSpeedState(value);
    if (player.current.playing) void play(playbackNotes.current, position);
  }, [play]);
  useEffect(() => player.current.setVolume(volume), [volume]);
  useEffect(() => {
    if (status !== 'playing') return;
    let animation = 0, last = 0, signature = '', cancelled = false;
    const tick = (now: number) => {
      const end = recordingLength(playbackNotes.current), actual = player.current.position, next = Math.min(end, actual);
      if (actual >= end + .12 || !player.current.playing) {
        if (loopRef.current && player.current.playing) { void play(playbackNotes.current, 0).then(() => { if (!cancelled) animation = requestAnimationFrame(tick); }); }
        else { player.current.halt(); setStatus('stopped'); setActive([]); positionRef.current = end; setPosition(end); }
        return;
      }
      if (now - last > 45) {
        last = now; positionRef.current = next; setPosition(next);
        const notes = playbackNotes.current.filter(n => n.onset <= next && n.onset + n.duration > next);
        const key = notes.map(n => n.id).join(','); if (signature !== key) { signature = key; setActive(notes); }
      }
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick); return () => { cancelled = true; cancelAnimationFrame(animation); };
  }, [play, status]);
  useEffect(() => { stop(); }, [session.id, stop]);
  useEffect(() => {
    const hide = () => { if (document.hidden && player.current.playing) pause(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); token.current++; void player.current.dispose(); };
  }, [pause]);
  return { status, position, duration, speed, volume, loop, error, active, prepare, play, pause, stop, seek, setSpeed, setVolume, setLoop };
}
