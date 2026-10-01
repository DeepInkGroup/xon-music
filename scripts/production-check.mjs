import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5178', '--strictPort'], { cwd: root, windowsHide: true, stdio: 'pipe' });
let serverOutput = '';
server.stdout.on('data', data => { serverOutput += data; });
server.stderr.on('data', data => { serverOutput += data; });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw new Error(serverOutput);
    try { if ((await fetch('http://127.0.0.1:5178')).ok) { ready = true; break; } } catch { /* Server is starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(ready, 'Production preview did not start.');
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${path.join(root, 'tests/fixtures/piano-sequence.wav')}`,
  ] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.testStreams = [];
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await original(constraints); window.testStreams.push(stream); return stream;
    };
  });
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Start listening', exact: true }).click();
  await page.locator('.piano-key[data-midi="60"].active').waitFor({ timeout: 12000 });
  assert.equal(await page.getByTestId('live-note').textContent(), 'C4');
  assert(await page.locator('.sheet-scroll svg .vf-stavenote').count() > 0);
  await page.screenshot({ path: path.join(root, 'artifacts/live-production.png'), fullPage: true });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  assert(await page.evaluate(() => window.testStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended'))));
  const firstCount = await page.getByTestId('timeline-note').count();
  await page.locator('.mic-button').click();
  await page.waitForFunction(count => document.querySelectorAll('[data-testid="timeline-note"]').length > count, firstCount, { timeout: 12000 });
  await page.getByRole('button', { name: 'Stop listening', exact: true }).click();
  assert(await page.evaluate(() => window.testStreams.length === 2 && window.testStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended'))));
  assert.equal(await page.locator('.piano-key.active').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Production build passed: actual microphone capture, measured C4, VexFlow notes, pause/resume, and released microphone tracks.');
} finally {
  await browser?.close(); server.kill();
}
