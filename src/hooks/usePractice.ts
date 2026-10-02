import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioInput } from '../audio/audioInput';
import { PolyphonicTracker } from '../audio/polyphonicTracker';
import type { DetectionMode, MusicalPitch, NoteEvent, PitchFrame, PracticeSession } from '../music/types';
import { mapFrequency } from '../music/noteUtils';
import { quantizeDuration } from '../music/rhythmDetector';
import type { TranslationKey } from '../i18n';
import { newSession, saveSession } from '../session/storage';
import { detectChord, type ChordResult } from '../music/chordDetector';
import { ChordTracker } from '../music/chordTracker';

export type PracticeStatus = 'idle' | 'starting' | 'listening' | 'paused';
export function usePractice(gateDb: number, detectionMode: DetectionMode) {
  const [session, setSession] = useState<PracticeSession>(() => newSession());
  const [status, setStatus] = useState<PracticeStatus>('idle');
  const [frame, setFrame] = useState<PitchFrame | null>(null);
  const [pitch, setPitch] = useState<MusicalPitch | null>(null);
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const [activeNotes, setActiveNotes] = useState<NoteEvent[]>([]);
  const [chord, setChord] = useState<ChordResult>(() => detectChord([]));
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(48).fill(0));
  const engineRef = useRef<AudioInput | null>(null);
  const trackerRef = useRef(new PolyphonicTracker());
  const modeRef = useRef(detectionMode);
  const chordTrackerRef = useRef(new ChordTracker());
  const sessionRef = useRef(session);
  const runRef = useRef(0);
  const elapsedRef = useRef(0);
  const startedRef = useRef<number | null>(null);
  const gateRef = useRef(gateDb);
  const lastRenderRef = useRef(0);
  const statusRef = useRef<PracticeStatus>('idle');
  gateRef.current = gateDb;
  modeRef.current = detectionMode;
  if (engineRef.current) engineRef.current.gateDb = gateDb;
  const time = useCallback(() => elapsedRef.current + (startedRef.current === null ? 0 : (performance.now() - startedRef.current) / 1000), []);
  const commit = useCallback((next: PracticeSession) => { sessionRef.current = next; setSession(next); }, []);
  const setMode = useCallback((mode: PracticeStatus) => { statusRef.current = mode; setStatus(mode); }, []);

  const stop = useCallback(async (pause = false) => {
    runRef.current++;
    elapsedRef.current = time(); startedRef.current = null;
    trackerRef.current.finish(elapsedRef.current);
    chordTrackerRef.current.finish(elapsedRef.current);
    const engine = engineRef.current; engineRef.current = null;
    setMode(pause ? 'paused' : 'idle'); setActiveMidi(null); setPitch(null); setFrame(null);
    setActiveNotes([]); setChord(detectChord([]));
    setLevels(Array(48).fill(0)); setElapsed(elapsedRef.current);
    const snapshot = { ...sessionRef.current, elapsed: elapsedRef.current };
    commit(snapshot); setStorageError(!saveSession(snapshot));
    await engine?.stop();
  }, [commit, setMode, time]);

  const start = useCallback(async () => {
    if (engineRef.current) return;
    setError(null); setMode('starting');
    const run = ++runRef.current;
    const engine = new AudioInput(); engineRef.current = engine; engine.gateDb = gateRef.current; engine.mode = modeRef.current;
    commit({ ...sessionRef.current, detectionMode: modeRef.current });
    const tracker = trackerRef.current;
    tracker.reset();
    const chordTracker = chordTrackerRef.current;
    chordTracker.reset();
    chordTracker.onEnd = ended => commit({ ...sessionRef.current, chords: [...(sessionRef.current.chords ?? []), ended] });
    tracker.onStart = (note: NoteEvent) => {
      if (sessionRef.current.notes.length >= 10000) { setError('sessionLimit'); void stop(); return; }
      commit({ ...sessionRef.current, notes: [...sessionRef.current.notes, note].sort((a, b) => a.onset - b.onset || a.midi - b.midi) });
    };
    tracker.onEnd = note => {
      commit({ ...sessionRef.current, notes: sessionRef.current.notes.map(n => n.id === note.id ? note : n) });
    };
    tracker.onUpdate = note => {
      // Only change notation when the rhythmic bucket changes; preserve the latest event in the ref.
      const notes = sessionRef.current.notes;
      const index = notes.findIndex(n => n.id === note.id);
      if (index < 0) return;
      const changed = notes[index].rhythm !== note.rhythm;
      const updated = [...notes]; updated[index] = note;
      sessionRef.current = { ...sessionRef.current, notes: updated };
      if (changed) setSession(sessionRef.current);
    };
    let origin = 0;
    const baseTime = elapsedRef.current;
    engine.onFrame = next => {
      if (run !== runRef.current || statusRef.current !== 'listening') return;
      // Timestamp at the center of the analysis window, accounting for capture latency.
      const timestamp = Math.max(baseTime, baseTime + next.timestamp - origin - next.windowMs / 2000);
      tracker.process(next, timestamp, sessionRef.current.bpm);
      const active = tracker.active;
      const evidence = active.filter(n => next.pitches?.some(p => p.midi === n.midi)).map(n => ({ midi: n.midi, frequency: n.frequency, confidence: n.confidence }));
      const nextChord = next.mode === 'chords' ? detectChord(evidence) : detectChord([]);
      const stableChord = chordTracker.process(nextChord, timestamp);
      if (performance.now() - lastRenderRef.current >= 65) {
        lastRenderRef.current = performance.now(); setFrame(next);
        setActiveNotes(active); setActiveMidi(active[0]?.midi ?? null);
        setPitch(active[0] ? mapFrequency(active[0].frequency) : null);
        setChord(stableChord);
        setLevels(previous => [...previous.slice(1), next.rms]);
      }
    };
    engine.onInterrupted = () => { if (run === runRef.current) { setError('errorInterrupted'); void stop(true); } };
    try {
      await engine.start();
      if (run !== runRef.current) return;
      origin = engine.currentTime; startedRef.current = performance.now(); setMode('listening');
    } catch (failure) {
      if (run !== runRef.current) return;
      engineRef.current = null; setMode('idle');
      const name = failure instanceof Error ? failure.name : '';
      const message = failure instanceof Error ? failure.message : '';
      setError(name === 'NotAllowedError' ? 'errorDenied' : name === 'NotFoundError' ? 'errorMissing' :
        name === 'NotReadableError' ? 'errorBusy' : message === 'secure' ? 'errorSecure' : message === 'unsupported' ? 'errorUnsupported' : 'errorOther');
    }
  }, [commit, setMode, stop]);

  const clear = useCallback(() => {
    trackerRef.current.reset(); chordTrackerRef.current.reset(); setActiveMidi(null); setActiveNotes([]); setChord(detectChord([])); setPitch(null);
    elapsedRef.current = 0; startedRef.current = statusRef.current === 'listening' ? performance.now() : null;
    commit(newSession(sessionRef.current.bpm)); setElapsed(0);
  }, [commit]);

  const restart = useCallback(async (listen = statusRef.current === 'listening') => {
    await stop(); clear(); if (listen) await start();
  }, [clear, start, stop]);
  const load = useCallback(async (saved: PracticeSession) => {
    await stop(); trackerRef.current.reset(); chordTrackerRef.current.reset(); elapsedRef.current = saved.elapsed;
    commit({ ...saved, notes: saved.notes.map(n => ({ ...n, ended: true })) }); setElapsed(saved.elapsed); setMode('paused'); setError(null);
  }, [commit, setMode, stop]);
  const setBpm = useCallback((bpm: number) => { commit({ ...sessionRef.current, bpm: Math.min(240, Math.max(30, bpm)) }); }, [commit]);
  const snapshot = useCallback((): PracticeSession => {
    const now = time();
    const activeChord = chordTrackerRef.current.snapshot(now);
    return { ...sessionRef.current, elapsed: now, chords: [...(sessionRef.current.chords ?? []), ...(activeChord ? [activeChord] : [])], notes: sessionRef.current.notes.map(note => note.ended ? note :
      { ...note, duration: Math.max(0.06, now - note.onset), rhythm: quantizeDuration(Math.max(0.06, now - note.onset), note.bpm) }) };
  }, [time]);

  useEffect(() => {
    if (status !== 'listening') return;
    const timer = window.setInterval(() => setElapsed(time()), 200);
    const persist = window.setInterval(() => setStorageError(!saveSession(snapshot())), 2500);
    return () => { clearInterval(timer); clearInterval(persist); };
  }, [snapshot, status, time]);
  useEffect(() => {
    const hide = () => { if (document.hidden && engineRef.current) void stop(true); };
    const unload = () => saveSession(snapshot());
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', unload);
    return () => {
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', unload);
      runRef.current++; void engineRef.current?.stop();
    };
  }, [snapshot, stop]);
  return { session, status, frame, pitch, activeMidi, activeNotes, chord, elapsed, error, storageError, levels, start, stop, restart, load, setBpm, snapshot };
}
