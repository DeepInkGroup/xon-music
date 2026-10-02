import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './make-chord-fixture.mjs';

// Test-only reference audio. This is never imported or served by the application.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleRate = 48000;
const sequence = [60, 63, 57, 69, 48, 84];
const noteLength = 1.05, gap = .45, lead = 1;
const seconds = lead + sequence.length * (noteLength + gap) + 2;
const samples = Math.ceil(seconds * sampleRate);
const buffer = Buffer.alloc(44 + samples * 2);
buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++) {
  const time = i / sampleRate - lead;
  const index = Math.floor(time / (noteLength + gap));
  const localTime = time - index * (noteLength + gap);
  let value = 0;
  if (index >= 0 && index < sequence.length && localTime < noteLength) {
    const frequency = 440 * 2 ** ((sequence[index] - 69) / 12);
    const attack = Math.min(1, localTime / .01), release = Math.min(1, (noteLength - localTime) / .045);
    const envelope = attack * release * (.7 * Math.exp(-localTime * 1.8) + .3);
    value = envelope * (.22 * Math.sin(2 * Math.PI * frequency * localTime) + .15 * Math.sin(4 * Math.PI * frequency * localTime) + .065 * Math.sin(6 * Math.PI * frequency * localTime));
  }
  buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
}
fs.mkdirSync(path.join(root, 'tests', 'fixtures'), { recursive: true });
fs.writeFileSync(path.join(root, 'tests', 'fixtures', 'piano-sequence.wav'), buffer);
console.log('Created test-only harmonic-rich microphone reference: C4, D#4, A3, A4, C3, C6.');
