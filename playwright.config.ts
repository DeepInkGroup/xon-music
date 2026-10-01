import { defineConfig } from '@playwright/test';
import path from 'node:path';
export default defineConfig({
  testDir: './tests/browser', timeout: 45000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, screenshot: 'only-on-failure',
    launchOptions: { channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${path.resolve('tests/fixtures/piano-sequence.wav')}`] } },
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev`, url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30000 },
});
