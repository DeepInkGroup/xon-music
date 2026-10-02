# Xon Music

A piano listening and practice workspace. Real microphone samples become measured pitches, highlighted piano keys, musical notation, and timestamped session events. Version 2 adds experimental simultaneous note/chord analysis and audible session playback. There is no production demo generator, simulated detector, backend, or audio upload.

## GitHub Pages

The Pages URL is **https://deepinkgroup.github.io/xon-music/**. The workflow in `.github/workflows/pages.yml` tests, builds, and deploys automatically on every push to `main`; it can also be run manually in GitHub Actions. In repository **Settings → Pages**, the publishing source must be **GitHub Actions**. Private repositories require a GitHub plan that supports Pages; GitHub Free requires a public repository.

`npm run build:pages` builds into `dist-pages/` using the `/xon-music/` base path, including microphone worklet and worker assets. Ordinary `npm run build` keeps the root URL used by the desktop launcher. HTTPS on Pages supports microphone access; each visitor explicitly grants permission and their audio stays on their own device.

To verify the Pages build locally, run `npm run build:pages` followed by `node scripts/production-check.mjs --pages`.

References: [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Vite deployment guide](https://vite.dev/guide/static-deploy.html).

## Run locally

Requires Node.js 20.19+ or 22.12+ (tested with Node 24), npm, and a current browser.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. Choose **Single notes** for YIN analysis or **Notes & chords** for experimental spectral analysis. Click **Start listening**, grant microphone access, and play the piano. Hold clear chords for a moment, preferably without pedal. The browser requests permission only after this action. Place the device near the piano, start in a quiet room, and adjust **Settings → Noise gate** if quiet notes are missed or background sound triggers notes.

Click **Stop listening** to finish and automatically hear the captured notes. Turn off **Play after recording** to disable automatic playback. Playback also works for saved sessions without microphone permission. It synthesizes the detected notes with their measured timing; it does not replay a recording of microphone audio.

### Windows desktop launcher

The **Xon Music** desktop shortcut runs `scripts/launch-desktop.ps1`, starts a hidden local preview server on **http://127.0.0.1:5180**, and opens the app in its own Chrome or Edge window. It reuses the server on subsequent launches and builds the app if `dist/` is missing. Keep Node.js installed and the project folder in place. After source changes, run `npm run build` to update the desktop app. The loopback URL supports browser microphone permission without uploading audio.

To launch directly or check the server without opening a window:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/launch-desktop.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/launch-desktop.ps1 -CheckOnly
```

```sh
npm run build
npm run preview
```

The build is a static application in `dist/`. Deploy the entire directory on HTTPS, including `audio/capture.worklet.js` and the generated worker asset. `localhost`/loopback is permitted for development. Opening `index.html` directly with `file://` does not work.

For a physical phone on your network, use an HTTPS development proxy or deploy the build to an HTTPS host. Plain HTTP on a LAN IP does **not** allow microphone access. The default Vite server binds to loopback; `npm run dev -- --host 0.0.0.0` exposes the server to the LAN but still requires HTTPS for microphone use there.

## Features

- Actual Web Audio microphone capture, with browser permission, stop, pause, and resume controls.
- YIN monophonic pitch detection across the 88-key piano range, note name, frequency, MIDI number, octave, fixed-do solfège, cents, and periodicity confidence.
- Experimental polyphonic harmonic analysis with up to six simultaneous pitches in C2–C7. Chord recognition uses concurrent measured voices, supporting major, minor, diminished, augmented, sus2, sus4, dominant seventh, major seventh, minor seventh, half-diminished seventh, diminished seventh, and inversions. Incomplete or unsupported pitch sets show **Uncertain**.
- Adjustable RMS noise gate, two-frame pitch stabilization, release hysteresis, and amplitude-based same-note reattack detection.
- An 88-key keyboard with white/black keys, measured-note highlighting, labels, horizontal scrolling, octave navigation, and optional follow mode.
- VexFlow grand, treble, and bass staff; ledger lines, sharps, flats, natural cancellations, approximate whole/half/quarter/eighth notes. Automatic navigation to the latest note page; earlier notes remain accessible through page controls.
- Chronological timeline, detected-note count, editable 30–240 BPM, session clock, clear, restart, and local session history.
- Stacked chord notation and recorded chord progression with timestamps and durations. The keyboard, staff, and timeline highlight multiple live or replayed notes.
- Synthesized piano playback with automatic replay after Stop, play/pause/resume/stop, seeking, speed from 0.5× to 2×, volume, and loop. Playback uses recorded note timing and preserves pitch when speed changes.
- JSON, standard MIDI, and MusicXML downloads. Hidden audio diagnostics, dark/light appearance, and English/Persian localization with RTL layout. Musical notation and pitch names remain left-to-right.

## Architecture

```text
getUserMedia
  → MediaStreamAudioSourceNode
  → AudioWorklet (mono sample ring buffer; silent output)
  → Web Worker (RMS gate → downsampling → YIN or harmonic spectrum analysis)
  → PolyphonicTracker (independent stable onsets and releases)
  → ChordDetector (simultaneous pitch-class matching)
  → usePractice (session lifecycle and presentation snapshots)
  → live pitch / tuner / piano / VexFlow / timeline
  → local storage and modular exporters

stored notes → SessionPlayer (AudioContext lookahead scheduler)
             → harmonic oscillators / envelopes → speakers
             → synchronized key / staff / timeline highlighting
```

| Module | Responsibility |
| --- | --- |
| `src/audio/audioInput.ts` | Permission, AudioContext, stream/worklet/worker lifecycle, browser interruptions, resource cleanup |
| `public/audio/capture.worklet.js` | Bounded ring buffer, sample timestamps and worker backpressure; no expensive analysis on the audio thread |
| `src/audio/pitch.worker.ts` | Noise gate and pitch analysis off the main thread; measured RMS, peak, confidence and processing time |
| `src/audio/pitchDetector.ts` | Typed detector interface and YIN implementation, independent of React |
| `src/audio/spectrum.ts`, `polyphonicDetector.ts` | Windowed FFT, measured spectral peaks, sparse harmonic decomposition and evidence filtering |
| `src/audio/noteTracker.ts` | Stable note events, approximate durations, release hysteresis and repeated attacks |
| `src/audio/polyphonicTracker.ts` | Independent note tracking for simultaneous measured voices |
| `src/audio/sessionPlayer.ts` | Audio-clock scheduling, synthesized tone envelopes, volume and cancellation |
| `src/music/` | Frequency mapping, pitch spelling, rhythm quantization, concurrent chord matching, note grouping and typed events |
| `src/hooks/usePractice.ts` | Microphone/session state, pause-aware timing, throttled display, recording and persistence |
| `src/hooks/useSessionPlayer.ts` | Playback lifecycle, seek/speed/loop controls and synchronized visual state |
| `src/components/` | Detector, tuning meter, controls, sheet, keyboard, timeline and accessible dialogs |
| `src/session/` | Session schema, browser storage and exporters |
| `src/i18n.ts` | Typed English/Persian string dictionaries |

Audio analysis, note-event tracking, chord matching, rhythm approximation, playback, and presentation are independent modules. The analysis worker emits typed `DetectedPitch[]` evidence; a future piano model can replace the current harmonic detector without changing the UI. Chords are matched only from simultaneous detected voices, never inferred from a sequence of melody notes.

### Accuracy and latency decisions

YIN uses cumulative mean normalized differences, the first trough below 0.15, and parabolic interpolation. Confidence is `1 − normalized difference`: a measured periodicity score, **not** a calibrated probability of correctness or piano classification. Frames without adequate periodicity do not produce a pitch. Notes require two consecutive frames with the same MIDI note and at least 85% confidence. The default noise gate is −45 dBFS and is user adjustable.

Chord mode uses a DC-removed Hann window, a zero-padded FFT, interpolated spectral peaks, and sparse nonnegative fitting against piano-like harmonic templates. Harmonics explained by lower notes are suppressed unless independent peaks support another voice. Per-voice confidence combines harmonic-template fit with global spectral fit, with a 70% minimum. Multiple voices require three stable frames; a chord additionally requires two frames of a matching complete pitch set. Confidence is an evidence score, not a calibrated accuracy probability. An isolated spectral pitch that agrees with YIN uses YIN frequency refinement. Isolated pitches outside C2–C7 can fall back to YIN; this does not extend polyphonic range.

Capture uses approximately 170–186 ms windows at common 44.1/48/96 kHz sample rates with 75% overlap (about 43–46 ms hops). Low piano notes need enough cycles to establish a fundamental; this is the main latency/accuracy tradeoff. Stabilization and browser/device latency add delay. A first note usually needs approximately 200–300 ms of audio. These are algorithmic estimates, not guaranteed hardware measurements.

Integer downsampling averages samples to reduce CPU use; analysis computes in a worker. The simple averaging filter is not a full anti-aliasing filter. Very high-frequency noise can alias, and the top octave has less precise cent measurements. The audio thread only captures samples; when the worker is busy, capture skips intermediate analysis windows instead of building an unbounded queue. UI audio readings update at most about 15 times per second. Scores render 24 onset groups per page; sessions cap at 10,000 notes to keep memory bounded.

### Timing and notation

Onsets use AudioContext capture timestamps, mapped to the session clock with an analysis-window center correction. They estimate acoustic onset, rather than identifying the exact hammer strike. Pausing, stopping, and hiding the tab release the microphone and freeze the session clock. Resume needs a user gesture and creates a new capture graph. Restart starts a new session and resumes capture if the previous session was listening. Clear starts an empty, stopped session. These operations preserve prior nonempty sessions in local history.

Duration is estimated independently for each voice from stable pitch and release detection, then rounded to the closest supported beat value at the BPM in effect at that note's onset. Notes within 55 ms of one another are grouped into a notated chord only if they overlap. Rapid repeated notes with no amplitude valley may merge. Single-note mode supports amplitude-based reattacks; chord mode requires a detected release before the same pitch can retrigger, preventing another voice's attack from falsely retriggering held notes. Sustain pedal and resonant decay can extend duration. This version does not perform beat tracking, automatic rests, meter alignment, dotted rhythms, ties, triplets, pedal tracking, or advanced independent-voice engraving. The score is an ordered practice transcription, **not a fully quantized engraving**.

### Playback

The player uses a short lookahead queue and AudioContext timestamps to schedule simultaneous tones accurately. A periodic wave, low-pass filtering, attack/decay/release envelopes, and a compressor create a lightweight synthesized piano timbre without remote samples. Seeking resumes any notes still held at that position. Speed scales onset spacing and duration, preserving each pitch. Leading silence is skipped on play; timing gaps between notes are preserved. Playback stops before microphone capture starts, and backgrounding pauses playback. MIDI export can be used with a richer external instrument.

### Export behavior

- **JSON**: full measured note events, onset seconds, durations, confidence, cents, MIDI, octave, each event's BPM, session BPM, UTC timestamp, elapsed session time, schema version and ID. Version 2 additionally stores detection mode and chord events (root, bass, quality, voices, confidence, onset and duration). Existing version 1 saved sessions remain readable and playable.
- **MIDI**: type 0 standard MIDI, 480 ticks per quarter, acoustic grand piano program. Actual onset/duration seconds determine event ticks under a constant session tempo; changing BPM does not distort performed timing. Velocity is a fixed export value of 80, since microphone amplitude is not a calibrated MIDI velocity. Audio is not included.
- **MusicXML 4.0**: grand staff, stacked chords, aligned treble/bass chord voices, and approximate note values, in chronological order, with `senza-misura` rather than invented meter or rests. Groups of eight onset groups provide layout segments; they are not detected musical bars. MIDI/JSON preserve measured timing; MusicXML preserves the simplified notation. Enharmonic spelling follows the current sharps/flats setting.

## Browser compatibility and honest limitations

Target: current Safari on iOS/macOS, Chrome on Android/desktop, and Edge. Secure-context `getUserMedia`, Web Audio, AudioWorklet, Web Workers, and modern JavaScript are required. Unsupported browsers show a readable message rather than using a simulated fallback. The AudioContext is created/resumed from a button gesture to accommodate mobile audio restrictions. Background tabs pause capture; interrupted contexts, revoked permission, and disconnected microphones require pressing Resume/Start again. OS microphone access must also be enabled.

Browsers are asked to disable echo cancellation, automatic gain control, and noise suppression because speech processing can distort musical pitches. Devices may ignore these requests. Bluetooth microphones, built-in speech processing, room echoes, and device hardware can increase latency or reduce accuracy. Use a built-in or wired microphone when possible.

**Chord mode is experimental.** It performs real polyphonic analysis, but it is not a trained acoustic-piano transcription model. Weak fundamentals, overlapping harmonics, octave doublings, dense low-register clusters, unequal voice volumes, piano inharmonicity, pedal resonance and different instrument envelopes can cause missed voices or false notes. Unsupported or low-confidence measured pitch sets show **Uncertain**, but a confident wrong pitch set can still produce a wrong chord label. Clear sustained triads without pedal are the best initial use. Choose **Single notes** for the more conservative monophonic path; that mode may choose a dominant pitch or octave when presented with a chord. Neither mode promises accurate transcription of arbitrary full piano performances.

The **Piano detected** status means a stable pitch within A0–C8, not a trained instrument classifier: singing or another pitched instrument can trigger it. The tuning reference is fixed to A4 = 440 Hz; pianos tuned to another reference will show a systematic cents offset.

## Privacy and storage

Audio samples exist only in device memory during processing. There is no server, analytics, remote font request, audio recording, audio upload, or cloud session sync. All application assets are served by the application's host. Only detected note events and session metadata are persisted in `localStorage`, with the eight most recent nonempty sessions retained. Export important sessions before browser data is cleared or older sessions are replaced. Storage failures show a warning and exports continue to work. Shared-browser users can access that browser's saved sessions. Clearing site data removes them.

## Tests and validation

```sh
npm test
node scripts/make-audio-fixture.mjs
npm run test:browser
npm run build
node scripts/production-check.mjs
node scripts/production-check.mjs --pages --chords
```

Browser tests default to installed Google Chrome. If Chrome is unavailable, install Playwright Chromium (`npx playwright install chromium`) and remove `channel: 'chrome'` from the browser launch configurations. The generated single-note and chord WAV fixtures are strictly test-only and excluded from source builds. Playwright passes these harmonic-rich reference files to Chromium's microphone capture device: the tests then exercise the **actual `getUserMedia → AudioWorklet → Worker → detector → UI` pipeline**, rather than replacing the detector or injecting fake note events into the app.

`npm run test:browser` regenerates both fixtures automatically. `scripts/production-check.mjs` checks built assets with a temporary preview server on port 5178, verifies microphone detection and notation, exercises pause/resume and automatic replay, and confirms that every captured microphone track ends when listening stops. `--pages` selects the Pages build; `--chords` selects simultaneous reference pitches. Set `XON_CHECK_URL` to verify a deployed HTTPS app. It also uses installed Chrome; update its `channel` option if using Playwright Chromium.

Unit tests cover known pitches from A0 to C8 at 44.1/48/96 kHz, harmonic-rich triads/inversions/sevenths, single-note harmonic suppression, silence/noise rejection, independent voice release, confidence gating, onset stabilization, reattack, tuning, rhythm, playback scheduling/seeking/speed, chord MusicXML and decoded MIDI event timing. Browser tests cover the six-note reference sequence and C/Am/G7 sequence, multiple key highlights, staff output, timeline, saved sessions, downloads, microphone rejection, responsive widths (320/390/768/1440 px), Persian RTL, themes, controls and notation modes. Playback tests measure a nonzero output waveform, check scheduled chord frequencies, and exercise automatic replay, pause, seek, speed and loop without requesting microphone permission. Screenshots are written to `artifacts/`.

Automated audio tests use known generated input; they do **not** replace physical microphone/piano testing. No physical piano or iOS/Android device is available in this environment. Before a production release, verify actual acoustic and digital pianos, built-in/wired microphones, Safari on iOS/macOS, Chrome on Android, different noise levels, pedal resonance, long sessions, interruption/reconnection and repeated-note articulation.

References: [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet), [microphone capture and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [VexFlow source and documentation](https://github.com/0xfe/vexflow).
