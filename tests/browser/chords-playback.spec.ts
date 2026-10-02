import { expect, test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

test.use({ launchOptions: { channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${path.resolve('tests/fixtures/chord-sequence.wav')}`] } });

test('microphone chords → independent notes → score → automatic audible replay', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const global = window as unknown as { outputMeters: AnalyserNode[]; scheduledPitches: number[] };
    global.outputMeters = []; global.scheduledPitches = [];
    const createCompressor = AudioContext.prototype.createDynamicsCompressor;
    AudioContext.prototype.createDynamicsCompressor = function() {
      const compressor = createCompressor.call(this), meter = this.createAnalyser();
      meter.fftSize = 2048; compressor.connect(meter); global.outputMeters.push(meter); return compressor;
    };
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function() {
      const oscillator = createOscillator.call(this), start = oscillator.start.bind(oscillator);
      oscillator.start = when => { global.scheduledPitches.push(oscillator.frequency.value); start(when); }; return oscillator;
    };
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Notes & chords', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Start listening', exact: true }).click();
  await expect(page.getByTestId('live-chord')).toHaveText('C', { timeout: 12000 });
  await expect(page.locator('.piano-key.active')).toHaveCount(3);
  await expect(page.locator('.sheet-scroll svg .vf-stavenote')).not.toHaveCount(0);
  await page.screenshot({ path: 'artifacts/chord-live.png', fullPage: true });
  await expect(page.getByTestId('live-chord')).toHaveText('Am', { timeout: 6000 });
  await expect(page.getByTestId('live-chord')).toHaveText('G7', { timeout: 6000 });
  await expect(page.locator('.piano-key.active')).toHaveCount(0, { timeout: 6000 });
  await expect(page.getByTestId('timeline-note')).toHaveCount(10);
  await expect(page.locator('.progression-chord')).toHaveCount(3);
  await page.getByRole('button', { name: 'Stop listening', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
  await expect(page.locator('.piano-key.active')).toHaveCount(3);
  await expect.poll(() => page.evaluate(() => {
    const meters = (window as unknown as { outputMeters: AnalyserNode[] }).outputMeters;
    return Math.max(0, ...meters.map(meter => { const samples = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(samples); return Math.max(...samples.map(Math.abs)); }));
  })).toBeGreaterThan(.005);
  const pitches = await page.evaluate(() => (window as unknown as { scheduledPitches: number[] }).scheduledPitches);
  expect(pitches.slice(0, 3).map(f => Math.round(69 + 12 * Math.log2(f / 440)))).toEqual([60, 64, 67]);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  const pausedClock = await page.getByTestId('playback-clock').textContent();
  await page.waitForTimeout(250); expect(await page.getByTestId('playback-clock').textContent()).toBe(pausedClock);
  await page.getByRole('slider', { name: 'Playback position', exact: true }).fill('3.25');
  await page.getByRole('combobox', { name: 'Speed', exact: true }).selectOption('0.75');
  await page.getByRole('button', { name: 'Play recording', exact: true }).click();
  await expect(page.locator('.playback-notes')).toContainText('A3');
  await page.getByRole('button', { name: 'Stop playback', exact: true }).click();
  await expect(page.locator('.piano-key.active')).toHaveCount(0);
  await page.getByRole('button', { name: 'Export session', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: /Download JSON/ }).click();
  const file = await pending; const session = JSON.parse(await fs.readFile((await file.path())!, 'utf8'));
  expect(session.version).toBe(2); expect(session.chords.map((c: { root: number; quality: string }) => [c.root, c.quality])).toEqual([[0, 'major'], [9, 'minor'], [7, 'dominant7']]);
  expect(session.notes).toHaveLength(10); expect(session.notes.every((n: { duration: number }) => n.duration > .8 && n.duration < 1.8)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/playback-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('old saved sessions remain playable without accessing a microphone', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('xon-music.sessions.v1', JSON.stringify([{ version: 1, id: 'old-session', startedAt: '2026-10-01T10:00:00Z', bpm: 120, elapsed: .5,
      notes: [{ id: 'legacy-note', name: 'C4', pitchClass: 'C', midi: 60, frequency: 261.63, referenceFrequency: 261.63, octave: 4, solfege: 'Do', cents: 0, onset: 0, duration: .5, rhythm: 'q', bpm: 120, confidence: .99, ended: true }] }]));
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('Playback must not request microphone permission'));
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Sessions', exact: true }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Loop', exact: true }).check();
  await page.getByRole('button', { name: 'Play recording', exact: true }).click();
  await expect(page.locator('.piano-key[data-midi="60"]')).toHaveClass(/active/);
  await page.waitForTimeout(1400);
  await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop playback', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
