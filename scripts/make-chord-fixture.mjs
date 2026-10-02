import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Test-only simultaneous piano-like partials; never used as application input by default.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rate = 48000, groups = [[60, 64, 67], [57, 60, 64], [55, 59, 62, 65]];
const lead = 1, hold = 1.35, gap = .55, length = lead + groups.length * (hold + gap) + 1.5;
const frames = Math.ceil(length * rate), buffer = Buffer.alloc(44 + frames * 2);
buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(frames * 2, 40);
for (let i = 0; i < frames; i++) {
  const time = i / rate - lead, index = Math.floor(time / (hold + gap)), local = time - index * (hold + gap);
  let value = 0;
  if (index >= 0 && index < groups.length && local < hold) {
    const envelope = Math.min(1, local / .008) * Math.min(1, (hold - local) / .035) * (.7 * Math.exp(-local) + .3);
    value = groups[index].reduce((sum, midi, voice) => {
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      return sum + [1, .65, .35, .18, .12, .08].reduce((sample, amplitude, h) => sample + amplitude * Math.sin(2 * Math.PI * frequency * (h + 1) * local + voice * .7), 0) * envelope * .15 / groups[index].length;
    }, 0);
  }
  buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
}
fs.mkdirSync(path.join(root, 'tests/fixtures'), { recursive: true });
fs.writeFileSync(path.join(root, 'tests/fixtures/chord-sequence.wav'), buffer);
console.log('Created simultaneous test-only microphone reference: C major, A minor, G7.');
