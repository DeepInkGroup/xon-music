import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, AudioLines, Check, ChevronDown, Globe2, Headphones, History, Mic, Moon, Settings2, ShieldCheck, Sun, X } from 'lucide-react';
import { LanguageContext, translate, type Language, type TranslationKey } from './i18n';
import { usePractice } from './hooks/usePractice';
import { LiveNote } from './components/LiveNote';
import { AudioControls } from './components/AudioControls';
import { MusicStaff } from './components/MusicStaff';
import { PianoKeyboard } from './components/PianoKeyboard';
import { Timeline } from './components/Timeline';
import { Modal } from './components/Modal';
import { downloadSession, jsonExporter, midiExporter, musicXmlExporter } from './session/exports';
import { readPreference, readSessions, writePreference } from './session/storage';
import { formatTime } from './music/noteUtils';
import type { PracticeSession, Spelling } from './music/types';

export default function App() {
  const [language, setLanguage] = useState<Language>(() => readPreference('language', ['en', 'fa'], 'en'));
  const [theme, setTheme] = useState<'dark' | 'light'>(() => readPreference('theme', ['dark', 'light'], 'dark'));
  const [spelling, setSpelling] = useState<Spelling>('sharps');
  const [gateDb, setGateDb] = useState(-45);
  const [debug, setDebug] = useState(false);
  const [modal, setModal] = useState<'settings' | 'guide' | 'sessions' | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [saved, setSaved] = useState<PracticeSession[]>([]);
  const practice = usePractice(gateDb);
  const t = (key: TranslationKey) => translate(language, key);
  const listening = practice.status === 'listening';
  const micState: TranslationKey = practice.status === 'starting' ? 'permission' : listening ? practice.activeMidi !== null ? 'pianoDetected' : (practice.frame?.rms ?? 0) < 10 ** (gateDb / 20) ? 'noSound' : 'listening' : practice.status === 'paused' ? 'paused' : 'micOff';
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr'; writePreference('language', language); }, [language]);
  useEffect(() => { document.documentElement.dataset.theme = theme; writePreference('theme', theme); document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101110' : '#f4f5f0'); }, [theme]);
  const openSessions = () => { setSaved(readSessions()); setModal('sessions'); };
  return <LanguageContext value={language}>
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#workspace" aria-label="Xon Music"><span className="brand-symbol"><i/><i/><i/><i/></span><span>xon<span className="brand-music">music</span></span></a>
        <nav aria-label={t('workspace')}><button className="nav-active" onClick={() => { setModal(null); document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }); }}>{t('workspace')}</button><button onClick={openSessions}>{t('sessions')}</button><button onClick={() => setModal('guide')}>{t('guide')}<ArrowUpRight size={12}/></button></nav>
        <div className="header-actions"><button className="icon-button mobile-history" onClick={openSessions} aria-label={t('sessions')}><History size={17}/></button><button className="language-button" onClick={() => setLanguage(l => l === 'en' ? 'fa' : 'en')} aria-label={t('language')}><Globe2 size={15}/><span>{language === 'en' ? 'EN' : 'فارسی'}</span></button><span className="header-divider"/><button className="icon-button theme-toggle" onClick={() => setTheme(v => v === 'dark' ? 'light' : 'dark')} aria-label={t(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="icon-button" onClick={() => setModal('settings')} aria-label={t('settings')}><Settings2 size={17}/></button></div>
      </header>
      <main id="workspace">
        <section className="intro"><div><div className="eyebrow intro-eyebrow"><span/> {t('tagline')}</div><h1>{t('headline')} <span>{t('headlineAccent')}</span></h1><p>{t('subtitle')}</p></div><div className="intro-meta"><div className="local-badge"><ShieldCheck size={13}/>{t('local')}</div><span className="session-date">{new Date(practice.session.startedAt).toLocaleDateString(language === 'fa' ? 'fa-IR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<i/>{t('currentSession')}</span></div></section>
        {practice.error && <div className="error-banner" role="alert"><Mic size={17}/><p>{t(practice.error)}</p><button onClick={() => setModal('guide')} className="text-button">{t('guide')}<ArrowUpRight size={13}/></button></div>}
        <div className="studio-grid">
          <LiveNote pitch={practice.pitch} frame={practice.frame} listening={listening} levels={practice.levels} spelling={spelling}/>
          <AudioControls status={practice.status} micState={micState} elapsed={practice.elapsed} count={practice.session.notes.length} bpm={practice.session.bpm} rms={practice.frame?.rms ?? 0} start={() => void practice.start()} stop={pause => void practice.stop(pause)} restart={listen => void practice.restart(listen)} setBpm={practice.setBpm} onGuide={() => setModal('guide')}/>
          <MusicStaff notes={practice.session.notes} activeMidi={practice.activeMidi} spelling={spelling}/>
          <Timeline notes={practice.session.notes} spelling={spelling}/>
          <PianoKeyboard activeMidi={practice.activeMidi} spelling={spelling}/>
        </div>
        <div className="workspace-bottom"><div className="privacy-note"><ShieldCheck size={16}/><span>{t('privacy')}</span></div><div className="export-wrap"><button className="secondary-button" disabled={!practice.session.notes.length} aria-expanded={exportOpen} onClick={() => setExportOpen(v => !v)}><ArrowDownToLine size={15}/>{t('export')}<ChevronDown size={13}/></button>{exportOpen && <><button className="menu-dismiss" aria-label={t('close')} onClick={() => setExportOpen(false)}/><div className="export-menu">{[{ exporter: jsonExporter, label: 'exportJSON' }, { exporter: midiExporter, label: 'exportMIDI' }, { exporter: musicXmlExporter, label: 'exportXML' }].map(({ exporter, label }) => <button key={label} onClick={() => { downloadSession(exporter, practice.snapshot(), spelling); setExportOpen(false); }}><ArrowDownToLine size={14}/>{t(label as TranslationKey)}<span>{exporter.extension.toUpperCase()}</span></button>)}</div></>}</div></div>
        {practice.storageError && <p className="storage-warning" role="status">{t('unsaved')}</p>}
        {practice.frame && practice.frame.peak > 0.98 && <p className="storage-warning" role="status">{t('clipping')}</p>}
        {debug && <section className="card debug-panel"><div className="card-heading"><h2>{t('debug')}</h2><button className="icon-button small" onClick={() => setDebug(false)} aria-label={t('close')}><X size={15}/></button></div><dl>{[
          ['rawFrequency', practice.frame?.frequency ? `${practice.frame.frequency.toFixed(3)} Hz` : '—'],
          ['midi', practice.pitch?.midi ?? '—'], ['confidence', practice.frame ? `${(practice.frame.confidence * 100).toFixed(1)}%` : '—'],
          ['rms', practice.frame?.rms.toFixed(6) ?? '—'], ['cents', practice.pitch?.cents.toFixed(2) ?? '—'],
          ['processing', practice.frame ? `${practice.frame.processingMs.toFixed(2)} ms` : '—'],
          ['sampleRate', practice.frame ? `${practice.frame.sampleRate} Hz` : '—'], ['window', practice.frame ? `${practice.frame.windowMs.toFixed(1)} ms` : '—'],
        ].map(([key, value]) => <div key={key}><dt>{t(key as TranslationKey)}</dt><dd dir="ltr">{value}</dd></div>)}</dl></section>}
        <div className="practice-tip"><Headphones size={15}/><span>{t('soundHint')}</span></div>
      </main>
      <footer className="site-footer"><span className="footer-brand">xon <span>music</span><i/>{t('footer')}</span><span>{t('madeFor')}</span></footer>
    </div>
    {modal === 'settings' && <Modal title={t('settings')} onClose={() => setModal(null)}><div className="settings-body"><div className="setting-row"><span>{t('appearance')}</span><div className="segmented">{(['dark', 'light'] as const).map(value => <button key={value} onClick={() => setTheme(value)} className={theme === value ? 'selected' : ''}>{value === 'dark' ? <Moon size={14}/> : <Sun size={14}/>} {t(value)}</button>)}</div></div><div className="setting-row"><label htmlFor="language">{t('language')}</label><select id="language" value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="en">English</option><option value="fa">فارسی</option></select></div><div className="setting-row"><span>{t('spelling')}</span><div className="segmented">{(['sharps', 'flats'] as const).map(value => <button key={value} className={spelling === value ? 'selected' : ''} onClick={() => setSpelling(value)}>{t(value)}</button>)}</div></div><div className="gate-setting"><div><label htmlFor="gate">{t('gate')}</label><strong dir="ltr">{gateDb} dB</strong></div><input id="gate" type="range" min={-65} max={-20} step={1} value={gateDb} onChange={e => setGateDb(Number(e.target.value))}/><p>{t('gateHint')}</p></div><label className="setting-row debug-setting"><span>{t('debug')}<small>{t('debugHint')}</small></span><input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)}/></label><div className="modal-privacy"><ShieldCheck size={17}/><p>{t('privacy')}</p></div></div></Modal>}
    {modal === 'guide' && <Modal title={t('guideTitle')} onClose={() => setModal(null)}><div className="guide-body"><p className="guide-intro">{t('guideIntro')}</p>{[1, 2, 3].map(n => <div className="guide-step" key={n}><span>0{n}</span><div><h3>{t(`step${n}` as TranslationKey)}</h3><p>{t(`step${n}Detail` as TranslationKey)}</p></div></div>)}<div className="guide-limits"><h3>{t('limitations')}</h3><p>{t('limitationDetail')}</p><p>{t('timingDetail')}</p></div><p className="muted">{t('stored')}</p><button className="primary-button" onClick={() => setModal(null)}><Check size={16}/>{t('workspace')}</button></div></Modal>}
    {modal === 'sessions' && <Modal title={t('savedSessions')} onClose={() => setModal(null)}><div className="saved-body"><p className="muted">{t('stored')}</p>{saved.length === 0 ? <div className="saved-empty"><History size={30}/><p>{t('noSessions')}</p></div> : saved.map(s => <div className="saved-row" key={s.id}><div><strong>{new Date(s.startedAt).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US')}</strong><span>{s.notes.length} {t('notes')} · <b dir="ltr">{formatTime(s.elapsed)} · {s.bpm} BPM</b></span></div><button className="secondary-button" onClick={() => { void practice.load(s); setModal(null); }}>{t('load')}<ArrowUpRight size={14}/></button></div>)}<button className="primary-button" onClick={() => { void practice.restart(false); setModal(null); }}><AudioLines size={16}/>{t('newSession')}</button></div></Modal>}
  </LanguageContext>;
}
