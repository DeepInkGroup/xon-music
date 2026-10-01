import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('real getUserMedia → worklet → worker → detector → keys → staff → timeline → exports', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('live-note')).toHaveText('—');
  await expect(page.getByTestId('timeline-note')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start listening' }).click();
  await expect(page.getByRole('button', { name: 'Stop listening' })).toBeVisible();
  await expect(page.locator('.piano-key[data-midi="60"]')).toHaveClass(/active/, { timeout: 12000 });
  await expect(page.getByTestId('live-note')).toHaveText('C4');
  await expect(page.locator('.sheet-scroll svg .vf-stavenote')).not.toHaveCount(0);
  await expect(page.getByTestId('timeline-note')).toHaveCount(6, { timeout: 18000 });
  await expect(page.locator('.piano-key.active')).toHaveCount(0, { timeout: 4000 });
  const rows = await page.getByTestId('timeline-note').allTextContents();
  expect(rows.map(row => row.match(/(C4|D#4|A3|A4|C3|C6)/)?.[1])).toEqual(['C4', 'D#4', 'A3', 'A4', 'C3', 'C6']);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Session paused');
  const clock = await page.getByTestId('session-clock').textContent();
  await page.waitForTimeout(400); expect(await page.getByTestId('session-clock').textContent()).toBe(clock);
  await page.getByRole('button', { name: 'Export session' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download JSON/ }).click();
  const file = await download; const data = JSON.parse(await fs.readFile((await file.path())!, 'utf8'));
  expect(data.notes).toHaveLength(6); expect(data.notes.every((n: { duration: number }) => n.duration > .7 && n.duration < 1.5)).toBe(true);
  expect(data.notes.every((n: { ended: boolean }) => n.ended)).toBe(true);
  expect(data.notes[0].onset).toBeGreaterThan(.4);
  await page.getByRole('button', { name: 'Sessions', exact: true }).click();
  await expect(page.locator('.saved-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Clear session', exact: true }).click();
  await expect(page.getByTestId('timeline-note')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('microphone permission errors remain honest and recoverable', async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Denied', 'NotAllowedError')); });
  await page.goto('/'); await page.getByRole('button', { name: 'Start listening' }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone access was denied');
  await expect(page.getByTestId('timeline-note')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start listening' })).toBeVisible();
});

test('responsive layout, English/Persian, themes, settings and notation modes', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
  for (const width of [390, 320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Start listening' })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('button', { name: 'شروع شنیدن', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/persian-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'روشن', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'تنظیمات', exact: true }).click();
  await page.getByLabel('آستانهٔ نویز', { exact: true }).fill('-35');
  await page.getByRole('checkbox', { name: /عیب‌یابی صدا/ }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'بستن', exact: true }).click();
  await expect(page.locator('.debug-panel')).toBeVisible();
  await page.getByRole('button', { name: 'کلید فا', exact: true }).click();
  await page.screenshot({ path: 'artifacts/light-persian-mobile.png', fullPage: true });
});
